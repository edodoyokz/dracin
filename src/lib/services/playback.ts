import { createCaptainClient } from '../http/captain-client';
import { providerCatalog } from '../providers/catalog';
import { getAdapter } from '../providers/adapters';
import { getRateLimiter } from '../rate-limit/upstash';
import { logger } from '../observability/logger';
import type { PlaybackResponse } from '../types';

const captainToken = process.env.CAPTAIN_API_TOKEN || '';
const captainClient = createCaptainClient(captainToken);

export async function getPlaybackUrl(
  providerSlug: string,
  providerDramaId: string,
  providerEpisodeId: string,
  requestId: string
): Promise<PlaybackResponse> {
  const limiter = getRateLimiter();

  const limitCheck = await limiter.checkBoth(providerSlug);
  if (!limitCheck.global.success || !limitCheck.provider.success) {
    throw new Error('RATE_LIMITED');
  }

  const resolved = providerCatalog.resolveEndpoint(
    providerSlug,
    'playback',
    {
      id: providerDramaId,
      code: providerDramaId,
      bookId: providerDramaId,
      dramaId: providerDramaId,
      seriesId: providerDramaId,
      playletId: providerDramaId,
      vid: providerDramaId,
      series_id: providerDramaId,
      episode: providerEpisodeId,
      chapterId: providerEpisodeId,
      chapter: providerEpisodeId,
      ep: providerEpisodeId,
      section_id: providerEpisodeId,
    }
  );

  if (!resolved) {
    throw new Error('PLAYBACK_ENDPOINT_NOT_FOUND');
  }

  logger.info('playback_resolved', {
    requestId,
    provider: providerSlug,
    url: resolved.url,
  });

  const response = await captainClient.get(resolved.url, {
    provider: providerSlug,
    requestId,
    timeout: 15000,
  });

  const adapter = getAdapter(providerSlug);
  if (!adapter) {
    throw new Error('ADAPTER_NOT_FOUND');
  }

  return adapter.mapPlayback(response.data);
}
