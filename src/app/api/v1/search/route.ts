import { NextResponse } from 'next/server';
import { searchAcrossProviders } from '@/lib/services/search';
import { getCacheManager, createSearchKey, CACHE_TTL } from '@/lib/cache/redis';
import { providerCatalog } from '@/lib/providers/catalog';
import { logger, generateRequestId } from '@/lib/observability/logger';
import { validateSearchParams, searchRequestSchema } from '@/lib/validation/schemas';
import type { ApiResponse, DramaCard } from '@/lib/types';

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
  const validation = validateSearchParams(searchParams, searchRequestSchema);

  if (!validation.success) {
    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: validation.error,
    };
    return NextResponse.json(response, { status: 400 });
  }

  const { q: query, page } = validation.data;

  try {
    const cache = getCacheManager();
    const cacheKey = createSearchKey(query, page);

    const cached = await cache.get<DramaCard[]>(cacheKey);
    if (cached) {
      logger.info('search_cache_hit', { requestId, query, page });

      const response: ApiResponse<DramaCard[]> = {
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

    logger.info('search_cache_miss', { requestId, query, page });

    const activeProviders = providerCatalog.getActiveProviders()
      .filter(p => {
        const caps = providerCatalog.getCapabilities(p.slug);
        return caps?.supportsSearch ?? false;
      })
      .map(p => p.slug)
      .slice(0, 10);

    const results = await searchAcrossProviders(query, activeProviders, requestId);

    await cache.set(cacheKey, results, CACHE_TTL.SEARCH);

    const response: ApiResponse<DramaCard[]> = {
      data: results,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        cache: 'miss',
        pagination: {
          page,
          pageSize: results.length,
          total: results.length,
        },
      },
      error: null,
    };

    logger.info('search_completed', {
      requestId,
      query,
      count: results.length,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('search_failed', {
      requestId,
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime,
    });

    const response: ApiResponse<null> = {
      data: null,
      meta: { requestId, timestamp: new Date().toISOString() },
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Search failed',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
