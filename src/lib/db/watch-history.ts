import { getSupabaseClient } from './client';

export interface WatchHistoryEntry {
  userId: string;
  dramaId: string;
  episodeId: string; // Can be UUID or provider-specific ID
  progressSeconds: number;
  isCompleted: boolean;
}

/**
 * Resolve episode ID to database UUID if possible
 * 
 * The episodeId from the client can be:
 * 1. A UUID (already the database episode.id) - return as-is
 * 2. A provider-specific ID (episode number, slug, etc.) - look up in DB
 * 
 * Returns null if the episode cannot be found (progress saved without episode FK)
 */
async function resolveEpisodeId(
  dramaId: string,
  episodeId: string
): Promise<string | null> {
  // Check if it's already a UUID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(episodeId)) {
    return episodeId;
  }

  const supabase = getSupabaseClient();

  // Try to resolve by episode_no (numeric string)
  const episodeNo = parseInt(episodeId, 10);
  if (!isNaN(episodeNo)) {
    const { data } = await supabase
      .from('episodes')
      .select('id')
      .eq('drama_id', dramaId)
      .eq('episode_no', episodeNo)
      .single();

    if (data) {
      return data.id;
    }
  }

  // Try to resolve by provider_episode_id
  const { data: byProviderId } = await supabase
    .from('episodes')
    .select('id')
    .eq('drama_id', dramaId)
    .eq('provider_episode_id', episodeId)
    .single();

  if (byProviderId) {
    return byProviderId.id;
  }

  // Try to resolve by slug
  const { data: bySlug } = await supabase
    .from('episodes')
    .select('id')
    .eq('drama_id', dramaId)
    .eq('slug', episodeId)
    .single();

  if (bySlug) {
    return bySlug.id;
  }

  // Try to resolve by chapter_id
  const { data: byChapter } = await supabase
    .from('episodes')
    .select('id')
    .eq('drama_id', dramaId)
    .eq('chapter_id', episodeId)
    .single();

  if (byChapter) {
    return byChapter.id;
  }

  // Episode not found - return null (progress saved without episode FK)
  return null;
}

export async function upsertWatchProgress(
  entry: WatchHistoryEntry
): Promise<void> {
  const supabase = getSupabaseClient();

  // Resolve episode ID to UUID if possible
  const resolvedEpisodeId = await resolveEpisodeId(entry.dramaId, entry.episodeId);

  const { error } = await supabase
    .from('watch_history')
    .upsert({
      user_id: entry.userId,
      drama_id: entry.dramaId,
      episode_id: resolvedEpisodeId, // null if episode not found
      progress_seconds: entry.progressSeconds,
      is_completed: entry.isCompleted,
      last_watched_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,drama_id,episode_id',
    });

  if (error) {
    throw new Error(`Failed to save watch progress: ${error.message}`);
  }
}

export async function getContinueWatching(
  userId: string,
  limit: number = 10
): Promise<Array<{
  dramaId: string;
  dramaTitle: string;
  episodeId: string;
  episodeNo: number;
  progressSeconds: number;
  coverUrl: string;
}>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('watch_history')
    .select(`
      drama_id,
      episode_id,
      progress_seconds,
      dramas(id, title, cover_url),
      episodes(id, episode_no)
    `)
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('last_watched_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch continue watching: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    dramaId: row.drama_id,
    dramaTitle: row.dramas?.title || '',
    episodeId: row.episode_id,
    episodeNo: row.episodes?.episode_no || 0,
    progressSeconds: row.progress_seconds,
    coverUrl: row.dramas?.cover_url || '',
  }));
}
