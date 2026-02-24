import { getSupabaseClient } from './client';

export interface WatchHistoryEntry {
  userId: string;
  dramaId: string;
  episodeId: string;
  progressSeconds: number;
  isCompleted: boolean;
}

export async function upsertWatchProgress(
  entry: WatchHistoryEntry
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('watch_history')
    .upsert({
      user_id: entry.userId,
      drama_id: entry.dramaId,
      episode_id: entry.episodeId,
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
