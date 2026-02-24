import { getSupabaseClient } from './client';
import type { DramaCard, DramaDetail, EpisodeItem } from '../types';

export interface DbDrama {
  id: string;
  provider_slug: string;
  provider_drama_id: string;
  title: string;
  synopsis: string;
  cover_url: string;
  cover_urls: string[];
  language: string;
  genres: string[];
  tags: string[];
  episode_count: number;
  is_premium: boolean;
  popularity_score: number;
  last_provider_update: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
  providers?: {
    name: string;
  };
}

export interface DbEpisode {
  id: string;
  drama_id: string;
  provider_slug: string;
  provider_episode_id: string;
  episode_no: number;
  chapter_id: string;
  slug: string;
  title: string;
  duration_ms: number;
  is_locked: boolean;
  last_synced_at: string;
}

export async function getHomeDramas(limit: number = 20): Promise<DramaCard[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('dramas')
    .select(`
      *,
      providers!inner(name)
    `)
    .eq('providers.status', 'active')
    .order('popularity_score', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch home dramas: ${error.message}`);
  }

  return (data as DbDrama[]).map(mapDbDramaToCard);
}

export async function getDramaById(id: string): Promise<DramaDetail | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('dramas')
    .select(`
      *,
      providers!inner(name)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapDbDramaToDetail(data as DbDrama);
}

export async function getDramaByProviderId(
  providerSlug: string, 
  providerDramaId: string
): Promise<DramaDetail | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('dramas')
    .select(`
      *,
      providers!inner(name)
    `)
    .eq('provider_slug', providerSlug)
    .eq('provider_drama_id', providerDramaId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapDbDramaToDetail(data as DbDrama);
}

export async function getEpisodesByDramaId(dramaId: string): Promise<EpisodeItem[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('episodes')
    .select('*')
    .eq('drama_id', dramaId)
    .order('episode_no', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch episodes: ${error.message}`);
  }

  return (data as DbEpisode[]).map(mapDbEpisodeToItem);
}

export async function searchDramas(query: string, limit: number = 20): Promise<DramaCard[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('dramas')
    .select(`
      *,
      providers!inner(name)
    `)
    .textSearch('title', query)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search dramas: ${error.message}`);
  }

  return (data as DbDrama[]).map(mapDbDramaToCard);
}

function mapDbDramaToCard(drama: DbDrama): DramaCard {
  return {
    id: drama.id,
    providerSlug: drama.provider_slug,
    providerDramaId: drama.provider_drama_id,
    title: drama.title,
    coverUrl: drama.cover_url,
    episodeCount: drama.episode_count,
    rating: drama.popularity_score,
    tags: drama.tags || [],
    isPremium: drama.is_premium,
    providerName: drama.providers?.name || drama.provider_slug,
    vipLevel: 'VIP9',
  };
}

function mapDbDramaToDetail(drama: DbDrama): DramaDetail {
  return {
    ...mapDbDramaToCard(drama),
    synopsis: drama.synopsis,
    genres: drama.genres || [],
    language: drama.language,
    lastUpdated: drama.last_synced_at,
    popularityScore: drama.popularity_score,
  };
}

function mapDbEpisodeToItem(episode: DbEpisode): EpisodeItem {
  return {
    episodeId: episode.id,
    providerEpisodeId: episode.provider_episode_id,
    episodeNo: episode.episode_no,
    chapterId: episode.chapter_id,
    slug: episode.slug,
    title: episode.title,
    durationMs: episode.duration_ms,
    isLocked: episode.is_locked,
  };
}
