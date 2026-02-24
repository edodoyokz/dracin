import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '../../types';

export class ShortMaxAdapter extends BaseProviderAdapter {
  readonly name = 'ShortMax';
  readonly slug = 'shortmax';

  mapHome(response: unknown): DramaCard[] {
    return [];
  }

  mapSearch(response: unknown): DramaCard[] {
    return [];
  }

  mapDramaDetail(response: unknown): DramaDetail {
    return {} as DramaDetail;
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    return [];
  }

  mapPlayback(response: unknown): PlaybackResponse {
    return {} as PlaybackResponse;
  }
}
