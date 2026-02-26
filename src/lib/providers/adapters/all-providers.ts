import { GenericProviderAdapter } from './generic';
import type { DramaCard, EpisodeItem, PlaybackResponse } from '@/lib/types';

// ===== HiShort =====
export class HiShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('HiShort', 'hishort', 'VIP9');
  }
}

// ===== MicroDrama =====
export class MicroDramaAdapter extends GenericProviderAdapter {
  constructor() {
    super('MicroDrama', 'microdrama', 'VIP9');
  }
}

// ===== MeloShort =====
export class MeloShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('MeloShort', 'meloshort', 'VIP9');
  }
}

// ===== StardustTV =====
export class StardustTVAdapter extends GenericProviderAdapter {
  constructor() {
    super('StardustTV', 'stardusttv', 'VIP9');
  }
}

// ===== KalosTV =====
export class KalosTVAdapter extends GenericProviderAdapter {
  constructor() {
    super('KalosTV', 'kalostv', 'VIP9');
  }
}

// ===== FlexTV =====
// FlexTV doesn't have dramas in home, only banners and classifications
// Skip for now or use different endpoint
export class FlexTVAdapter extends GenericProviderAdapter {
  constructor() {
    super('FlexTV', 'flextv', 'VIP9');
  }
}

// ===== DramaPops =====
export class DramaPopsAdapter extends GenericProviderAdapter {
  constructor() {
    super('DramaPops', 'dramapops', 'VIP9');
  }

  mapHome(response: unknown): DramaCard[] {
    // DramaPops returns { success: true, data: [{ name, layout, movies: [] }] }
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as Record<string, unknown>;
    
    let dramas: unknown[] = [];
    
    // Check for data array with movies
    if (resp?.data && Array.isArray(resp.data)) {
      for (const section of resp.data) {
        const sectionObj = section as Record<string, unknown>;
        if (sectionObj.movies && Array.isArray(sectionObj.movies)) {
          dramas = [...dramas, ...sectionObj.movies];
        }
      }
    }
    
    return dramas.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const resp = response as Record<string, unknown>;
    const streamUrl = this.extractString(resp, ['videoUrl', 'playUrl', 'url', 'streamUrl', 'filePath']) || '';
    
    return {
      streamUrl,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as Record<string, unknown>;
    let episodes: Record<string, unknown>[] = [];
    
    if (resp?.episodes && Array.isArray(resp.episodes)) {
      episodes = resp.episodes as Record<string, unknown>[];
    } else if (resp?.data && typeof resp.data === 'object') {
      const data = resp.data as Record<string, unknown>;
      if (data.episodes && Array.isArray(data.episodes)) {
        episodes = data.episodes as Record<string, unknown>[];
      }
    }

    return episodes.map(ep => ({
      episodeId: `${this.slug}:${ep.id}`,
      providerEpisodeId: String(ep.id),
      episodeNo: Number(ep.number) || 0,
      title: String(ep.title) || `Episode ${ep.number}`,
      durationMs: 0,
      isLocked: !(ep.free),
      thumbnailUrl: undefined,
    }));
  }
}

// ===== Fundrama =====
export class FundramaAdapter extends GenericProviderAdapter {
  constructor() {
    super('Fundrama', 'fundrama', 'VIP9');
  }

  mapHome(response: unknown): DramaCard[] {
    // Fundrama returns { data: { ddriv: { lsumm: [...] } } }
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as Record<string, unknown>;
    
    let dramas: unknown[] = [];
    
    // Check for nested ddriv.lsumm
    if (resp?.data && typeof resp.data === 'object') {
      const data = resp.data as Record<string, unknown>;
      if (data.ddriv && typeof data.ddriv === 'object') {
        const ddriv = data.ddriv as Record<string, unknown>;
        if (ddriv.lsumm && Array.isArray(ddriv.lsumm)) {
          dramas = ddriv.lsumm;
        }
      }
    }
    
    return dramas.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const resp = response as Record<string, unknown>;
    const streamUrl = this.extractString(resp, ['videoUrl', 'playUrl', 'url', 'streamUrl', 'filePath']) || '';
    
    return {
      streamUrl,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }

  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as Record<string, unknown>;
    let episodes: Record<string, unknown>[] = [];
    
    if (resp?.episodes && Array.isArray(resp.episodes)) {
      episodes = resp.episodes as Record<string, unknown>[];
    } else if (resp?.data && typeof resp.data === 'object') {
      const data = resp.data as Record<string, unknown>;
      if (data.episodes && Array.isArray(data.episodes)) {
        episodes = data.episodes as Record<string, unknown>[];
      }
    }

    return episodes.map(ep => ({
      episodeId: `${this.slug}:${ep.id}`,
      providerEpisodeId: String(ep.id),
      episodeNo: Number(ep.number) || 0,
      title: String(ep.title) || `Episode ${ep.number}`,
      durationMs: 0,
      isLocked: !(ep.free),
      thumbnailUrl: undefined,
    }));
  }
}

// ===== ReelShort =====
export class ReelShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('ReelShort', 'reelshort', 'VIP9');
  }

  mapHome(response: unknown): DramaCard[] {
    // ReelShort returns { code: 0, data: { ... } }
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as Record<string, unknown>;
    
    let dramas: unknown[] = [];
    
    // Check for common patterns
    if (resp?.data && typeof resp.data === 'object') {
      const data = resp.data as Record<string, unknown>;
      const dramaKeys = ['records', 'list', 'items', 'forYou', 'foryou', 'movies', 'books', 'series'];
      
      for (const key of dramaKeys) {
        if (data[key] && Array.isArray(data[key])) {
          dramas = data[key] as unknown[];
          break;
        }
      }
    }
    
    return dramas.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
  }
}

// ===== GoodShort =====
export class GoodShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('GoodShort', 'goodshort', 'VIP9');
  }

  mapHome(response: unknown): DramaCard[] {
    // GoodShort returns { data: { records: [...] } }
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as Record<string, unknown>;
    
    let dramas: unknown[] = [];
    
    // Check for records in data
    if (resp?.data && typeof resp.data === 'object') {
      const data = resp.data as Record<string, unknown>;
      if (data.records && Array.isArray(data.records)) {
        dramas = data.records;
      }
    }
    
    return dramas.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
  }
}

// ===== FlexReels =====
export class FlexReelsAdapter extends GenericProviderAdapter {
  constructor() {
    super('FlexReels', 'flickreels', 'VIP9');
  }
}

// ===== FreeReels =====
export class FreeReelsAdapter extends GenericProviderAdapter {
  constructor() {
    super('FreeReels', 'freereels', 'VIP9');
  }
}

// ===== Velolo =====
export class VeloloAdapter extends GenericProviderAdapter {
  constructor() {
    super('Velolo', 'velolo', 'VIP9');
  }
}

// ===== SnackShort =====
export class SnackShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('SnackShort', 'snackshort', 'VIP9');
  }
}

// ===== ShotShort =====
export class ShotShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('ShotShort', 'shotshort', 'VIP9');
  }
}

// ===== StarShort =====
export class StarShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('StarShort', 'starshort', 'VIP9');
  }
}

// ===== RapidTV =====
export class RapidTVAdapter extends GenericProviderAdapter {
  constructor() {
    super('RapidTV', 'rapidtv', 'VIP9');
  }
}

// ===== MinuteDrama =====
export class MinuteDramaAdapter extends GenericProviderAdapter {
  constructor() {
    super('MinuteDrama', 'minutedrama', 'VIP9');
  }
}

// ===== DramaNow =====
export class DramaNowAdapter extends GenericProviderAdapter {
  constructor() {
    super('DramaNow', 'dramanow', 'VIP9');
  }
}

// ===== Shorten =====
export class ShortenAdapter extends GenericProviderAdapter {
  constructor() {
    super('Shorten', 'shorten', 'VIP9');
  }
}

// ===== ShortSky =====
export class ShortSkyAdapter extends GenericProviderAdapter {
  constructor() {
    super('ShortSky', 'shortsky', 'VIP9');
  }
}

// ===== FlickShort =====
export class FlickShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('FlickShort', 'flickshort', 'VIP9');
  }
}

// ===== DramaDash =====
export class DramaDashAdapter extends GenericProviderAdapter {
  constructor() {
    super('DramaDash', 'dramadash', 'VIP9');
  }
}

// ===== DramaWave =====
export class DramaWaveAdapter extends GenericProviderAdapter {
  constructor() {
    super('DramaWave', 'dramawave', 'VIP9');
  }
}

// ===== DramaRush =====
export class DramaRushAdapter extends GenericProviderAdapter {
  constructor() {
    super('DramaRush', 'dramarush', 'VIP9');
  }
}

// ===== DreamShort =====
export class DreamShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('DreamShort', 'dreamshort', 'VIP9');
  }
}

// ===== MyDrama =====
export class MyDramaAdapter extends GenericProviderAdapter {
  constructor() {
    super('MyDrama', 'mydrama', 'VIP9');
  }
}

// ===== iDrama =====
export class IDramaAdapter extends GenericProviderAdapter {
  constructor() {
    super('iDrama', 'idrama', 'VIP9');
  }
}

// ===== NetShort =====
export class NetShortAdapter extends GenericProviderAdapter {
  constructor() {
    super('NetShort', 'netshort', 'VIP9');
  }
}

// ===== Melolo =====
export class MeloloAdapter extends GenericProviderAdapter {
  constructor() {
    super('Melolo', 'melolo', 'VIP9');
  }
}

// ===== BiliTV =====
export class BiliTVAdapter extends GenericProviderAdapter {
  constructor() {
    super('BiliTV', 'bilitv', 'VIP9');
  }
}

// ===== DramaBite =====
export class DramaBiteAdapter extends GenericProviderAdapter {
  constructor() {
    super('DramaBite', 'dramabite', 'VIP9');
  }
}

// ===== Reelife =====
export class ReelifeAdapter extends GenericProviderAdapter {
  constructor() {
    super('Reelife', 'reelife', 'VIP9');
  }
}

// ===== Vigloo =====
export class ViglooAdapter extends GenericProviderAdapter {
  constructor() {
    super('Vigloo', 'vigloo', 'VIP9');
  }
}

// ===== ShortBox =====
export class ShortBoxAdapter extends GenericProviderAdapter {
  constructor() {
    super('ShortBox', 'shortbox', 'VIP9');
  }
}

// ===== SodaReels =====
export class SodaReelsAdapter extends GenericProviderAdapter {
  constructor() {
    super('SodaReels', 'sodareels', 'VIP9');
  }
}

// ===== RadReels =====
export class RadReelsAdapter extends GenericProviderAdapter {
  constructor() {
    super('RadReels', 'radreels', 'VIP9');
  }
}

// ===== DotDrama =====
export class DotDramaAdapter extends GenericProviderAdapter {
  constructor() {
    super('DotDrama', 'dotdrama', 'VIP9');
  }
}

// ===== DramaNova =====
export class DramaNovaAdapter extends GenericProviderAdapter {
  constructor() {
    super('DramaNova', 'dramanova', 'VIP9');
  }

  // DramaNova episodes are in detail response, not separate endpoint
  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as Record<string, unknown>;
    
    let episodes: Record<string, unknown>[] = [];
    
    if (resp?.episodes && Array.isArray(resp.episodes)) {
      episodes = resp.episodes as Record<string, unknown>[];
    } else if (resp?.data && typeof resp.data === 'object') {
      const data = resp.data as Record<string, unknown>;
      if (data.episodes && Array.isArray(data.episodes)) {
        episodes = data.episodes as Record<string, unknown>[];
      }
    }

    return episodes.map(ep => ({
      episodeId: `${this.slug}:${ep.id}`,
      providerEpisodeId: String(ep.id),
      episodeNo: Number(ep.number) || 0,
      title: String(ep.title) || `Episode ${ep.number}`,
      durationMs: 0,
      isLocked: !(ep.free),
      thumbnailUrl: undefined,
    }));
  }

  mapPlayback(response: unknown): PlaybackResponse {
    const resp = response as Record<string, unknown>;
    const streamUrl = this.extractString(resp, ['videoUrl', 'playUrl', 'url', 'streamUrl', 'filePath']) || '';
    
    return {
      streamUrl,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    };
  }
}

// ===== FlickReels =====
export class FlickReelsAdapter extends GenericProviderAdapter {
  constructor() {
    super('FlickReels', 'flickreels', 'VIP9');
  }
}
