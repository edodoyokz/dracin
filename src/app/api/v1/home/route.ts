import { NextResponse } from 'next/server';
import { getHomeDramas } from '@/lib/db/dramas';
import { logger, generateRequestId } from '@/lib/observability/logger';
import { preflightEnvCheck } from '@/lib/config/env';
import type { ApiResponse, DramaCard } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Preflight environment check to catch configuration issues early
  const envCheck = preflightEnvCheck();
  if (!envCheck.success) {
    console.error(`[${requestId}] Environment validation failed:`, envCheck.errors);
    logger.error('home_env_validation_failed', {
      requestId,
      errors: envCheck.errors,
      missingVars: envCheck.missingVars,
    });

    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: {
        code: 'VALIDATION_ERROR',
        message: `Environment configuration error: ${envCheck.missingVars.join(', ')}`,
      },
    };
    return NextResponse.json(response, { status: 500 });
  }

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('home_fetch_failed', {
      requestId,
      error: errorMessage,
      errorStack,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      latencyMs: Date.now() - startTime,
    });

    // Log to console for immediate visibility during debugging
    console.error(`[${requestId}] Home fetch failed:`, errorMessage);
    if (errorStack) {
      console.error(`[${requestId}] Stack trace:`, errorStack);
    }

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
