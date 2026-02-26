import { NextResponse } from 'next/server';
import { getEpisodesByDramaId, getDramaById, getDramaByProviderId } from '@/lib/db/dramas';
import { getEpisodesWithFallback } from '@/lib/services/episode-sync';
import { syncDramaFromProvider } from '@/lib/services/drama-sync';
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

  const { id: rawId } = validation.data;

  const normalizedId = (() => {
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  })();

  try {
    let drama = await getDramaById(normalizedId);

    if (!drama && normalizedId.includes(':')) {
      const [providerSlug, ...dramaIdParts] = normalizedId.split(':');
      const providerDramaId = dramaIdParts.join(':');

      if (providerSlug && providerDramaId) {
        drama = await getDramaByProviderId(providerSlug, providerDramaId);

        // If drama not found in DB, try to sync from provider API
        if (!drama) {
          logger.info('drama_not_in_db_attempting_sync', {
            requestId,
            provider: providerSlug,
            providerDramaId,
          });

          drama = await syncDramaFromProvider(providerSlug, providerDramaId, requestId);
        }
      }
    }

    if (!drama) {
      const response: ApiResponse<null> = {
        data: null,
        meta: { requestId, timestamp: new Date().toISOString() },
        error: {
          code: 'NOT_FOUND',
          message: `Drama with id ${normalizedId} not found`,
        },
      };

      return NextResponse.json(response, { status: 404 });
    }

    let episodes: EpisodeItem[] = [];

    const isEpisodeUsable = (episode: EpisodeItem): boolean => {
      const hasEpisodeNo = Number.isFinite(episode.episodeNo);
      const hasProviderEpisodeRef = Boolean(episode.chapterId || episode.providerEpisodeId);
      return hasEpisodeNo && hasProviderEpisodeRef;
    };

    // Try to get episodes from DB first
    const dbEpisodes = await getEpisodesByDramaId(drama.id);
    const usableCount = dbEpisodes.filter(isEpisodeUsable).length;
    const hasCorruptedEpisodeRows = dbEpisodes.length > 0 && usableCount === 0;

    if (dbEpisodes.length > 0 && !hasCorruptedEpisodeRows) {
      // Use DB episodes if available and valid
      episodes = dbEpisodes;
    } else {
      // Use fallback to provider API with auto-sync
      logger.info('episodes_fallback_to_provider', {
        requestId,
        requestedDramaId: normalizedId,
        dramaId: drama.id,
        provider: drama.providerSlug,
        providerDramaId: drama.providerDramaId,
        reason: dbEpisodes.length === 0 ? 'empty' : 'corrupted_rows',
      });

      episodes = await getEpisodesWithFallback(
        drama.id,
        drama.providerSlug,
        drama.providerDramaId,
        requestId
      );
    }

    const sanitizedEpisodes = episodes.filter(isEpisodeUsable);

    if (sanitizedEpisodes.length !== episodes.length) {
      logger.warn('episodes_filtered_invalid_rows', {
        requestId,
        requestedDramaId: normalizedId,
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
      requestedDramaId: normalizedId,
      dramaId: drama.id,
      count: sanitizedEpisodes.length,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('episodes_fetch_failed', {
      requestId,
      dramaId: normalizedId,
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
