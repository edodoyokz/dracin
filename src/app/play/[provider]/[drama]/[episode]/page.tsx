'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { X, Heart, Share2, Bookmark } from 'lucide-react';
import { getPlaybackUrl, saveWatchProgress } from '../../lib/api-client';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const provider = params.provider as string;
  const dramaId = params.drama as string;
  const episodeNo = params.episode as string;
  
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    async function loadPlayback() {
      try {
        const playback = await getPlaybackUrl(
          provider,
          dramaId,
          episodeNo,
          'guest'
        );
        
        if (playback) {
          setStreamUrl(playback.streamUrl);
        } else {
          setError('Failed to load video');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Playback failed');
      } finally {
        setLoading(false);
      }
    }

    loadPlayback();
  }, [provider, dramaId, episodeNo]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (progress > 0) {
        saveWatchProgress(
          'guest',
          `${provider}:${dramaId}`,
          episodeNo,
          Math.floor(progress),
          false
        );
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [progress, provider, dramaId, episodeNo]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <button
        onClick={() => router.back()}
        className="absolute top-6 left-6 z-10 p-2 bg-white/10 backdrop-blur-md rounded-full"
      >
        <X size={20} />
      </button>

      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {loading ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Loading video...</p>
            </div>
          ) : error ? (
            <div className="text-center p-4">
              <p className="text-red-500 font-bold mb-2">Error</p>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          ) : streamUrl ? (
            <video
              src={streamUrl}
              controls
              autoPlay
              className="w-full h-full max-h-[85vh]"
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
            />
          ) : null}

          {!loading && !error && (
            <div className="absolute right-4 bottom-24 flex flex-col space-y-6 items-center">
              <div className="flex flex-col items-center">
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full mb-1">
                  <Heart size={24} className="text-white" />
                </div>
                <span className="text-[10px] font-bold">12K</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full mb-1">
                  <Bookmark size={24} className="text-white" />
                </div>
                <span className="text-[10px] font-bold">Save</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full mb-1">
                  <Share2 size={24} className="text-white" />
                </div>
                <span className="text-[10px] font-bold">Share</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
