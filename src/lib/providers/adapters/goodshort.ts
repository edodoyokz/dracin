import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';

// GoodShort API response interfaces
interface GoodShortBook {
  _id: string;
  title: string;
  cover: string;
  episodeCount: number;
  rating?: number;
  tags?: string[];
  synopsis?: string;
  status?: string;
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

interface GoodShortHomeResponse {
  data?: GoodShortBook[];
  books?: GoodShortBook[];
  list?: GoodShortBook[];
}

interface GoodShortSearchResponse {
  data?: GoodShortBook[];
  results?: GoodShortBook[];
  list?: GoodShortBook[];
}

export class GoodShortAdapter extends BaseProviderAdapter {
  readonly name = 'GoodShort';
  readonly slug = 'goodshort';

  mapHome(response: unknown): DramaCard[] {
    const resp = response as GoodShortHomeResponse;
    // Handle various response structures: { data: [] }, { books: [] }, or direct array
    const items = resp?.data || resp?.books || resp?.list || (Array.isArray(response) ? response as GoodShortBook[] : []);

    return items.map(item => ({
      id: `${this.slug}:${item._id}`,
      providerDramaId: item._id,
      title: item.title,
      coverUrl: item.cover,
      episodeCount: item.episodeCount,
      rating: item.rating,
      tags: item.tags || [],
      isPremium: false,
      ...this.extractProviderInfo(),
    }));
  }

  mapSearch(response: unknown): DramaCard[] {
    const resp = response as GoodShortSearchResponse;
    // Handle various response structures
    const items = resp?.data || resp?.results || resp?.list || (Array.isArray(response) ? response as GoodShortBook[] : []);

    return items.map(item => ({
      id: `${this.slug}:${item._id}`,
      providerDramaId: item._id,
      title: item.title,
      coverUrl: item.cover,
      episodeCount: item.episodeCount,
      rating: item.rating,
      tags: item.tags || [],
      isPremium: false,
      ...this.extractProviderInfo(),
    }));
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const book = response as GoodShortBook;

    return {
      id: `${this.slug}:${book._id}`,
      providerDramaId: book._id,
      title: book.title,
      coverUrl: book.cover,
      episodeCount: book.episodeCount,
      rating: book.rating,
      tags: book.tags || [],
      isPremium: false,
      synopsis: book.synopsis || '',
      genres: book.tags || [],
      language: 'en',
      lastUpdated: new Date().toISOString(),
      popularityScore: book.rating,
      ...this.extractProviderInfo(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    // Handle various response structures
    const resp = response as { data?: GoodShortChapter[]; chapters?: GoodShortChapter[]; list?: GoodShortChapter[] };
    const chapters = resp?.data || resp?.chapters || resp?.list || (Array.isArray(response) ? response as GoodShortChapter[] : []);

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
