/**
 * Cron endpoint: Sync Dramas
 * Triggered by Vercel Cron every 2 hours
 */

import { NextResponse } from 'next/server';
import { syncHomeDramas } from '@/jobs/sync-home-dramas';
import { logger, generateRequestId } from '@/lib/observability/logger';
import { isProduction } from '@/lib/config/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Security check: Verify cron secret in production
    if (isProduction()) {
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET || ''}`;

        if (!authHeader || authHeader !== expectedAuth) {
            logger.warn('cron_unauthorized', {
                requestId,
                endpoint: 'sync-dramas',
            });

            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
    }

    try {
        logger.info('cron_sync_dramas_started', { requestId });

        await syncHomeDramas();

        const latencyMs = Date.now() - startTime;
        logger.info('cron_sync_dramas_completed', {
            requestId,
            latencyMs,
        });

        return NextResponse.json({
            success: true,
            message: 'Dramas synced successfully',
            latencyMs,
        });
    } catch (error) {
        const latencyMs = Date.now() - startTime;

        logger.error('cron_sync_dramas_failed', {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
            latencyMs,
        });

        return NextResponse.json(
            {
                success: false,
                error: 'Sync failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}