import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';
import { BaseProviderAdapter, type ProviderAdapter } from './base';

/**
 * Generic provider adapter with best-effort parsing and fallback mechanisms.
 * Handles multiple response patterns from different providers.
 */
export class GenericProviderAdapter extends BaseProviderAdapter implements ProviderAdapter {
  readonly name: string;
  readonly slug: string;
  readonly vipLevel: string;

  constructor(name: string, slug: string, vipLevel: string = 'VIP9') {
    super();
    this.name = name;
    this.slug = slug;
    this.vipLevel = vipLevel;
  }

  /**
   * Extract array from various response patterns
   */
  private extractArray(response: unknown, patterns: string[]): unknown[] {
    const unwrapped = this.unwrapResponse(response);

    // Direct array
    if (Array.isArray(unwrapped)) {
      return unwrapped;
    }

    if (typeof unwrapped !== 'object' || unwrapped === null) {
      return [];
    }

    const obj = unwrapped as Record<string, unknown>;

    // Try pattern paths
    for (const pattern of patterns) {
      const parts = pattern.split('.');
      let current: unknown = obj;

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = undefined;
          break;
        }
      }

      if (Array.isArray(current)) {
        return current;
      }
    }

    // Try common array fields
    const arrayFields = ['list', 'items', 'data', 'results', 'content', 'dramas', 'books', 'series', 'videos'];
    for (const field of arrayFields) {
      if (field in obj && Array.isArray(obj[field])) {
        return obj[field] as unknown[];
      }
    }

    // Return object values if it's a single item wrapped
    if (Object.keys(obj).length === 1) {
      const firstValue = Object.values(obj)[0];
      if (Array.isArray(firstValue)) {
        return firstValue;
      }
    }

    return [];
  }

  /**
   * Extract string value from object with fallback
   */
  protected extractString(obj: unknown, fields: string[], fallback: string = ''): string {
    if (typeof obj !== 'object' || obj === null) return fallback;

    for (const field of fields) {
      const value = (obj as Record<string, unknown>)[field];
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
    }

    return fallback;
  }

  /**
   * Extract number value from object with fallback
   */
  private extractNumber(obj: unknown, fields: string[], fallback: number = 0): number {
    if (typeof obj !== 'object' || obj === null) return fallback;

    for (const field of fields) {
      const value = (obj as Record<string, unknown>)[field];
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }

    return fallback;
  }

  /**
   * Extract boolean value from object with fallback
   */
  private extractBoolean(obj: unknown, fields: string[], fallback: boolean = false): boolean {
    if (typeof obj !== 'object' || obj === null) return fallback;

    for (const field of fields) {
      const value = (obj as Record<string, unknown>)[field];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        return value === 'true' || value === '1' || value === 'yes';
      }
    }

    return fallback;
  }

  /**
   * Map a single item to DramaCard
   */
  protected mapToDramaCard(item: unknown): DramaCard | null {
    if (!item || typeof item !== 'object') return null;

    const obj = item as Record<string, unknown>;

    // Extract ID from various field names
    const id = this.extractString(obj, ['id', 'dramaId', 'bookId', 'seriesId', 'vid', 'code', 'slug', '_id', 'drama_id', 'book_id']);
    if (!id) return null;

    // Extract title
    const title = this.extractString(obj, ['title', 'name', 'dramaName', 'bookName', 'seriesName', 'drama_name']);

    // Extract cover URL
    const coverUrl = this.extractString(obj, [
      'coverUrl', 'cover', 'poster', 'thumbnail', 'imageUrl', 'image',
      'cover_url', 'posterUrl', 'thumb', 'imgUrl', 'img',
      'drama_cover', // For MeloShort
      'pday' // For DotDrama (if using generic adapter)
    ]);

    // Extract episode count
    const episodeCount = this.extractNumber(obj, [
      'episodeCount', 'totalEpisodes', 'episodes', 'chapterCount', 'totalChapters',
      'episode_count', 'total_episodes', 'chapters'
    ]);

    // Extract rating
    const rating = this.extractNumber(obj, ['rating', 'score', 'rate', 'avgRating', 'avg_rating']) || undefined;

    // Extract tags/genres
    let tags: string[] = [];
    const tagsValue = obj.tags || obj.genres || obj.categories || obj.labels;
    if (Array.isArray(tagsValue)) {
      tags = tagsValue.map(t => typeof t === 'string' ? t : (t as Record<string, string>)?.name || String(t));
    } else if (typeof tagsValue === 'string') {
      tags = tagsValue.split(',').map(t => t.trim()).filter(Boolean);
    }

    // Check if premium
    const isPremium = this.extractBoolean(obj, ['isPremium', 'isVip', 'isPaid', 'premium', 'vip', 'paid']);

    return {
      id: `${this.slug}:${id}`,
      providerSlug: this.slug,
      providerDramaId: id,
      title: title || 'Untitled',
      coverUrl: coverUrl || '',
      episodeCount,
      rating,
      tags,
      isPremium,
      providerName: this.name,
      vipLevel: this.vipLevel,
    };
  }

  mapHome(response: unknown): DramaCard[] {
    const patterns = [
      'data.list', 'data.items', 'data.dramas', 'data.books', 'data.series',
      'list', 'items', 'dramas', 'books', 'series', 'results'
    ];

    const items = this.extractArray(response, patterns);
    return items.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
  }

  mapSearch(response: unknown): DramaCard[] {
    // Search often has similar structure to home
    return this.mapHome(response);
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const unwrapped = this.unwrapResponse(response);

    if (!unwrapped || typeof unwrapped !== 'object') {
      throw new Error('Invalid drama detail response');
    }

    const obj = unwrapped as Record<string, unknown>;

    // Try to get base drama card first
    const baseCard = this.mapToDramaCard(unwrapped);

    if (!baseCard) {
      // Try nested data structure
      const data = obj.data || obj.drama || obj.book || obj.series || obj.detail;
      if (data && typeof data === 'object') {
        const nestedCard = this.mapToDramaCard(data);
        if (nestedCard) {
          return this.enrichToDetail(nestedCard, data as Record<string, unknown>);
        }
      }
      throw new Error('Could not parse drama detail');
    }

    return this.enrichToDetail(baseCard, obj);
  }

  private enrichToDetail(card: DramaCard, obj: Record<string, unknown>): DramaDetail {
    // Extract synopsis/description
    const synopsis = this.extractString(obj, [
      'synopsis', 'description', 'summary', 'plot', 'overview', 'intro', 'introduction'
    ]);

    // Extract genres
    let genres: string[] = [];
    const genresValue = obj.genres || obj.genre || obj.categories || obj.tags;
    if (Array.isArray(genresValue)) {
      genres = genresValue.map(g => typeof g === 'string' ? g : (g as Record<string, string>)?.name || String(g));
    } else if (typeof genresValue === 'string') {
      genres = genresValue.split(',').map(g => g.trim()).filter(Boolean);
    }

    // Extract language
    const language = this.extractString(obj, ['language', 'lang', 'locale', 'region']);

    // Extract last updated
    const lastUpdated = this.extractString(obj, ['lastUpdated', 'updatedAt', 'updateTime', 'last_updated', 'updated_at']);

    // Extract popularity score
    const popularityScore = this.extractNumber(obj, [
      'popularityScore', 'popularity', 'views', 'viewCount', 'playCount', 'plays'
    ]) || undefined;

    return {
      ...card,
      synopsis,
      genres,
      language,
      lastUpdated: lastUpdated || new Date().toISOString(),
      popularityScore,
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    const patterns = [
      'data.episodes', 'data.chapters', 'data.list', 'data.items',
      'episodes', 'chapters', 'list', 'items', 'data', 'episode_list'
    ];

    const items = this.extractArray(response, patterns);

    return items.map((item, index): EpisodeItem | null => {
      if (!item || typeof item !== 'object') return null;

      const obj = item as Record<string, unknown>;

      // Extract episode ID
      const episodeId = this.extractString(obj, [
        'episodeId', 'id', 'chapterId', 'epId', '_id', 'episode_id', 'chapter_id'
      ]);

      // Extract episode number (use index as fallback)
      let episodeNo = this.extractNumber(obj, [
        'episodeNo', 'episodeNumber', 'number', 'epNo', 'ep', 'chapterNo', 'chapterNumber',
        'episode_no', 'episode_number', 'seq', 'sequence',
        'chapter_num', // FlickReels
        'serial_number' // ReelShort
      ]);
      if (!episodeNo) episodeNo = index + 1;

      // Extract title
      const title = this.extractString(obj, [
        'title', 'name', 'episodeTitle', 'chapterTitle', 'episode_title', 'chapter_title',
        'chapterName', // GoodShort
        'chapter_title' // FlickReels
      ]);

      // Extract duration (some providers return seconds, some return ms)
      let duration = this.extractNumber(obj, [
        'durationMs', 'duration', 'length', 'playTime', 'play_time', 'time'
      ]);
      
      // Convert to ms if duration is too small (assuming seconds)
      const durationMs = duration > 0 && duration < 1000 ? duration * 1000 : duration;

      // Check if locked
      const isLocked = this.extractBoolean(obj, [
        'isLocked', 'locked', 'isPremium', 'needUnlock', 'isPaid', 'locked'
      ]);

      // Extract thumbnail
      const thumbnailUrl = this.extractString(obj, [
        'thumbnailUrl', 'thumbnail', 'cover', 'image', 'thumb', 'thumbnail_url'
      ]);

      // Extract chapter ID if present
      const chapterId = this.extractString(obj, ['chapterId', 'chapter_id', 'chapter']);

      // Extract slug if present
      const slug = this.extractString(obj, ['slug', 'urlSlug', 'url_slug']);

      return {
        episodeId: episodeId || `${episodeNo}`,
        providerEpisodeId: episodeId || undefined,
        episodeNo,
        chapterId: chapterId || undefined,
        slug: slug || undefined,
        title: title || `Episode ${episodeNo}`,
        durationMs,
        isLocked,
        thumbnailUrl: thumbnailUrl || undefined,
      };
    }).filter(Boolean) as EpisodeItem[];
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const unwrapped = this.unwrapResponse(response);

    if (!unwrapped || typeof unwrapped !== 'object') {
      throw new Error('Invalid playback response');
    }

    const obj = unwrapped as Record<string, unknown>;

    // Extract stream URL from various patterns
    let streamUrl = this.extractString(obj, [
      'streamUrl', 'url', 'playUrl', 'videoUrl', 'src', 'm3u8', 'mp4',
      'stream_url', 'play_url', 'video_url', 'videoSrc', 'video_src'
    ]);

    // Try nested video object
    if (!streamUrl) {
      const video = obj.video || obj.stream || obj.playback;
      if (video && typeof video === 'object') {
        streamUrl = this.extractString(video, [
          'url', 'src', 'streamUrl', 'playUrl', 'm3u8', 'mp4'
        ]);
      }
    }

    if (!streamUrl) {
      throw new Error('No stream URL found in playback response');
    }

    // Extract MIME type
    const mimeType = this.extractString(obj, [
      'mimeType', 'mime', 'contentType', 'type', 'format'
    ]) || undefined;

    // Extract headers
    let headers: Record<string, string> | undefined;
    const headersValue = obj.headers || obj.requestHeaders;
    if (headersValue && typeof headersValue === 'object') {
      headers = headersValue as Record<string, string>;
    }

    // Extract expiration
    let expiresAt = this.extractString(obj, [
      'expiresAt', 'expireAt', 'expireTime', 'expiration', 'expired_at', 'expire_at'
    ]);
    if (!expiresAt) {
      // Default to 1 hour from now
      expiresAt = new Date(Date.now() + 3600000).toISOString();
    }

    // Extract next episode info
    let nextEpisode: { episodeId: string; episodeNo: number } | undefined;
    const nextValue = obj.nextEpisode || obj.next;
    if (nextValue && typeof nextValue === 'object') {
      const nextId = this.extractString(nextValue as Record<string, unknown>, ['id', 'episodeId', '_id']);
      const nextNo = this.extractNumber(nextValue as Record<string, unknown>, ['episodeNo', 'number', 'epNo']);
      if (nextId && nextNo) {
        nextEpisode = { episodeId: nextId, episodeNo: nextNo };
      }
    }

    return {
      streamUrl,
      mimeType,
      headers,
      expiresAt,
      nextEpisode,
    };
  }
}
