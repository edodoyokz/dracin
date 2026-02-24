import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  action: 'allow' | 'deny';
}

export class RateLimiter {
  private redis: Redis;
  private globalLimit: number;
  private windowSeconds: number;
  private providerLimits: Map<string, number> = new Map();

  constructor(
    redisUrl: string,
    redisToken: string,
    globalLimit: number = 45,
    windowSeconds: number = 1
  ) {
    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    this.globalLimit = globalLimit;
    this.windowSeconds = windowSeconds;
  }

  setProviderLimit(provider: string, limit: number): void {
    this.providerLimits.set(provider, limit);
  }

  async checkGlobal(): Promise<RateLimitResult> {
    return this.checkLimit('global:outbound', this.globalLimit);
  }

  async checkProvider(provider: string): Promise<RateLimitResult> {
    const providerLimit = this.providerLimits.get(provider);
    if (!providerLimit) {
      return { success: true, limit: Infinity, remaining: Infinity, reset: 0, action: 'allow' };
    }
    return this.checkLimit(`provider:${provider}`, providerLimit);
  }

  private async checkLimit(key: string, limit: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const redisKey = `${key}:${windowStart}`;

    try {
      const current = await this.redis.incr(redisKey);
      
      if (current === 1) {
        await this.redis.pexpire(redisKey, windowMs);
      }

      const remaining = Math.max(0, limit - current);
      const reset = windowStart + windowMs;
      const success = current <= limit;

      return {
        success,
        limit,
        remaining,
        reset,
        action: success ? 'allow' : 'deny',
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      return { success: true, limit: Infinity, remaining: Infinity, reset: 0, action: 'allow' };
    }
  }

  async checkBoth(provider: string): Promise<{ global: RateLimitResult; provider: RateLimitResult }> {
    const [globalResult, providerResult] = await Promise.all([
      this.checkGlobal(),
      this.checkProvider(provider),
    ]);

    return { global: globalResult, provider: providerResult };
  }
}

let limiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!limiterInstance) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      throw new Error('Redis environment variables not configured');
    }

    limiterInstance = new RateLimiter(redisUrl, redisToken, 45, 1);
  }

  return limiterInstance;
}
