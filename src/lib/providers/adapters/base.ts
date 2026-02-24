import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '../types';

export interface ProviderAdapter {
  readonly name: string;
  readonly slug: string;
  
  mapHome(response: unknown): DramaCard[];
  mapSearch(response: unknown): DramaCard[];
  mapDramaDetail(response: unknown): DramaDetail;
  mapEpisodes(response: unknown): EpisodeItem[];
  mapPlayback(response: unknown): PlaybackResponse;
}

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly name: string;
  abstract readonly slug: string;

  abstract mapHome(response: unknown): DramaCard[];
  abstract mapSearch(response: unknown): DramaCard[];
  abstract mapDramaDetail(response: unknown): DramaDetail;
  abstract mapEpisodes(response: unknown): EpisodeItem[];
  abstract mapPlayback(response: unknown): PlaybackResponse;

  protected extractProviderInfo() {
    return {
      providerName: this.name,
      providerSlug: this.slug,
      vipLevel: 'VIP9',
    };
  }
}
