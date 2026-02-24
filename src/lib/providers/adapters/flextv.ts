import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '@/lib/types';

// FlexTV API response interfaces (based on actual API probing)
interface FlexTVSeries {
  series_id: number;
  series_name: string;
  description?: string;
  video_type?: number;
  cover_url?: string;
  image_url?: string;
  horizontal_url?: string;
  episode_count?: number;
  total_episode?: number;
  view_count?: number;
  status?: number;
  // Fallback fields
  id?: string;
  _id?: string;
  title?: string;
  name?: string;
  cover?: string;
  poster?: string;
  thumbnail?: string;
  episodeCount?: number;
  totalEpisodes?: number;
  rating?: number;
  score?: number;
  tags?: string[];
  genres?: string[];
  synopsis?: string;
}

interface FlexTVFloor {
  id: number;
  title: string;
  has_more: number;
  template_type: number;
  content_type: number;
  series_list: FlexTVSeries[];
}

interface FlexTVHomeResponse {
  floor?: FlexTVFloor[];
  classify_info?: unknown[];
  banner_list?: unknown[];
  // Fallback
  data?: FlexTVSeries[];
  series?: FlexTVSeries[];
  list?: FlexTVSeries[];
  tabs?: { name: string; series: FlexTVSeries[] }[];
}

interface FlexTVEpisode {
  id: string;
  _id?: string;
  sectionId?: string;
  section_id?: number;
  title: string;
  name?: string;
  sequence: number;
  episodeNo?: number;
  number?: number;
  duration?: number;
  durationMs?: number;
  isLocked?: boolean;
  locked?: boolean;
}

interface FlexTVVideo {
  videoUrl: string;
  playUrl?: string;
  streamUrl?: string;
  url?: string;
  expiresAt?: string;
  expireTime?: string;
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
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as FlexTVHomeResponse;

    // FlexTV /tabs/:name returns { floor: [{ series_list: [...] }] }
    if (resp?.floor && Array.isArray(resp.floor)) {
      const allSeries = resp.floor.flatMap(f => f.series_list || []);
      return allSeries.map(item => this.mapSeriesToCard(item));
    }

    // FlexTV /tabs returns { classify_info, banner_list } - not useful for dramas
    // Handle tabs structure: { tabs: [{ name, series: [] }] }
    if (resp?.tabs && Array.isArray(resp.tabs)) {
      const allSeries = resp.tabs.flatMap(tab => tab.series || []);
      return allSeries.map(item => this.mapSeriesToCard(item));
    }

    // Handle various response structures
    const items = resp?.list || resp?.data || resp?.series || (Array.isArray(unwrapped) ? unwrapped as FlexTVSeries[] : []);
    if (!Array.isArray(items)) return [];
    return items.map(item => this.mapSeriesToCard(item));
  }

  private mapSeriesToCard(item: FlexTVSeries): DramaCard {
    const id = String(item.series_id || item.id || item._id || '');
    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: item.series_name || item.title || item.name || '',
      coverUrl: item.cover_url || item.image_url || item.horizontal_url || item.cover || item.poster || item.thumbnail || '',
      episodeCount: item.episode_count || item.total_episode || item.episodeCount || item.totalEpisodes || 0,
      rating: item.rating || item.score || (item.view_count ? Math.min(item.view_count / 10000, 10) : undefined),
      tags: item.tags || item.genres || [],
      isPremium: false,
      ...this.extractProviderInfo(),
    };
  }

  mapSearch(response: unknown): DramaCard[] {
    return this.mapHome(response);
  }

  mapDramaDetail(response: unknown): DramaDetail {
    const series = response as FlexTVSeries;
    const id = String(series.series_id || series.id || series._id || '');

    return {
      id: `${this.slug}:${id}`,
      providerDramaId: id,
      title: series.series_name || series.title || series.name || '',
      coverUrl: series.cover_url || series.image_url || series.cover || series.poster || series.thumbnail || '',
      episodeCount: series.episode_count || series.total_episode || series.episodeCount || series.totalEpisodes || 0,
      rating: series.rating || series.score,
      tags: series.tags || series.genres || [],
      isPremium: false,
      synopsis: series.synopsis || series.description || '',
      genres: series.genres || series.tags || [],
      language: 'id',
      lastUpdated: new Date().toISOString(),
      popularityScore: series.rating || series.score,
      ...this.extractProviderInfo(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as FlexTVEpisodesResponse;
    const episodes = resp?.data || resp?.episodes || resp?.list || (Array.isArray(response) ? response as FlexTVEpisode[] : []);
    if (!Array.isArray(episodes)) return [];

    return episodes.map(ep => {
      const epId = ep.id || ep._id || ep.sectionId || String(ep.section_id || '');
      return {
        episodeId: `${this.slug}:${epId}`,
        providerEpisodeId: epId,
        episodeNo: ep.sequence || ep.episodeNo || ep.number || 0,
        title: ep.title || ep.name || `Episode ${ep.sequence || ep.episodeNo || ep.number || 0}`,
        durationMs: ep.duration || ep.durationMs || 0,
        isLocked: ep.isLocked || ep.locked || false,
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
