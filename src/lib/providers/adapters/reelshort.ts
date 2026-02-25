import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';

// ReelShort API response interfaces (based on actual API probing)
interface ReelShortBook {
  book_id: string;
  book_title: string;
  book_pic: string;
  chapter_count?: number;
  collect_count?: number;
  init_collect_count?: number;
  read_count?: number;
  special_desc?: string;
  theme?: string;
  book_type?: number;
  t_book_id?: string;
  // Fallback fields from older API format
  _id?: string;
  title?: string;
  cover?: string;
  episodeCount?: number;
  rating?: number;
  tags?: string[];
}

interface ReelShortList {
  bs_id: number;
  tab_id: number;
  books: ReelShortBook[];
}

interface ReelShortHomeResponse {
  lists?: ReelShortList[];
  tab_list?: unknown[];
  hall_id?: number;
  // Fallback for direct array
}

interface ReelShortChapter {
  chapterId: string;
  chapter_id?: string;
  title: string;
  sequence: number;
  chapter_index?: number;
}

interface ReelShortVideo {
  videoUrl: string;
  video_url?: string;
  videos?: Array<{
    PlayURL?: string;
    playUrl?: string;
    url?: string;
  }>;
}

export class ReelShortAdapter extends BaseProviderAdapter {
  readonly name = 'ReelShort';
  readonly slug = 'reelshort';

  mapHome(response: unknown): DramaCard[] {
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as ReelShortHomeResponse;

    // ReelShort home returns { lists: [{ books: [...] }] }
    if (resp?.lists && Array.isArray(resp.lists)) {
      const allBooks = resp.lists.flatMap(l => l.books || []);
      return allBooks.map(book => this.mapBookToCard(book));
    }

    // Fallback: direct array
    if (Array.isArray(unwrapped)) {
      return (unwrapped as ReelShortBook[]).map(book => this.mapBookToCard(book));
    }

    return [];
  }

  private mapBookToCard(book: ReelShortBook): DramaCard {
    const id = book.book_id || book._id || book.t_book_id || '';
    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: book.book_title || book.title || '',
      coverUrl: book.book_pic || book.cover || '',
      episodeCount: book.chapter_count || book.episodeCount || 0,
      rating: book.rating || (book.read_count ? Math.min(book.read_count / 100000, 10) : undefined),
      tags: book.tags || (book.theme ? [book.theme] : []),
      isPremium: false,
      ...this.extractProviderInfo(),
    };
  }

  mapSearch(response: unknown): DramaCard[] {
    return this.mapHome(response);
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const book = response as ReelShortBook;
    const id = book.book_id || book._id || '';
    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: book.book_title || book.title || '',
      coverUrl: book.book_pic || book.cover || '',
      episodeCount: book.chapter_count || book.episodeCount || 0,
      rating: book.rating,
      tags: book.tags || [],
      isPremium: false,
      synopsis: book.special_desc || '',
      genres: book.tags || [],
      language: 'id',
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
    return chapters.map((ch, idx) => ({
      episodeId: `${this.slug}:${ch.chapterId || ch.chapter_id || ''}`,
      providerEpisodeId: ch.chapterId || ch.chapter_id || '',
      episodeNo: ch.sequence || ch.chapter_index || (idx + 1),
      title: ch.title,
      durationMs: 0,
      isLocked: false,
    }));
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const video = this.unwrapResponse(response) as ReelShortVideo;
    const streamUrl =
      video?.videoUrl
      || video?.video_url
      || video?.videos?.[0]?.PlayURL
      || video?.videos?.[0]?.playUrl
      || video?.videos?.[0]?.url
      || '';

    return {
      streamUrl,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }
}
