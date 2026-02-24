import { NextResponse } from 'next/server';
import { upsertWatchProgress } from '../../../lib/db/watch-history';
import { logger, generateRequestId } from '../../../lib/observability/logger';
import type { ApiResponse, WatchHistoryEntry } from '../../../lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { userId, dramaId, episodeId, progressSeconds, isCompleted } = body;

    if (!userId || !dramaId || !episodeId || progressSeconds === undefined) {
      const response: ApiResponse<null> = {
        data: null,
        meta: { requestId, timestamp: new Date().toISOString() },
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required fields: userId, dramaId, episodeId, progressSeconds',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const entry: WatchHistoryEntry = {
      userId,
      dramaId,
      episodeId,
      progressSeconds: Math.max(0, progressSeconds),
      isCompleted: !!isCompleted,
    };

    await upsertWatchProgress(entry);

    logger.info('watch_progress_saved', {
      requestId,
      userId,
      dramaId,
      episodeId,
      progressSeconds,
      isCompleted,
      latencyMs: Date.now() - startTime,
    });

    const response: ApiResponse<{ saved: boolean }> = {
      data: { saved: true },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
      error: null,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('watch_progress_failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    });

    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to save watch progress',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
