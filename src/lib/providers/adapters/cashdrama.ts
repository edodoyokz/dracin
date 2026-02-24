import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';

// CashDrama API response interfaces
interface CashDramaDrama {
  vid: string;
  id?: string;
  _id?: string;
  title: string;
  name?: string;
  cover: string;
  poster?: string;
  thumbnail?: string;
  episodeCount: number;
  totalEpisodes?: number;
  episodes?: number;
  rating?: number;
  score?: number;
  tags?: string[];
  genres?: string[];
  synopsis?: string;
  description?: string;
  status?: string;
  language?: string;
}

interface CashDramaEpisode {
  ep: number;
  episodeNo?: number;
  number?: number;
  id?: string;
  episodeId?: string;
  vid?: string;
  title?: string;
  name?: string;
  duration?: number;
  durationMs?: number;
  isLocked?: boolean;
  locked?: boolean;
  thumbnail?: string;
  thumbnailUrl?: string;
}

interface CashDramaVideo {
  videoUrl: string;
  playUrl?: string;
  streamUrl?: string;
  url?: string;
  expiresAt?: string;
  expireTime?: string;
}

interface CashDramaHomeResponse {
  data?: CashDramaDrama[];
  dramas?: CashDramaDrama[];
  list?: CashDramaDrama[];
  blocks?: { name: string; dramas: CashDramaDrama[] }[];
}

interface CashDramaSearchResponse {
  data?: CashDramaDrama[];
  results?: CashDramaDrama[];
  list?: CashDramaDrama[];
}

interface CashDramaEpisodesResponse {
  data?: CashDramaEpisode[];
  episodes?: CashDramaEpisode[];
  list?: CashDramaEpisode[];
}

export class CashDramaAdapter extends BaseProviderAdapter {
  readonly name = 'CashDrama';
  readonly slug = 'cashdrama';

  mapHome(response: unknown): DramaCard[] {
    const resp = response as CashDramaHomeResponse;

    // Handle blocks structure: { blocks: [{ name, dramas: [] }] }
    if (resp?.blocks && Array.isArray(resp.blocks)) {
      const allDramas = resp.blocks.flatMap(block => block.dramas || []);
      return allDramas.map(item => this.mapDramaToCard(item));
    }

    // Handle various response structures
    const items = resp?.data || resp?.dramas || resp?.list || (Array.isArray(response) ? response as CashDramaDrama[] : []);

    return items.map(item => this.mapDramaToCard(item));
  }

  private mapDramaToCard(item: CashDramaDrama): DramaCard {
    const id = item.vid || item.id || item._id || '';
    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: item.title || item.name || '',
      coverUrl: item.cover || item.poster || item.thumbnail || '',
      episodeCount: item.episodeCount || item.totalEpisodes || item.episodes || 0,
      rating: item.rating || item.score,
      tags: item.tags || item.genres || [],
      isPremium: false,
      ...this.extractProviderInfo(),
    };
  }

  mapSearch(response: unknown): DramaCard[] {
    const resp = response as CashDramaSearchResponse;
    const items = resp?.data || resp?.results || resp?.list || (Array.isArray(response) ? response as CashDramaDrama[] : []);

    return items.map(item => this.mapDramaToCard(item));
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const drama = response as CashDramaDrama;
    const id = drama.vid || drama.id || drama._id || '';

    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: drama.title || drama.name || '',
      coverUrl: drama.cover || drama.poster || drama.thumbnail || '',
      episodeCount: drama.episodeCount || drama.totalEpisodes || drama.episodes || 0,
      rating: drama.rating || drama.score,
      tags: drama.tags || drama.genres || [],
      isPremium: false,
      synopsis: drama.synopsis || drama.description || '',
      genres: drama.genres || drama.tags || [],
      language: drama.language || 'en',
      lastUpdated: new Date().toISOString(),
      popularityScore: drama.rating || drama.score,
      ...this.extractProviderInfo(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as CashDramaEpisodesResponse;
    const episodes = resp?.data || resp?.episodes || resp?.list || (Array.isArray(response) ? response as CashDramaEpisode[] : []);

    return episodes.map(ep => {
      const epId = ep.id || ep.episodeId || ep.vid || `${ep.ep || ep.episodeNo || ep.number}`;
      const epNo = ep.ep || ep.episodeNo || ep.number || 0;
      return {
        episodeId: `${this.slug}:${epId}`,
        providerEpisodeId: epId,
        episodeNo: epNo,
        title: ep.title || ep.name || `Episode ${epNo}`,
        durationMs: ep.duration || ep.durationMs || 0,
        isLocked: ep.isLocked || ep.locked || false,
        thumbnailUrl: ep.thumbnail || ep.thumbnailUrl,
      };
    });
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const video = response as CashDramaVideo;

    return {
      streamUrl: video.videoUrl || video.playUrl || video.streamUrl || video.url || '',
      expiresAt: video.expiresAt || video.expireTime || new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }
}
