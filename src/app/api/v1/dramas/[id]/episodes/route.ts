import { NextResponse } from 'next/server';
import { getEpisodesByDramaId } from '../../../../../lib/db/dramas';
import { logger, generateRequestId } from '../../../../../lib/observability/logger';
import type { ApiResponse, EpisodeItem } from '../../../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const { id } = params;

  try {
    const episodes = await getEpisodesByDramaId(id);

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
      dramaId: id,
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
