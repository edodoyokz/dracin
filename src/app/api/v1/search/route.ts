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

  const { q: query, page, providers, genres, sort, limit } = validation.data;

  try {
    const cache = getCacheManager();
    const cacheKey = createSearchKey(`${query}:${providers.join(',')}:${genres.join(',')}:${sort}:${limit}`, page);

    const cached = await cache.get<DramaCard[]>(cacheKey);
    if (cached) {
      logger.info('search_cache_hit', { requestId, query, page, providers, genres, sort });

      const response: ApiResponse<DramaCard[]> = {
        data: cached,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          cache: 'hit',
          pagination: {
            page,
            pageSize: cached.length,
            total: cached.length,
          },
        },
        error: null,
      };
      return NextResponse.json(response);
    }

    logger.info('search_cache_miss', { requestId, query, page, providers, genres, sort });

    // Filter providers if specified
    let activeProviders = providerCatalog.getActiveProviders()
      .filter(p => {
        const caps = providerCatalog.getCapabilities(p.slug);
        return caps?.supportsSearch ?? false;
      })
      .map(p => p.slug);

    // Apply provider filter if specified
    if (providers.length > 0) {
      activeProviders = activeProviders.filter(p => providers.includes(p));
    }

    // Limit providers to prevent overloading
    activeProviders = activeProviders.slice(0, 10);

    let results = await searchAcrossProviders(query, activeProviders, requestId);

    // Apply genre filter client-side (since provider APIs don't support genre filtering)
    if (genres.length > 0) {
      results = results.filter(drama =>
        genres.some(g =>
          drama.tags.some(tag => tag.toLowerCase() === g.toLowerCase())
        )
      );
    }

    // Apply sorting
    switch (sort) {
      case 'rating':
        results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
        results.sort((a, b) => b.id.localeCompare(a.id));
        break;
      case 'popular':
        results.sort((a, b) => b.episodeCount - a.episodeCount);
        break;
      case 'relevance':
      default:
        // Keep original order
        break;
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedResults = results.slice(startIndex, startIndex + limit);

    await cache.set(cacheKey, paginatedResults, CACHE_TTL.SEARCH);

    const response: ApiResponse<DramaCard[]> = {
      data: paginatedResults,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        cache: 'miss',
        pagination: {
          page,
          pageSize: paginatedResults.length,
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
