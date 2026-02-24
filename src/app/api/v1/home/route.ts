import { NextResponse } from 'next/server';
import { getHomeDramas } from '../../../lib/db/dramas';
import { logger, generateRequestId } from '../../../lib/observability/logger';
import type { ApiResponse, DramaCard } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const dramas = await getHomeDramas(20);

    const response: ApiResponse<DramaCard[]> = {
      data: dramas,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
      error: null,
    };

    logger.info('home_fetched', {
      requestId,
      count: dramas.length,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('home_fetch_failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    });

    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch home content',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
