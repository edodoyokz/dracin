import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';

// FlexTV API response interfaces
interface FlexTVSeries {
  id: string;
  _id?: string;
  title: string;
  name?: string;
  cover: string;
  poster?: string;
  thumbnail?: string;
  episodeCount: number;
  totalEpisodes?: number;
  rating?: number;
  score?: number;
  tags?: string[];
  genres?: string[];
  synopsis?: string;
  description?: string;
  status?: string;
}

interface FlexTVEpisode {
  id: string;
  _id?: string;
  sectionId?: string;
  title: string;
  name?: string;
  sequence: number;
  episodeNo?: number;
  number?: number;
  duration?: number;
  durationMs?: number;
  isLocked?: boolean;
  locked?: boolean;
  thumbnail?: string;
  thumbnailUrl?: string;
}

interface FlexTVVideo {
  videoUrl: string;
  playUrl?: string;
  streamUrl?: string;
  url?: string;
  expiresAt?: string;
  expireTime?: string;
}

interface FlexTVHomeResponse {
  data?: FlexTVSeries[];
  series?: FlexTVSeries[];
  list?: FlexTVSeries[];
  tabs?: { name: string; series: FlexTVSeries[] }[];
}

interface FlexTVSearchResponse {
  data?: FlexTVSeries[];
  results?: FlexTVSeries[];
  list?: FlexTVSeries[];
}

interface FlexTVEpisodesResponse {
  data?: FlexTVEpisode[];
  episodes?: FlexTVEpisode[];
  list?: FlexTVEpisode[];
}

export class FlexTVAdapter extends BaseProviderAdapter {
  readonly name = 'FlexTV';
  readonly slug = 'flextv';

  mapHome(response: unknown): DramaCard[] {
    const resp = response as FlexTVHomeResponse;

    // Handle tabs structure: { tabs: [{ name, series: [] }] }
    if (resp?.tabs && Array.isArray(resp.tabs)) {
      const allSeries = resp.tabs.flatMap(tab => tab.series || []);
      return allSeries.map(item => this.mapSeriesToCard(item));
    }

    // Handle various response structures: { data: [] }, { series: [] }, or direct array
    const items = resp?.data || resp?.series || resp?.list || (Array.isArray(response) ? response as FlexTVSeries[] : []);

    return items.map(item => this.mapSeriesToCard(item));
  }

  private mapSeriesToCard(item: FlexTVSeries): DramaCard {
    const id = item.id || item._id || '';
    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: item.title || item.name || '',
      coverUrl: item.cover || item.poster || item.thumbnail || '',
      episodeCount: item.episodeCount || item.totalEpisodes || 0,
      rating: item.rating || item.score,
      tags: item.tags || item.genres || [],
      isPremium: false,
      ...this.extractProviderInfo(),
    };
  }

  mapSearch(response: unknown): DramaCard[] {
    const resp = response as FlexTVSearchResponse;
    const items = resp?.data || resp?.results || resp?.list || (Array.isArray(response) ? response as FlexTVSeries[] : []);

    return items.map(item => this.mapSeriesToCard(item));
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const series = response as FlexTVSeries;
    const id = series.id || series._id || '';

    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: series.title || series.name || '',
      coverUrl: series.cover || series.poster || series.thumbnail || '',
      episodeCount: series.episodeCount || series.totalEpisodes || 0,
      rating: series.rating || series.score,
      tags: series.tags || series.genres || [],
      isPremium: false,
      synopsis: series.synopsis || series.description || '',
      genres: series.genres || series.tags || [],
      language: 'en',
      lastUpdated: new Date().toISOString(),
      popularityScore: series.rating || series.score,
      ...this.extractProviderInfo(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as FlexTVEpisodesResponse;
    const episodes = resp?.data || resp?.episodes || resp?.list || (Array.isArray(response) ? response as FlexTVEpisode[] : []);

    return episodes.map(ep => {
      const epId = ep.id || ep._id || ep.sectionId || '';
      return {
        episodeId: `${this.slug}:${epId}`,
        providerEpisodeId: epId,
        episodeNo: ep.sequence || ep.episodeNo || ep.number || 0,
        title: ep.title || ep.name || `Episode ${ep.sequence || ep.episodeNo || ep.number || 0}`,
        durationMs: ep.duration || ep.durationMs || 0,
        isLocked: ep.isLocked || ep.locked || false,
        thumbnailUrl: ep.thumbnail || ep.thumbnailUrl,
      };
    });
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const video = response as FlexTVVideo;

    return {
      streamUrl: video.videoUrl || video.playUrl || video.streamUrl || video.url || '',
      expiresAt: video.expiresAt || video.expireTime || new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }
}
