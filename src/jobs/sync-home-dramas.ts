import { getSupabaseClient } from '../lib/db/client';
import { providerCatalog } from '../lib/providers/catalog';
import { getAdapter } from '../lib/providers/adapters';
import { createCaptainClient } from '../lib/http/captain-client';
import { getRateLimiter } from '../lib/rate-limit/upstash';
import { logger } from '../lib/observability/logger';
import type { DramaCard } from '../lib/types';

const captainToken = process.env.CAPTAIN_API_TOKEN || '';
const captainClient = createCaptainClient(captainToken);

export async function syncHomeDramas(): Promise<void> {
  const supabase = getSupabaseClient();
  const limiter = getRateLimiter();
  const activeProviders = providerCatalog.getActiveProviders();

  logger.info('sync_dramas_started', { providerCount: activeProviders.length });

  for (const provider of activeProviders) {
    try {
      const caps = providerCatalog.getCapabilities(provider.slug);
      if (!caps?.supportsHome) {
        logger.info('sync_dramas_skipped_no_home', { provider: provider.slug });
        continue;
      }

      const limitCheck = await limiter.checkBoth(provider.slug);
      if (!limitCheck.global.success || !limitCheck.provider.success) {
        logger.warn('sync_dramas_rate_limited', { provider: provider.slug });
        continue;
      }

      const resolved = providerCatalog.resolveEndpoint(provider.slug, 'home');
      if (!resolved) {
        logger.warn('sync_dramas_no_endpoint', { provider: provider.slug });
        continue;
      }

      const response = await captainClient.get(resolved.url, {
        provider: provider.slug,
        requestId: `sync-${Date.now()}`,
      });

      const adapter = getAdapter(provider.slug);
      if (!adapter) {
        logger.warn('sync_dramas_no_adapter', { provider: provider.slug });
        continue;
      }

      const dramas: DramaCard[] = adapter.mapHome(response.data);

      for (const drama of dramas) {
        const { error } = await supabase
          .from('dramas')
          .upsert({
            provider_slug: drama.providerSlug,
            provider_drama_id: drama.providerDramaId,
            title: drama.title,
            cover_url: drama.coverUrl,
            episode_count: drama.episodeCount,
            tags: drama.tags,
            is_premium: drama.isPremium,
            popularity_score: drama.rating,
            last_provider_update: new Date().toISOString(),
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'provider_slug,provider_drama_id',
          });

        if (error) {
          logger.error('sync_drama_failed', {
            provider: provider.slug,
            dramaId: drama.providerDramaId,
            error: error.message,
          });
        }
      }

      logger.info('sync_dramas_provider_completed', {
        provider: provider.slug,
        count: dramas.length,
      });
    } catch (error) {
      logger.error('sync_dramas_provider_failed', {
        provider: provider.slug,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  logger.info('sync_dramas_completed');
}

if (require.main === module) {
  syncHomeDramas().catch(console.error);
}
