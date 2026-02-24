import { getSupabaseClient } from '../lib/db/client';
import { providerCatalog } from '../lib/providers/catalog';
import { getAdapter } from '../lib/providers/adapters';
import { createCaptainClient } from '../lib/http/captain-client';
import { getRateLimiter } from '../lib/rate-limit/upstash';
import { logger } from '../lib/observability/logger';
import { getServerEnv, preflightEnvCheck } from '../lib/config/env';
import type { DramaCard } from '../lib/types';

// Initialize captain client lazily to allow env validation first
let captainClientInstance: ReturnType<typeof createCaptainClient> | null = null;

function getCaptainClient() {
  if (!captainClientInstance) {
    const env = getServerEnv();
    captainClientInstance = createCaptainClient(env.CAPTAIN_API_TOKEN);
  }
  return captainClientInstance;
}

export async function syncHomeDramas(): Promise<void> {
  const supabase = getSupabaseClient();
  const limiter = getRateLimiter();

  try {
    // Get active providers that have adapters (prioritize providers we can actually parse)
    const allActive = providerCatalog.getActiveProviders()
      .filter(p => p.status === 'active');

    // Prioritize providers that have registered adapters
    const withAdapters = allActive.filter(p => getAdapter(p.slug));
    const withoutAdapters = allActive.filter(p => !getAdapter(p.slug));
    const activeProviders = [...withAdapters, ...withoutAdapters].slice(0, 10);

    logger.info('sync_home_providers_selected', {
      total: allActive.length,
      withAdapters: withAdapters.map(p => p.slug),
      selected: activeProviders.map(p => p.slug),
    });

    for (const provider of activeProviders) {
      const limitCheck = await limiter.checkBoth(provider.slug);
      if (!limitCheck.global.success || !limitCheck.provider.success) {
        logger.warn('sync_home_rate_limited', { provider: provider.slug });
        continue;
      }

      // Some providers need path params for their home-like endpoints
      const defaultHomeParams: Record<string, Record<string, string>> = {
        flextv: { name: 'Fokus' },
      };

      const resolved = providerCatalog.resolveEndpoint(
        provider.slug,
        'home',
        defaultHomeParams[provider.slug] || {}
      );

      if (!resolved) {
        logger.warn('sync_home_no_endpoint', { provider: provider.slug });
        continue;
      }

      const response = await getCaptainClient().get(resolved.url, {
        provider: provider.slug,
        requestId: `sync-home-${Date.now()}`,
      });

      const adapter = getAdapter(provider.slug);
      if (!adapter) {
        logger.warn('sync_home_no_adapter', { provider: provider.slug });
        continue;
      }

      // Pass the raw Captain+provider response to the adapter
      // Each adapter handles its own response structure unwrapping
      const providerData = response.data;

      let dramas: DramaCard[];
      try {
        dramas = adapter.mapHome(providerData);
      } catch (mapErr) {
        logger.error('sync_home_adapter_map_failed', {
          provider: provider.slug,
          error: mapErr instanceof Error ? mapErr.message : 'Unknown',
        });
        continue;
      }

      for (const drama of dramas) {
        const { error } = await supabase
          .from('dramas')
          .upsert({
            provider_slug: drama.providerSlug,
            provider_drama_id: drama.providerDramaId,
            title: drama.title,
            cover_url: drama.coverUrl,
            episode_count: drama.episodeCount,
            is_premium: drama.isPremium,
            popularity_score: drama.rating || 0,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'provider_slug,provider_drama_id',
          });

        if (error) {
          logger.error('sync_home_drama_failed', {
            provider: provider.slug,
            dramaId: drama.providerDramaId,
            error: error.message,
          });
        }
      }

      logger.info('sync_home_provider_completed', {
        provider: provider.slug,
        count: dramas.length,
      });
    }

    logger.info('sync_home_completed', {
      providerCount: activeProviders.length,
    });
  } catch (error) {
    logger.error('sync_home_failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

if (require.main === module) {
  // Preflight env validation - fail fast with clear errors
  const preflight = preflightEnvCheck();
  if (!preflight.success) {
    console.error('Environment validation failed:');
    preflight.errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }

  syncHomeDramas().catch(console.error);
}
