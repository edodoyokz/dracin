import { createCaptainClient } from '../http/captain-client';
import { providerCatalog } from '../providers/catalog';
import { getAdapter } from '../providers/adapters';
import { getRateLimiter } from '../rate-limit/upstash';
import { logger } from '../observability/logger';
import type { DramaCard, Intent } from '../types';

const captainToken = process.env.CAPTAIN_API_TOKEN || '';
const captainClient = createCaptainClient(captainToken);

export async function searchAcrossProviders(
  query: string,
  providerSlugs: string[],
  requestId: string
): Promise<DramaCard[]> {
  const results: DramaCard[] = [];
  const limiter = getRateLimiter();

  for (const slug of providerSlugs) {
    try {
      const resolved = providerCatalog.resolveEndpoint(slug, 'search', { q: query });
      if (!resolved || resolved.missingParams.length > 0) {
        continue;
      }

      const limitCheck = await limiter.checkBoth(slug);
      if (!limitCheck.global.success || !limitCheck.provider.success) {
        logger.warn('search_rate_limited', { requestId, provider: slug });
        continue;
      }

      const response = await captainClient.get(resolved.url, {
        provider: slug,
        requestId,
      });

      const adapter = getAdapter(slug);
      if (adapter) {
        const dramas = adapter.mapSearch(response.data);
        results.push(...dramas);
      }
    } catch (error) {
      logger.error('search_provider_failed', {
        requestId,
        provider: slug,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  return results;
}
