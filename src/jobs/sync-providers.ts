import { getSupabaseClient } from '../lib/db/client';
import { providerCatalog } from '../lib/providers/catalog';
import { logger } from '../lib/observability/logger';

export async function syncProviders(): Promise<void> {
  const supabase = getSupabaseClient();
  const providers = providerCatalog.getAllProviders();

  logger.info('sync_providers_started', { count: providers.length });

  for (const provider of providers) {
    try {
      const { error } = await supabase
        .from('providers')
        .upsert({
          slug: provider.slug,
          name: provider.provider,
          vip_group: provider.vip,
          status: provider.status,
          endpoints: provider.endpoints,
          capabilities: provider.capabilities,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'slug',
        });

      if (error) {
        logger.error('sync_provider_failed', {
          provider: provider.slug,
          error: error.message,
        });
      } else {
        logger.info('sync_provider_success', { provider: provider.slug });
      }
    } catch (error) {
      logger.error('sync_provider_exception', {
        provider: provider.slug,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  logger.info('sync_providers_completed');
}

if (require.main === module) {
  syncProviders().catch(console.error);
}
