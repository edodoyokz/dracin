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
  chapterId: string;
  title: string;
  sequence: number;
  isLocked?: boolean;
  duration?: number;
}

interface GoodShortVideo {
  videoUrl: string;
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

    return chapters.map(ch => ({
      episodeId: `${this.slug}:${ch.chapterId}`,
      providerEpisodeId: ch.chapterId,
      episodeNo: ch.sequence,
      title: ch.title,
      durationMs: ch.duration || 0,
      isLocked: ch.isLocked || false,
    }));
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const video = response as GoodShortVideo;
    return {
      streamUrl: video.videoUrl,
      expiresAt: video.expiresAt || new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }
}
