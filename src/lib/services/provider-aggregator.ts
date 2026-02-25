import { createCaptainClient } from '../http/captain-client';
import { providerCatalog } from '../providers/catalog';
import { getAdapter } from '../providers/adapters';
import { getRateLimiter } from '../rate-limit/upstash';
import { logger } from '../observability/logger';
import type { DramaCard, Intent, ProviderInfo } from '../types';

const captainToken = process.env.CAPTAIN_API_TOKEN || '';
const captainClient = createCaptainClient(captainToken);

export interface AggregatedResult {
  provider: string;
  providerName: string;
  dramas: DramaCard[];
  success: boolean;
  error?: string;
  latencyMs: number;
}

export interface ProviderFetchOptions {
  maxProviders?: number;
  timeoutMs?: number;
  shuffle?: boolean;
  requestId: string;
}

const DEFAULT_OPTIONS: Partial<ProviderFetchOptions> = {
  maxProviders: 20,
  timeoutMs: 8000,
  shuffle: true,
};

/**
 * Fetch home/featured content from multiple providers in parallel
 * with graceful degradation for failed providers.
 */
export async function fetchHomeFromProviders(
  options: ProviderFetchOptions
): Promise<AggregatedResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const activeProviders = providerCatalog.getActiveProviders();

  // Select providers to fetch from
  let providersToFetch = activeProviders;
  if (opts.shuffle) {
    providersToFetch = [...activeProviders].sort(() => Math.random() - 0.5);
  }
  if (opts.maxProviders && opts.maxProviders < providersToFetch.length) {
    providersToFetch = providersToFetch.slice(0, opts.maxProviders);
  }

  const limiter = getRateLimiter();
  const results: AggregatedResult[] = [];

  // Fetch from all providers in parallel with individual timeouts
  const fetchPromises = providersToFetch.map(async (provider) => {
    const startTime = Date.now();

    try {
      // Check rate limits
      const limitCheck = await limiter.checkBoth(provider.slug);
      if (!limitCheck.global.success || !limitCheck.provider.success) {
        logger.warn('provider_rate_limited', {
          requestId: opts.requestId,
          provider: provider.slug,
        });
        return {
          provider: provider.slug,
          providerName: provider.provider,
          dramas: [],
          success: false,
          error: 'rate_limited',
          latencyMs: Date.now() - startTime,
        };
      }

      // Resolve home endpoint
      const resolved = providerCatalog.resolveEndpoint(provider.slug, 'home');
      if (!resolved) {
        return {
          provider: provider.slug,
          providerName: provider.provider,
          dramas: [],
          success: false,
          error: 'no_home_endpoint',
          latencyMs: Date.now() - startTime,
        };
      }

      // Fetch with timeout
      const response = await Promise.race([
        captainClient.get(resolved.url, {
          provider: provider.slug,
          requestId: opts.requestId,
          timeout: opts.timeoutMs,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), opts.timeoutMs)
        ),
      ]);

      // Map response using adapter
      const adapter = getAdapter(provider.slug);
      if (!adapter) {
        return {
          provider: provider.slug,
          providerName: provider.provider,
          dramas: [],
          success: false,
          error: 'no_adapter',
          latencyMs: Date.now() - startTime,
        };
      }

      const dramas = adapter.mapHome(response.data);

      logger.info('provider_home_success', {
        requestId: opts.requestId,
        provider: provider.slug,
        dramaCount: dramas.length,
        latencyMs: Date.now() - startTime,
      });

      return {
        provider: provider.slug,
        providerName: provider.provider,
        dramas,
        success: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('provider_home_failed', {
        requestId: opts.requestId,
        provider: provider.slug,
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      });

      return {
        provider: provider.slug,
        providerName: provider.provider,
        dramas: [],
        success: false,
        error: errorMessage,
        latencyMs: Date.now() - startTime,
      };
    }
  });

  const settledResults = await Promise.allSettled(fetchPromises);

  for (const result of settledResults) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    }
  }

  return results;
}

/**
 * Get provider info list for all active providers
 */
export function getAllProviderInfo(): ProviderInfo[] {
  const providers = providerCatalog.getActiveProviders();

  return providers.map(p => ({
    slug: p.slug,
    name: p.provider,
    contentCount: 0, // Will be populated from DB
    isNew: false,
  }));
}

/**
 * Fetch content from a specific provider by intent
 */
export async function fetchFromProvider(
  slug: string,
  intent: Intent,
  params: Record<string, string>,
  requestId: string
): Promise<DramaCard[] | null> {
  const startTime = Date.now();

  try {
    const resolved = providerCatalog.resolveEndpoint(slug, intent, params);
    if (!resolved || resolved.missingParams.length > 0) {
      logger.warn('provider_endpoint_not_found', {
        requestId,
        provider: slug,
        intent,
        params,
      });
      return null;
    }

    const limiter = getRateLimiter();
    const limitCheck = await limiter.checkBoth(slug);
    if (!limitCheck.global.success || !limitCheck.provider.success) {
      logger.warn('provider_rate_limited', { requestId, provider: slug });
      return null;
    }

    const response = await captainClient.get(resolved.url, {
      provider: slug,
      requestId,
    });

    const adapter = getAdapter(slug);
    if (!adapter) {
      logger.warn('provider_adapter_not_found', { requestId, provider: slug });
      return null;
    }

    let results: DramaCard[];

    switch (intent) {
      case 'home':
        results = adapter.mapHome(response.data);
        break;
      case 'search':
        results = adapter.mapSearch(response.data);
        break;
      default:
        return null;
    }

    logger.info('provider_fetch_success', {
      requestId,
      provider: slug,
      intent,
      resultCount: results.length,
      latencyMs: Date.now() - startTime,
    });

    return results;
  } catch (error) {
    logger.error('provider_fetch_failed', {
      requestId,
      provider: slug,
      intent,
      error: error instanceof Error ? error.message : 'Unknown',
      latencyMs: Date.now() - startTime,
    });
    return null;
  }
}

/**
 * Aggregate dramas from multiple providers with deduplication
 */
export async function aggregateDramas(
  providerSlugs: string[],
  intent: Intent,
  params: Record<string, string>,
  requestId: string,
  options: {
    maxResults?: number;
    shuffle?: boolean;
  } = {}
): Promise<DramaCard[]> {
  const { maxResults = 50, shuffle = true } = options;

  const fetchPromises = providerSlugs.map(slug =>
    fetchFromProvider(slug, intent, params, requestId)
  );

  const results = await Promise.allSettled(fetchPromises);

  const allDramas: DramaCard[] = [];
  const seenIds = new Set<string>();

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      for (const drama of result.value) {
        // Deduplicate by provider + drama ID
        const key = `${drama.providerSlug}:${drama.providerDramaId}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          allDramas.push(drama);
        }
      }
    }
  }

  if (shuffle) {
    allDramas.sort(() => Math.random() - 0.5);
  }

  return allDramas.slice(0, maxResults);
}
