import { getSupabaseClient } from '../lib/db/client';
import { getDramaByProviderId } from '../lib/db/dramas';
import { providerCatalog } from '../lib/providers/catalog';
import { getAdapter } from '../lib/providers/adapters';
import { createCaptainClient } from '../lib/http/captain-client';
import { getRateLimiter } from '../lib/rate-limit/upstash';
import { logger } from '../lib/observability/logger';
import type { EpisodeItem } from '../lib/types';

const captainToken = process.env.CAPTAIN_API_TOKEN || '';
const captainClient = createCaptainClient(captainToken);

export async function syncEpisodes(
  providerSlug: string,
  providerDramaId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const limiter = getRateLimiter();

  try {
    const limitCheck = await limiter.checkBoth(providerSlug);
    if (!limitCheck.global.success || !limitCheck.provider.success) {
      logger.warn('sync_episodes_rate_limited', { provider: providerSlug, dramaId: providerDramaId });
      return;
    }

    const resolved = providerCatalog.resolveEndpoint(providerSlug, 'episodes', {
      id: providerDramaId,
    });

    if (!resolved) {
      logger.warn('sync_episodes_no_endpoint', { provider: providerSlug, dramaId: providerDramaId });
      return;
    }

    const response = await captainClient.get(resolved.url, {
      provider: providerSlug,
      requestId: `sync-ep-${Date.now()}`,
    });

    const adapter = getAdapter(providerSlug);
    if (!adapter) {
      logger.warn('sync_episodes_no_adapter', { provider: providerSlug });
      return;
    }

    const episodes: EpisodeItem[] = adapter.mapEpisodes(response.data);

    const drama = await getDramaByProviderId(providerSlug, providerDramaId);
    if (!drama) {
      logger.warn('sync_episodes_drama_not_found', { provider: providerSlug, dramaId: providerDramaId });
      return;
    }

    for (const episode of episodes) {
      const { error } = await supabase
        .from('episodes')
        .upsert({
          drama_id: drama.id,
          provider_slug: providerSlug,
          provider_episode_id: episode.providerEpisodeId,
          episode_no: episode.episodeNo,
          chapter_id: episode.chapterId,
          slug: episode.slug,
          title: episode.title,
          duration_ms: episode.durationMs,
          is_locked: episode.isLocked,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'drama_id,episode_no',
        });

      if (error) {
        logger.error('sync_episode_failed', {
          provider: providerSlug,
          dramaId: providerDramaId,
          episodeNo: episode.episodeNo,
          error: error.message,
        });
      }
    }

    logger.info('sync_episodes_completed', {
      provider: providerSlug,
      dramaId: providerDramaId,
      count: episodes.length,
    });
  } catch (error) {
    logger.error('sync_episodes_failed', {
      provider: providerSlug,
      dramaId: providerDramaId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

if (require.main === module) {
  const [provider, dramaId] = process.argv.slice(2);
  if (!provider || !dramaId) {
    console.error('Usage: ts-node sync-episodes.ts <provider> <dramaId>');
    process.exit(1);
  }
  syncEpisodes(provider, dramaId).catch(console.error);
}
