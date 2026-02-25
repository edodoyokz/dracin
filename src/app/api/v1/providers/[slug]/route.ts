import { NextResponse } from 'next/server';
import { getProviderBySlug, getDramasByProvider, getProviderGenres } from '@/lib/db/providers-db';
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const genre = searchParams.get('genre') || undefined;

    try {
        // Get provider info
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

        // Get dramas and genres for this provider in parallel
        const [{ dramas, total }, genres] = await Promise.all([
            getDramasByProvider(slug, page, limit, genre),
            getProviderGenres(slug),
        ]);

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
                    hasMore: page * limit < total,
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
