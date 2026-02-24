import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';

interface ReelShortBook {
  _id: string;
  title: string;
  cover: string;
  episodeCount: number;
  rating?: number;
  tags?: string[];
}

interface ReelShortChapter {
  chapterId: string;
  title: string;
  sequence: number;
}

interface ReelShortVideo {
  videoUrl: string;
}

export class ReelShortAdapter extends BaseProviderAdapter {
  readonly name = 'ReelShort';
  readonly slug = 'reelshort';

  mapHome(response: unknown): DramaCard[] {
    if (!response || !Array.isArray(response)) {
      return [];
    }
    const items = response as ReelShortBook[];
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
    return this.mapHome(response);
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const book = response as ReelShortBook;
    return {
      id: `${this.slug}:${book._id}`,
      providerDramaId: book._id,
      title: book.title,
      coverUrl: book.cover,
      episodeCount: book.episodeCount,
      rating: book.rating,
      tags: book.tags || [],
      isPremium: false,
      synopsis: '',
      genres: book.tags || [],
      language: 'in',
      lastUpdated: new Date().toISOString(),
      popularityScore: book.rating,
      ...this.extractProviderInfo(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    if (!response || !Array.isArray(response)) {
      return [];
    }
    const chapters = response as ReelShortChapter[];
    return chapters.map(ch => ({
      episodeId: `${this.slug}:${ch.chapterId}`,
      providerEpisodeId: ch.chapterId,
      episodeNo: ch.sequence,
      title: ch.title,
      durationMs: 0,
      isLocked: false,
    }));
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const video = response as ReelShortVideo;
    return {
      streamUrl: video?.videoUrl || '',
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }
}
