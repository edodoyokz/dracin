import { NextResponse } from 'next/server';
import { upsertWatchProgress } from '@/lib/db/watch-history';
import { logger, generateRequestId } from '@/lib/observability/logger';
import { validateRequestBody, watchProgressRequestSchema } from '@/lib/validation/schemas';
import type { ApiResponse, WatchProgress } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Handle OPTIONS for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Validate request body
  const validation = await validateRequestBody(request, watchProgressRequestSchema);

  if (!validation.success) {
    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: validation.error,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const { userId, dramaId, episodeId, progressSeconds, isCompleted } = validation.data;

  try {
    const entry: Omit<WatchProgress, 'lastWatchedAt'> = {
      userId,
      dramaId,
      episodeId,
      progressSeconds,
      isCompleted,
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
      userId,
      dramaId,
      episodeId,
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
