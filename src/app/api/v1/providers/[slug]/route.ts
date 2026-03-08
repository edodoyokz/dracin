import { NextResponse } from 'next/server';
import { createCaptainClient } from '@/lib/http/captain-client';
import { providerCatalog } from '@/lib/providers/catalog';
import { getAdapter } from '@/lib/providers/adapters';
import { getCacheManager } from '@/lib/cache/redis';
import { getProviderBySlug, getDramasByProvider, getProviderGenres, assessProviderCatalogCompleteness } from '@/lib/db/providers-db';
import { logger, generateRequestId } from '@/lib/observability/logger';
import type { ApiResponse, DramaCard } from '@/lib/types';

export interface ProviderResponse {
    provider: {
        id: string;
        name: string;
        slug: string;
        logoUrl?: string;
        rating: number;
        dramaCount: number;
        episodeCount: number;
        websiteUrl?: string;
        description?: string;
    };
    dramas: DramaCard[];
    genres: string[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
}

export const dynamic = 'force-dynamic';

function pickPreferredDrama(existing: DramaCard, incoming: DramaCard): DramaCard {
    const existingScore = (existing.episodeCount > 0 ? 2 : 0) + (existing.coverUrl ? 1 : 0) + (existing.rating ? 1 : 0);
    const incomingScore = (incoming.episodeCount > 0 ? 2 : 0) + (incoming.coverUrl ? 1 : 0) + (incoming.rating ? 1 : 0);
    return incomingScore > existingScore ? incoming : existing;
}

function normalizeDramaCard(drama: DramaCard, slug: string): DramaCard {
    const normalizedEpisodeCount = slug === 'netshort'
        ? Math.max(1, Number.isFinite(drama.episodeCount) ? drama.episodeCount : 0)
        : Math.max(0, Number.isFinite(drama.episodeCount) ? drama.episodeCount : 0);

    return {
        ...drama,
        episodeCount: normalizedEpisodeCount,
    };
}

function mergeAndDedupeDramas(dbDramas: DramaCard[], upstreamDramas: DramaCard[], slug: string): DramaCard[] {
    const byProviderDramaId = new Map<string, DramaCard>();

    for (const drama of [...dbDramas, ...upstreamDramas]) {
        const normalized = normalizeDramaCard(drama, slug);
        const key = `${normalized.providerSlug}:${normalized.providerDramaId}`;
        const existing = byProviderDramaId.get(key);
        byProviderDramaId.set(key, existing ? pickPreferredDrama(existing, normalized) : normalized);
    }

    return Array.from(byProviderDramaId.values());
}

const NETSHORT_CATALOG_CACHE_TTL_SECONDS = 60 * 60;

function sortDramasForProvider(dramas: DramaCard[]): DramaCard[] {
    return [...dramas].sort((a, b) => {
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return b.providerDramaId.localeCompare(a.providerDramaId);
    });
}

function applyGenreFilter(dramas: DramaCard[], genre?: string): DramaCard[] {
    if (!genre || genre === 'all') return dramas;
    const normalizedGenre = genre.toLowerCase();
    return dramas.filter(drama => drama.tags.some(tag => tag.toLowerCase() === normalizedGenre));
}

async function fetchProviderFallbackPage(params: {
    slug: string;
    page: number;
    limit: number;
    requestId: string;
    overrideUrl?: string;
}): Promise<DramaCard[]> {
    const { slug, page, limit, requestId, overrideUrl } = params;

    const token = process.env.CAPTAIN_API_TOKEN;
    if (!token) {
        return [];
    }

    let upstreamUrl = overrideUrl || '';

    if (!upstreamUrl) {
        const resolved = providerCatalog.resolveEndpoint(slug, 'home', {
            page: String(page),
            p: String(page),
            current: String(page),
            limit: String(limit),
            size: String(limit),
            pageSize: String(limit),
        });

        if (!resolved || resolved.missingParams.length > 0) {
            return [];
        }

        upstreamUrl = resolved.url;
    }

    const url = new URL(upstreamUrl);

    if (slug === 'goodshort') {
        if (!url.searchParams.has('page')) url.searchParams.set('page', String(page));
        if (!url.searchParams.has('p')) url.searchParams.set('p', String(page));
        if (!url.searchParams.has('current')) url.searchParams.set('current', String(page));
        if (!url.searchParams.has('limit')) url.searchParams.set('limit', String(limit));
        if (!url.searchParams.has('size')) url.searchParams.set('size', String(limit));
        if (!url.searchParams.has('pageSize')) url.searchParams.set('pageSize', String(limit));
        if (!url.searchParams.has('channelId')) url.searchParams.set('channelId', '562');
    }

    if (slug === 'netshort') {
        if (!url.searchParams.has('page')) url.searchParams.set('page', String(page));
        if (!url.searchParams.has('current')) url.searchParams.set('current', String(page));
        if (!url.searchParams.has('pageSize')) url.searchParams.set('pageSize', String(limit));
        if (!url.searchParams.has('limit')) url.searchParams.set('limit', String(limit));
        if (!url.searchParams.has('size')) url.searchParams.set('size', String(limit));
        if (!url.searchParams.has('type')) url.searchParams.set('type', 'all');
    }

    upstreamUrl = url.toString();

    const client = createCaptainClient(token);
    const response = await client.get(upstreamUrl, {
        provider: slug,
        requestId,
    });

    const adapter = getAdapter(slug);
    if (!adapter) {
        return [];
    }

    return adapter.mapHome(response.data);
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, { status: 204 });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const { slug } = await params;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const genre = searchParams.get('genre') || undefined;

    try {
        const provider = await getProviderBySlug(slug);

        if (!provider) {
            const response: ApiResponse<null> = {
                data: null,
                meta: { requestId, timestamp: new Date().toISOString() },
                error: {
                    code: 'NOT_FOUND',
                    message: `Provider with slug ${slug} not found`,
                },
            };

            return NextResponse.json(response, { status: 404 });
        }

        const [dbResult, genresResult] = await Promise.allSettled([
            getDramasByProvider(slug, page, limit, genre),
            getProviderGenres(slug),
        ]);

        const genres = genresResult.status === 'fulfilled' ? genresResult.value : [];
        const dbFetchFailed = dbResult.status === 'rejected';
        const dbDramas = dbResult.status === 'fulfilled' ? dbResult.value.dramas : [];
        const dbTotal = dbResult.status === 'fulfilled' ? dbResult.value.total : 0;

        if (dbFetchFailed) {
            logger.warn('provider_db_fetch_failed_fallbacking', {
                requestId,
                slug,
                page,
                limit,
                error: dbResult.reason instanceof Error ? dbResult.reason.message : 'unknown',
            });
        }

        const shouldConsiderFallback = ['goodshort', 'netshort'].includes(slug);
        const completeness = assessProviderCatalogCompleteness({
            providerSlug: slug,
            providerStatus: provider.status,
            page,
            limit,
            pageCount: dbDramas.length,
            total: dbTotal,
        });

        const shouldUseFallback = shouldConsiderFallback && (dbFetchFailed || completeness.isPossiblyIncomplete);

        let dramas = dbDramas.map(drama => normalizeDramaCard(drama, slug));
        let total = dbTotal;
        let hasMore = page * limit < total;

        if (shouldUseFallback) {
            let upstreamResults: DramaCard[] = [];

            if (slug === 'netshort') {
                let cache: ReturnType<typeof getCacheManager> | null = null;
                try {
                    cache = getCacheManager();
                } catch {
                    cache = null;
                }

                const cacheKey = `provider:netshort:catalog:v2:limit:${limit}`;
                const cached = cache ? await cache.get<DramaCard[]>(cacheKey) : null;

                if (cached && cached.length > 0) {
                    upstreamResults = cached;
                } else {
                    const maxFallbackPages = 4;
                    const endpointTemplates = [
                        '/api/v1/feed/:page',
                        '/api/v1/explore/:page',
                        '/api/v1/new-dubbing/:page',
                        '/api/v1/vip-up/:page',
                    ];
                    const providerMeta = typeof (providerCatalog as { getProvider?: (providerSlug: string) => { baseUrl?: string } | undefined }).getProvider === 'function'
                        ? (providerCatalog as { getProvider: (providerSlug: string) => { baseUrl?: string } | undefined }).getProvider(slug)
                        : undefined;
                    const baseUrl = providerMeta?.baseUrl || 'https://api.netshort.com';

                    const upstreamUnion: DramaCard[] = [];
                    for (const endpointTemplate of endpointTemplates) {
                        for (let index = 0; index < maxFallbackPages; index++) {
                            const upstreamPage = 1 + index;
                            const url = `${baseUrl}${endpointTemplate.replace(':page', String(upstreamPage))}`;

                            try {
                                const pageItems = await fetchProviderFallbackPage({
                                    slug,
                                    page: upstreamPage,
                                    limit,
                                    requestId,
                                    overrideUrl: url,
                                });

                                if (pageItems.length === 0) {
                                    break;
                                }

                                upstreamUnion.push(...pageItems);
                            } catch (error) {
                                logger.warn('provider_netshort_fallback_page_failed', {
                                    requestId,
                                    slug,
                                    url,
                                    page: upstreamPage,
                                    error: error instanceof Error ? error.message : 'unknown',
                                });
                                break;
                            }
                        }
                    }

                    upstreamResults = mergeAndDedupeDramas([], upstreamUnion, slug);
                    if (upstreamResults.length > 0 && cache) {
                        await cache.set(cacheKey, upstreamResults, NETSHORT_CATALOG_CACHE_TTL_SECONDS);
                    }
                }
            } else {
                const maxFallbackPages = 4;
                const upstreamPages = Array.from({ length: maxFallbackPages }, (_, index) => (page - 1) + index + 1);
                const aggregated: DramaCard[] = [];

                for (const upstreamPage of upstreamPages) {
                    try {
                        const pageItems = await fetchProviderFallbackPage({
                            slug,
                            page: upstreamPage,
                            limit,
                            requestId,
                        });

                        if (pageItems.length === 0) {
                            break;
                        }

                        aggregated.push(...pageItems);
                    } catch (error) {
                        logger.warn('provider_fallback_page_failed', {
                            requestId,
                            slug,
                            page: upstreamPage,
                            error: error instanceof Error ? error.message : 'unknown',
                        });
                        break;
                    }
                }

                upstreamResults = aggregated;
            }

            const merged = applyGenreFilter(
                sortDramasForProvider(mergeAndDedupeDramas(dbDramas, upstreamResults, slug)),
                genre
            );

            const startIndex = Math.max(0, (page - 1) * limit);
            dramas = merged.slice(startIndex, startIndex + limit);
            total = Math.max(dbTotal, merged.length);
            hasMore = startIndex + limit < total;

            logger.info('provider_fallback_applied', {
                requestId,
                slug,
                page,
                limit,
                dbCount: dbDramas.length,
                upstreamCount: upstreamResults.length,
                mergedCount: merged.length,
                reason: dbFetchFailed ? 'db_fetch_failed' : completeness.reason,
            });
        }

        const response: ApiResponse<ProviderResponse> = {
            data: {
                provider: {
                    id: provider.id,
                    name: provider.name,
                    slug: provider.slug,
                    logoUrl: provider.logoUrl,
                    rating: provider.rating,
                    dramaCount: provider.dramaCount,
                    episodeCount: provider.episodeCount,
                    websiteUrl: provider.websiteUrl,
                    description: provider.description,
                },
                dramas,
                genres,
                pagination: {
                    page,
                    limit,
                    total,
                    hasMore,
                },
            },
            meta: {
                requestId,
                timestamp: new Date().toISOString(),
            },
            error: null,
        };

        logger.info('provider_fetched', {
            requestId,
            slug,
            dramaCount: dramas.length,
            total,
            latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(response);
    } catch (error) {
        logger.error('provider_fetch_failed', {
            requestId,
            slug,
            error: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - startTime,
        });

        const response: ApiResponse<null> = {
            data: null,
            meta: { requestId, timestamp: new Date().toISOString() },
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch provider',
            },
        };

        return NextResponse.json(response, { status: 500 });
    }
}
