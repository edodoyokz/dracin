'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, List } from 'lucide-react';
import { getPlaybackUrl, getDramaEpisodes, getDramaDetail } from '@/lib/api-client';
import type { EpisodeItem, DramaDetail, PlaybackResponse } from '@/lib/types';
import { EpisodeDrawer } from '@/app/components/player';

export default function SimplePlayer() {
  const params = useParams();
  const router = useRouter();
  const provider = params.provider as string;
  const dramaId = params.drama as string;
  const episodeNo = parseInt(params.episode as string, 10);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackData, setPlaybackData] = useState<PlaybackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drama, setDrama] = useState<DramaDetail | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);

  // Load data
  useEffect(() => {
    Promise.all([
      getDramaDetail(`${provider}:${dramaId}`),
      getDramaEpisodes(`${provider}:${dramaId}`),
    ]).then(([dramaData, episodesData]) => {
      if (dramaData) setDrama(dramaData.drama);
      setEpisodes(episodesData);
    }).catch(console.error);
  }, [provider, dramaId]);

  // Load playback URL
  useEffect(() => {
    setLoading(true);
    setError(null);

    getPlaybackUrl(provider, dramaId, String(episodeNo), 'guest')
      .then((data) => {
        if (data?.streamUrl) {
          setPlaybackData(data);
        } else {
          setError('Video tidak tersedia');
        }
      })
      .catch((err) => setError(err.message || 'Gagal memuat video'))
      .finally(() => setLoading(false));
  }, [provider, dramaId, episodeNo]);

  const handleNextEpisode = () => {
    const currentIndex = episodes.findIndex((ep) => ep.episodeNo === episodeNo);
    const nextEpisode = episodes[currentIndex + 1];
    if (nextEpisode && !nextEpisode.isLocked) {
      router.push(`/play/${provider}/${dramaId}/${nextEpisode.episodeNo}`);
    }
  };

  const handleEpisodeSelect = (selectedEpisodeNo: number) => {
    if (selectedEpisodeNo !== episodeNo) {
      router.push(`/play/${provider}/${dramaId}/${selectedEpisodeNo}`);
    }
    setShowDrawer(false);
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Simple Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
        <button
          onClick={() => router.push(`/dramas/${provider}:${dramaId}`)}
          className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-white text-sm font-medium">
          {drama?.title || 'Loading...'} - Ep {episodeNo}
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
        >
          <List size={20} />
        </button>
      </div>

      {/* Video Container */}
      <div className="flex-1 flex items-center justify-center">
        {loading && (
          <div className="text-white text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>Memuat video...</p>
          </div>
        )}

        {error && (
          <div className="text-white text-center p-6">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 rounded-full hover:bg-red-700"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {playbackData?.streamUrl && (
          <video
            ref={videoRef}
            src={playbackData.streamUrl}
            autoPlay
            playsInline
            controls
            className="w-full h-full max-h-screen"
            onEnded={handleNextEpisode}
          >
            {/* Render subtitle tracks */}
            {playbackData.subtitles?.map((sub, index) => (
              <track
                key={index}
                kind="subtitles"
                src={sub.src}
                srcLang={sub.srclang}
                label={sub.label}
                default={sub.default}
              />
            ))}
          </video>
        )}
      </div>

      {/* Episode Drawer */}
      <EpisodeDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        episodes={episodes}
        currentEpisodeNo={episodeNo}
        dramaTitle={drama?.title || ''}
        onEpisodeSelect={handleEpisodeSelect}
      />
    </div>
  );
}
