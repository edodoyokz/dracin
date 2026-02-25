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

    // Auto-sync episodes if they are missing
    if (!episodes || episodes.length === 0) {
      logger.info('episodes_sync_started', {
        requestId,
        requestedDramaId: id,
        dramaId: drama.id,
        provider: drama.providerSlug,
        providerDramaId: drama.providerDramaId,
      });
      await syncEpisodes(drama.providerSlug, drama.providerDramaId);
      episodes = await getEpisodesByDramaId(drama.id);
    }

    const response: ApiResponse<EpisodeItem[]> = {
      data: episodes,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination: {
          page: 1,
          pageSize: episodes.length,
          total: episodes.length,
        },
      },
      error: null,
    };

    logger.info('episodes_fetched', {
      requestId,
      requestedDramaId: id,
      dramaId: drama.id,
      count: episodes.length,
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
