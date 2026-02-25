import { NextResponse } from 'next/server';
import { getEpisodesByDramaId, getDramaById, getDramaByProviderId } from '@/lib/db/dramas';
import { syncEpisodes } from '@/jobs/sync-episodes';
import { logger, generateRequestId } from '@/lib/observability/logger';
import { validatePathParams, dramaDetailPathSchema } from '@/lib/validation/schemas';
import type { ApiResponse, EpisodeItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Handle OPTIONS for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate path parameters
  const validation = await validatePathParams(params, dramaDetailPathSchema);

  if (!validation.success) {
    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: validation.error,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const { id } = validation.data;

  try {
    let drama = await getDramaById(id);

    if (!drama && id.includes(':')) {
      const [providerSlug, ...dramaIdParts] = id.split(':');
      const providerDramaId = dramaIdParts.join(':');

      if (providerSlug && providerDramaId) {
        drama = await getDramaByProviderId(providerSlug, providerDramaId);
      }
    }

    if (!drama) {
      const response: ApiResponse<null> = {
        data: null,
        meta: { requestId, timestamp: new Date().toISOString() },
        error: {
          code: 'NOT_FOUND',
          message: `Drama with id ${id} not found`,
        },
      };

      return NextResponse.json(response, { status: 404 });
    }

    let episodes = await getEpisodesByDramaId(drama.id);

    const isEpisodeUsable = (episode: EpisodeItem): boolean => {
      const hasEpisodeNo = Number.isFinite(episode.episodeNo);
      const hasProviderEpisodeRef = Boolean(episode.chapterId || episode.providerEpisodeId);
      return hasEpisodeNo && hasProviderEpisodeRef;
    };

    const usableCount = episodes.filter(isEpisodeUsable).length;
    const hasCorruptedEpisodeRows = episodes.length > 0 && usableCount === 0;

    // Auto-sync episodes if missing OR existing rows are fully corrupted (no usable episode mapping)
    if (!episodes || episodes.length === 0 || hasCorruptedEpisodeRows) {
      logger.info('episodes_sync_started', {
        requestId,
        requestedDramaId: id,
        dramaId: drama.id,
        provider: drama.providerSlug,
        providerDramaId: drama.providerDramaId,
        reason: episodes.length === 0 ? 'empty' : 'corrupted_rows',
      });

      await syncEpisodes(drama.providerSlug, drama.providerDramaId);
      episodes = await getEpisodesByDramaId(drama.id);
    }

    const sanitizedEpisodes = episodes.filter(isEpisodeUsable);

    if (sanitizedEpisodes.length !== episodes.length) {
      logger.warn('episodes_filtered_invalid_rows', {
        requestId,
        requestedDramaId: id,
        dramaId: drama.id,
        beforeCount: episodes.length,
        afterCount: sanitizedEpisodes.length,
      });
    }

    const response: ApiResponse<EpisodeItem[]> = {
      data: sanitizedEpisodes,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination: {
          page: 1,
          pageSize: sanitizedEpisodes.length,
          total: sanitizedEpisodes.length,
        },
      },
      error: null,
    };

    logger.info('episodes_fetched', {
      requestId,
      requestedDramaId: id,
      dramaId: drama.id,
      count: sanitizedEpisodes.length,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('episodes_fetch_failed', {
      requestId,
      dramaId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    });

    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch episodes',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
