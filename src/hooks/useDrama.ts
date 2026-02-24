'use client';

import { useState, useEffect } from 'react';
import { getDramaDetail, getDramaEpisodes } from '../lib/api-client';
import type { DramaDetail, EpisodeItem } from '../lib/types';

export function useDramaDetail(id: string) {
  const [drama, setDrama] = useState<DramaDetail | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [dramaData, episodesData] = await Promise.all([
          getDramaDetail(id),
          getDramaEpisodes(id),
        ]);
        setDrama(dramaData);
        setEpisodes(episodesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  return { drama, episodes, loading, error };
}
