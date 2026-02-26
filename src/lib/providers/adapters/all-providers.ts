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

    let sections: unknown[] = [];
    if (Array.isArray(unwrapped)) {
      sections = unwrapped;
    } else if (unwrapped && typeof unwrapped === 'object') {
      const resp = unwrapped as Record<string, unknown>;
      if (Array.isArray(resp.data)) {
        sections = resp.data;
      }
    }

    const dramas: unknown[] = [];
    for (const section of sections) {
      const sectionObj = section as Record<string, unknown>;
      if (Array.isArray(sectionObj.movies)) {
        dramas.push(...sectionObj.movies);
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
    // Fundrama returns either { data: { ddriv: { lsumm: [...] } } } or unwrapped { ddriv: { lsumm: [...] } }
    const unwrapped = this.unwrapResponse(response);
    const resp = unwrapped as Record<string, unknown>;

    let dramas: unknown[] = [];

    const pickFrom = (root: Record<string, unknown> | undefined) => {
      if (!root) return;
      if (root.ddriv && typeof root.ddriv === 'object') {
        const ddriv = root.ddriv as Record<string, unknown>;
        if (Array.isArray(ddriv.lsumm)) {
          dramas = ddriv.lsumm;
        }
      }
    };

    if (resp && typeof resp === 'object') {
      pickFrom(resp);
      if (dramas.length === 0 && resp.data && typeof resp.data === 'object') {
        pickFrom(resp.data as Record<string, unknown>);
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

  // DramaNova home - use drama list or recommend
  mapHome(response: unknown): DramaCard[] {
    const unwrapped = this.unwrapResponse(response);

    // Handle array response from /api/v1/dramas
    if (Array.isArray(unwrapped)) {
      return unwrapped.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
    }

    // Handle object with data/list
    if (unwrapped && typeof unwrapped === 'object') {
      const resp = unwrapped as Record<string, unknown>;
      if (Array.isArray(resp.data)) {
        return resp.data.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
      }
      if (Array.isArray(resp.list)) {
        return resp.list.map(item => this.mapToDramaCard(item)).filter(Boolean) as DramaCard[];
      }
    }

    return super.mapHome(response);
  }

  // DramaNova search has enriched metadata
  mapSearch(response: unknown): DramaCard[] {
    const unwrapped = this.unwrapResponse(response);

    if (Array.isArray(unwrapped)) {
      return unwrapped.map(item => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;

        // Use base mapping first
        const baseCard = this.mapToDramaCard(item);
        if (!baseCard) return null;

        // Enrich with additional metadata from search response
        return {
          ...baseCard,
          episodeCount: Number(obj.episodes ?? obj.episodeCount ?? 0),
          // Search results may have different field names
          coverUrl: this.extractString(obj, ['cover', 'coverUrl', 'poster', 'thumbnail', 'image']) || baseCard.coverUrl,
        };
      }).filter(Boolean) as DramaCard[];
    }

    return super.mapSearch(response);
  }

  // DramaNova episodes are usually embedded in detail payload
  mapEpisodes(response: unknown): EpisodeItem[] {
    const resp = response as Record<string, unknown>;

    let episodes: Record<string, unknown>[] = [];

    if (resp?.episodes && Array.isArray(resp.episodes)) {
      episodes = resp.episodes as Record<string, unknown>[];
    } else if (resp?.data && typeof resp.data === 'object') {
      const data = resp.data as Record<string, unknown>;
      if (data.episodes && Array.isArray(data.episodes)) {
        episodes = data.episodes as Record<string, unknown>[];
      } else if (data.list && Array.isArray(data.list)) {
        episodes = data.list as Record<string, unknown>[];
      }
    }

    if (episodes.length === 0) {
      return super.mapEpisodes(response);
    }

    return episodes.map((ep, index) => {
      const episodeNo = Number(ep.number ?? ep.episodeNo ?? ep.ep ?? ep.serial_number) || index + 1;
      const providerEpisodeId = String(ep.id ?? ep.ep ?? ep.episodeNo ?? ep.number ?? episodeNo);
      const title = String(ep.title ?? ep.name ?? `Episode ${episodeNo}`);

      const freeValue = ep.free ?? ep.isFree ?? ep.is_free ?? ep.canWatch;
      const lockedValue = ep.isLocked ?? ep.locked ?? ep.needUnlock ?? ep.is_lock;

      let isLocked = false;
      if (freeValue !== undefined) {
        const isFree = freeValue === true || freeValue === 1 || freeValue === '1' || freeValue === 'true';
        isLocked = !isFree;
      } else if (lockedValue !== undefined) {
        isLocked = lockedValue === true || lockedValue === 1 || lockedValue === '1' || lockedValue === 'true';
      }

      return {
        episodeId: `${this.slug}:${providerEpisodeId}`,
        providerEpisodeId,
        episodeNo,
        title,
        durationMs: Number(ep.durationMs ?? ep.duration ?? 0) || 0,
        isLocked: false,
        thumbnailUrl: typeof ep.thumbnail === 'string' ? ep.thumbnail : undefined,
      };
    });
  }

  // DramaNova playback with subtitle support
  mapPlayback(response: unknown): PlaybackResponse {
    const unwrapped = this.unwrapResponse(response);

    if (!unwrapped || typeof unwrapped !== 'object') {
      throw new Error('Invalid playback response');
    }

    const obj = unwrapped as Record<string, unknown>;

    // Extract video URL - DramaNova uses "video" field
    let streamUrl = this.extractString(obj, [
      'video', 'videoUrl', 'streamUrl', 'url', 'playUrl', 'src', 'm3u8', 'mp4'
    ]);

    if (!streamUrl) {
      throw new Error('No stream URL found in playback response');
    }

    // Extract expiration
    let expiresAt = this.extractString(obj, ['expiresAt', 'expireAt', 'expireTime', 'expiration']);
    if (!expiresAt) {
      expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours default
    }

    // Extract subtitles from DramaNova format
    const subtitles = this.extractDramaNovaSubtitles(obj);

    return {
      streamUrl,
      expiresAt,
      subtitles,
    };
  }

  /**
   * Extract DramaNova subtitle format
   * Format: { "lang": "in", "url": "https://...srt" }
   */
  private extractDramaNovaSubtitles(obj: Record<string, unknown>): Array<{ src: string; srclang: string; label: string; default?: boolean }> | undefined {
    const subtitlesValue = obj.subtitles || obj.subtitle || obj.captions;

    if (!Array.isArray(subtitlesValue) || subtitlesValue.length === 0) {
      return undefined;
    }

    return subtitlesValue.map((sub: unknown) => {
      if (typeof sub !== 'object' || sub === null) return null;
      const subObj = sub as Record<string, unknown>;

      const lang = this.extractString(subObj, ['lang', 'language', 'locale', 'code']) || 'id';
      const url = this.extractString(subObj, ['url', 'src', 'file', 'vtt', 'srt']);

      if (!url) return null;

      // Map language codes to labels
      const langLabels: Record<string, string> = {
        'in': 'Indonesia',
        'id': 'Indonesia',
        'en': 'English',
        'zh': '中文',
        'ms': 'Melayu',
        'th': 'ไทย',
        'vi': 'Tiếng Việt',
      };

      return {
        src: url,
        srclang: lang,
        label: langLabels[lang] || lang,
        default: lang === 'in' || lang === 'id',
      };
    }).filter((sub): sub is NonNullable<typeof sub> => sub !== null);
  }
}

// ===== FlickReels =====
export class FlickReelsAdapter extends GenericProviderAdapter {
  constructor() {
    super('FlickReels', 'flickreels', 'VIP9');
  }
}
