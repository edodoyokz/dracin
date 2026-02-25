import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';

// GoodShort API response interfaces (based on actual API probing)
interface GoodShortItem {
  bookId: string;
  bookName: string;
  cover: string;
  image?: string;
  actionType?: string;
  action?: string;
  bookType?: number;
  member?: number;
  pseudonym?: string;
  introduction?: string;
  viewCount?: number;
  chapterCount?: number;
  totalEpisodes?: number;
  episodeCount?: number;
  rating?: number;
  tags?: string[];
}

interface GoodShortRecord {
  columnId: number;
  name: string;
  style: string;
  items: GoodShortItem[];
}

interface GoodShortHomeResponse {
  records?: GoodShortRecord[];
  data?: unknown;
  list?: GoodShortItem[];
  books?: GoodShortItem[];
}

interface GoodShortChapter {
  chapterId?: string;
  id?: string | number;
  title?: string;
  chapterName?: string;
  sequence?: number;
  index?: number;
  isLocked?: boolean;
  charged?: boolean;
  consumeType?: number;
  duration?: number;
  playTime?: number;
  image?: string;
}

interface GoodShortVideo {
  videoUrl?: string;
  m3u8?: string;
  playUrl?: string;
  streamUrl?: string;
  url?: string;
  expiresAt?: string;
}

export class GoodShortAdapter extends BaseProviderAdapter {
  readonly name = 'GoodShort';
  readonly slug = 'goodshort';

  mapHome(response: unknown): DramaCard[] {
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as GoodShortHomeResponse;

    // GoodShort home returns { records: [{ name, items: [...] }] }
    if (resp?.records && Array.isArray(resp.records)) {
      const allItems = resp.records
        .filter(r => r.style !== 'SLIDE_BANNER') // Skip banner sections
        .flatMap(r => r.items || []);
      return allItems.map(item => this.mapItemToCard(item));
    }

    // Fallback: direct array or list
    const items = resp?.list || resp?.books || (Array.isArray(unwrapped) ? unwrapped as GoodShortItem[] : []);
    if (!Array.isArray(items)) return [];
    return items.map(item => this.mapItemToCard(item));
  }

  private mapItemToCard(item: GoodShortItem): DramaCard {
    const id = item.bookId || item.action || '';
    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: item.bookName || '',
      coverUrl: item.cover || item.image || '',
      episodeCount: item.chapterCount || item.totalEpisodes || item.episodeCount || 0,
      rating: item.rating || (item.viewCount ? Math.min(item.viewCount / 10000, 10) : undefined),
      tags: item.tags || [],
      isPremium: item.member === 1,
      ...this.extractProviderInfo(),
    };
  }

  mapSearch(response: unknown): DramaCard[] {
    return this.mapHome(response);
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const item = response as GoodShortItem;
    const id = item.bookId || '';
    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: item.bookName || '',
      coverUrl: item.cover || item.image || '',
      episodeCount: item.chapterCount || item.totalEpisodes || item.episodeCount || 0,
      rating: item.rating,
      tags: item.tags || [],
      isPremium: item.member === 1,
      synopsis: item.introduction || '',
      genres: item.tags || [],
      language: 'id',
      lastUpdated: new Date().toISOString(),
      popularityScore: item.rating,
      ...this.extractProviderInfo(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as { data?: GoodShortChapter[]; chapters?: GoodShortChapter[]; list?: GoodShortChapter[] };
    const chapters = resp?.data || resp?.chapters || resp?.list || (Array.isArray(response) ? response as GoodShortChapter[] : []);
    if (!Array.isArray(chapters)) return [];

    return chapters.map((ch, idx) => {
      const chapterId = String(ch.chapterId ?? ch.id ?? '').trim();

      const episodeNoFromName = ch.chapterName ? Number.parseInt(ch.chapterName, 10) : Number.NaN;
      const sequence = typeof ch.sequence === 'number' ? ch.sequence : undefined;
      const indexNo = typeof ch.index === 'number' ? ch.index + 1 : undefined;
      const episodeNo = !Number.isNaN(episodeNoFromName)
        ? episodeNoFromName
        : (sequence ?? indexNo ?? idx + 1);

      const durationMs = typeof ch.playTime === 'number'
        ? ch.playTime * 1000
        : (typeof ch.duration === 'number' ? ch.duration : 0);

      const isLocked = typeof ch.isLocked === 'boolean'
        ? ch.isLocked
        : (Boolean(ch.charged) || (ch.consumeType ?? 0) > 0);

      const title = ch.title || ch.chapterName || `Episode ${episodeNo}`;

      return {
        episodeId: `${this.slug}:${chapterId || episodeNo}`,
        providerEpisodeId: chapterId || undefined,
        chapterId: chapterId || undefined,
        episodeNo,
        title,
        durationMs,
        isLocked,
        thumbnailUrl: ch.image,
      };
    });
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const unwrapped = this.unwrapResponse(response) as Record<string, unknown>;

    const streamUrl =
      (typeof unwrapped.videoUrl === 'string' && unwrapped.videoUrl)
      || (typeof unwrapped.m3u8 === 'string' && unwrapped.m3u8)
      || (typeof unwrapped.playUrl === 'string' && unwrapped.playUrl)
      || (typeof unwrapped.streamUrl === 'string' && unwrapped.streamUrl)
      || (typeof unwrapped.url === 'string' && unwrapped.url)
      || '';

    const expiresAt =
      (typeof unwrapped.expiresAt === 'string' && unwrapped.expiresAt)
      || new Date(Date.now() + 2 * 60 * 1000).toISOString();

    return {
      streamUrl,
      expiresAt,
    };
  }
}
