'use client';

import { useState, useEffect } from 'react';
import { getHomeDramas } from '../lib/api-client';
import type { DramaCard } from '../lib/types';

export function useHomeDramas() {
  const [dramas, setDramas] = useState<DramaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getHomeDramas();
        setDramas(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { dramas, loading, error };
}
