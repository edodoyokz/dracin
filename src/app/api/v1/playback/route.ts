import { NextResponse } from 'next/server';
import { getPlaybackUrl } from '@/lib/services/playback';
import { checkEntitlement } from '@/lib/db/subscriptions';
import { getCacheManager, createPlaybackKey, CACHE_TTL } from '@/lib/cache/redis';
import { logger, generateRequestId } from '@/lib/observability/logger';
import { validateSearchParams, playbackRequestSchema } from '@/lib/validation/schemas';
import type { ApiResponse, PlaybackResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Handle OPTIONS for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const { searchParams } = new URL(request.url);

  // Validate input parameters
  const validation = validateSearchParams(searchParams, playbackRequestSchema);

  if (!validation.success) {
    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: validation.error,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const { provider, drama: dramaId, episode: episodeId, userId } = validation.data;

  try {
    const cache = getCacheManager();
    const cacheKey = createPlaybackKey(provider, dramaId, episodeId);

    const cached = await cache.get<PlaybackResponse>(cacheKey);
    if (cached) {
      logger.info('playback_cache_hit', { requestId, provider, dramaId, episodeId });

      const response: ApiResponse<PlaybackResponse> = {
        data: cached,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          cache: 'hit',
        },
        error: null,
      };
      return NextResponse.json(response);
    }

    const entitlement = await checkEntitlement(userId, dramaId);
    if (!entitlement.allowed) {
      logger.warn('playback_entitlement_denied', {
        requestId,
        userId,
        dramaId,
        reason: entitlement.reason,
      });

      const response: ApiResponse<null> = {
        data: null,
        meta: { requestId, timestamp: new Date().toISOString() },
        error: {
          code: 'FORBIDDEN_SUBSCRIPTION',
          message: entitlement.reason || 'Access denied',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    logger.info('playback_entitlement_allowed', { requestId, userId, dramaId });

    const playback = await getPlaybackUrl(provider, dramaId, episodeId, requestId);

    await cache.set(cacheKey, playback, CACHE_TTL.PLAYBACK);

    const response: ApiResponse<PlaybackResponse> = {
      data: playback,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        cache: 'miss',
      },
      error: null,
    };

    logger.info('playback_completed', {
      requestId,
      provider,
      dramaId,
      episodeId,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('playback_failed', {
      requestId,
      provider,
      dramaId,
      episodeId,
      error: errorMessage,
      latencyMs: Date.now() - startTime,
    });

    const errorCode = errorMessage === 'RATE_LIMITED' ? 'RATE_LIMITED' :
      errorMessage === 'PLAYBACK_ENDPOINT_NOT_FOUND' ? 'PROVIDER_UNAVAILABLE' :
        'INTERNAL_ERROR';

    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: {
        code: errorCode,
        message: errorMessage === 'RATE_LIMITED' ? 'Rate limit exceeded, please try again' : 'Playback failed',
      },
    };

    return NextResponse.json(response, {
      status: errorCode === 'RATE_LIMITED' ? 429 : 500
    });
  }
}
