import { BaseProviderAdapter } from './base';
import type { DramaCard, DramaDetail, EpisodeItem, PlaybackResponse } from '../../types';

export class GoodShortAdapter extends BaseProviderAdapter {
  readonly name = 'GoodShort';
  readonly slug = 'goodshort';

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
