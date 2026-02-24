import { Redis } from '@upstash/redis';

export class CacheManager {
  private redis: Redis;

  constructor(redisUrl: string, redisToken: string) {
    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value as T | null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, { ex: ttlSeconds });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
}

export function createSearchKey(query: string, page: number): string {
  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');
  return `search:v1:${normalizedQuery}:page:${page}`;
}

export function createPlaybackKey(provider: string, dramaId: string, episodeId: string): string {
  return `playback:v1:${provider}:${dramaId}:${episodeId}`;
}

export function createProviderCatalogKey(): string {
  return 'provider:catalog';
}

export function createDramaEpisodesKey(dramaId: string): string {
  return `drama:${dramaId}:episodes`;
}

export const CACHE_TTL = {
  SEARCH: 86400,
  PLAYBACK: 90,
  PROVIDER_CATALOG: 3600,
  EPISODES: 7200,
} as const;

let cacheInstance: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheInstance) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      throw new Error('Redis environment variables not configured');
    }

    cacheInstance = new CacheManager(redisUrl, redisToken);
  }

  return cacheInstance;
}
