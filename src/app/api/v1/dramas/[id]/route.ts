import { NextResponse } from 'next/server';
import { getDramaById } from '../../../../lib/db/dramas';
import { logger, generateRequestId } from '../../../../lib/observability/logger';
import type { ApiResponse, DramaDetail } from '../../../../lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const { id } = params;

  try {
    const drama = await getDramaById(id);

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

    const response: ApiResponse<DramaDetail> = {
      data: drama,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
      error: null,
    };

    logger.info('drama_detail_fetched', {
      requestId,
      dramaId: id,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('drama_detail_fetch_failed', {
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
        message: 'Failed to fetch drama details',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
