import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getServerEnv, getRateLimitConfig } from '../config/env';

// Rate limit configuration from centralized env
function getRateLimits() {
  const config = getRateLimitConfig();
  return {
    globalRpm: config.globalRpm,
    providerRpm: config.providerRpm,
  };
}

// Redis client for rate limiting
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    // This will throw with clear error messages if env vars are missing
    const env = getServerEnv();
    redisClient = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redisClient;
}

// Global rate limiter (requests per minute from config)
let globalLimiter: Ratelimit | null = null;

function getGlobalLimiter(): Ratelimit {
  if (!globalLimiter) {
    const { globalRpm } = getRateLimits();
    globalLimiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(globalRpm, '1 m'),
      analytics: true,
      prefix: 'ratelimit:global',
    });
  }
  return globalLimiter;
}

// Per-provider rate limiter (requests per minute from config)
let providerLimiter: Ratelimit | null = null;

function getProviderLimiter(): Ratelimit {
  if (!providerLimiter) {
    const { providerRpm } = getRateLimits();
    providerLimiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.slidingWindow(providerRpm, '1 m'),
      analytics: true,
      prefix: 'ratelimit:provider',
    });
  }
  return providerLimiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}

export interface CombinedRateLimitResult {
  global: RateLimitResult;
  provider: RateLimitResult;
}

/**
 * Check both global and per-provider rate limits
 */
export async function checkBothLimits(
  providerSlug: string,
  identifier: string = 'global'
): Promise<CombinedRateLimitResult> {
  const [globalResult, providerResult] = await Promise.all([
    getGlobalLimiter().limit(identifier),
    getProviderLimiter().limit(`${providerSlug}:${identifier}`),
  ]);

  return {
    global: {
      success: globalResult.success,
      limit: globalResult.limit,
      remaining: globalResult.remaining,
      reset: new Date(globalResult.reset),
    },
    provider: {
      success: providerResult.success,
      limit: providerResult.limit,
      remaining: providerResult.remaining,
      reset: new Date(providerResult.reset),
    },
  };
}

/**
 * Get rate limiter instance with combined checks
 */
export function getRateLimiter() {
  return {
    checkBoth: checkBothLimits,
    checkGlobal: async (identifier: string = 'global'): Promise<RateLimitResult> => {
      const result = await getGlobalLimiter().limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset),
      };
    },
    checkProvider: async (providerSlug: string, identifier: string = 'global'): Promise<RateLimitResult> => {
      const result = await getProviderLimiter().limit(`${providerSlug}:${identifier}`);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset),
      };
    },
  };
}
