import { NextResponse } from 'next/server';
import { createCaptainClient } from '@/lib/http/captain-client';
import { providerCatalog } from '@/lib/providers/catalog';
import { getAdapter } from '@/lib/providers/adapters';
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

function mergeAndDedupeDramas(dbDramas: DramaCard[], upstreamDramas: DramaCard[]): DramaCard[] {
    const byProviderDramaId = new Map<string, DramaCard>();

    for (const drama of [...dbDramas, ...upstreamDramas]) {
        const key = `${drama.providerSlug}:${drama.providerDramaId}`;
        if (!byProviderDramaId.has(key)) {
            byProviderDramaId.set(key, drama);
        }
    }

    return Array.from(byProviderDramaId.values());
}

async function fetchProviderFallbackPage(params: {
    slug: string;
    page: number;
    limit: number;
    requestId: string;
}): Promise<DramaCard[]> {
    const { slug, page, limit, requestId } = params;

    const token = process.env.CAPTAIN_API_TOKEN;
    if (!token) {
        return [];
    }

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

    let upstreamUrl = resolved.url;
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
        if (!url.searchParams.has('pageSize')) url.searchParams.set('pageSize', String(limit));
        if (!url.searchParams.has('limit')) url.searchParams.set('limit', String(limit));
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

        const [{ dramas: dbDramas, total: dbTotal }, genres] = await Promise.all([
            getDramasByProvider(slug, page, limit, genre),
            getProviderGenres(slug),
        ]);

        let dramas = dbDramas;
        let total = dbTotal;
        let hasMore = page * limit < total;

        const completeness = assessProviderCatalogCompleteness({
            providerSlug: slug,
            providerStatus: provider.status,
            page,
            limit,
            pageCount: dbDramas.length,
            total: dbTotal,
        });

        if (completeness.isPossiblyIncomplete && ['goodshort', 'netshort'].includes(slug)) {
            const maxFallbackPages = 4;
            const upstreamPages = Array.from({ length: maxFallbackPages }, (_, index) => (page - 1) + index + 1);
            const upstreamResults: DramaCard[] = [];

            for (const upstreamPage of upstreamPages) {
                const pageItems = await fetchProviderFallbackPage({
                    slug,
                    page: upstreamPage,
                    limit,
                    requestId,
                });

                if (pageItems.length === 0) {
                    break;
                }

                upstreamResults.push(...pageItems);
            }

            const merged = mergeAndDedupeDramas(dbDramas, upstreamResults)
                .filter(drama => genre && genre !== 'all'
                    ? drama.tags.some(tag => tag.toLowerCase() === genre.toLowerCase())
                    : true
                );

            dramas = merged.slice(0, limit);
            total = Math.max(dbTotal, merged.length + ((page - 1) * limit));
            hasMore = merged.length > limit || page * limit < total;

            logger.info('provider_fallback_applied', {
                requestId,
                slug,
                page,
                limit,
                dbCount: dbDramas.length,
                upstreamCount: upstreamResults.length,
                mergedCount: merged.length,
                reason: completeness.reason,
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
