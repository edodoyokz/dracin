'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Heart,
  Share2,
  Bookmark,
  List,
  ArrowLeft,
  SkipForward
} from 'lucide-react';
import { getPlaybackUrl, saveWatchProgress, getDramaEpisodes, getDramaDetail } from '@/lib/api-client';
import { usePlayback } from '@/hooks/usePlayback';
import type { EpisodeItem, DramaDetail } from '@/lib/types';
import {
  EpisodeDrawer,
  CustomVideoControls,
  NextEpisodeButton,
  PlaybackSettings,
  GestureOverlay,
  useKeyboardShortcuts,
  KeyboardShortcutsHelp,
  useKeyboardHelp,
  BingeModeIndicator,
} from '@/app/components/player';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const provider = params.provider as string;
  const dramaId = params.drama as string;
  const episodeNo = parseInt(params.episode as string, 10);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drama and episodes data
  const [drama, setDrama] = useState<DramaDetail | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<number[]>([]);

  // Initialize playback hook
  const playback = usePlayback({
    videoRef,
    onProgress: (currentTime, duration) => {
      // Save progress every 10 seconds
      if (Math.floor(currentTime) % 10 === 0) {
        saveWatchProgress(
          'guest',
          `${provider}:${dramaId}`,
          String(episodeNo),
          Math.floor(currentTime),
          currentTime / duration > 0.9
        );
      }
    },
    onNextEpisode: handleNextEpisode,
  });

  // Keyboard shortcuts help
  const { isHelpOpen, setIsHelpOpen } = useKeyboardHelp();

  // Setup keyboard shortcuts
  useKeyboardShortcuts({
    onTogglePlay: playback.togglePlay,
    onSeekRelative: playback.seekRelative,
    onToggleMute: playback.toggleMute,
    onToggleFullscreen: playback.toggleFullscreen,
    onToggleEpisodeDrawer: playback.toggleEpisodeDrawer,
    onNextEpisode: handleNextEpisode,
    onVolumeChange: (delta) => {
      playback.setVolume(playback.volume + delta);
    },
  });

  // Load drama data and episodes
  useEffect(() => {
    async function loadDramaData() {
      try {
        const [dramaData, episodesData] = await Promise.all([
          getDramaDetail(`${provider}:${dramaId}`),
          getDramaEpisodes(`${provider}:${dramaId}`),
        ]);

        if (dramaData) {
          setDrama(dramaData.drama);
        }
        setEpisodes(episodesData);
      } catch (err) {
        console.error('Failed to load drama data:', err);
      }
    }

    loadDramaData();
  }, [provider, dramaId]);

  // Load playback URL
  useEffect(() => {
    async function loadPlayback() {
      setLoading(true);
      setError(null);

      try {
        const playbackData = await getPlaybackUrl(
          provider,
          dramaId,
          String(episodeNo),
          'guest'
        );

        if (playbackData?.streamUrl) {
          setStreamUrl(playbackData.streamUrl);
        } else {
          setError('Video tidak tersedia');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat video');
      } finally {
        setLoading(false);
      }
    }

    loadPlayback();
  }, [provider, dramaId, episodeNo]);

  // Handle next episode
  function handleNextEpisode() {
    const currentIndex = episodes.findIndex(ep => ep.episodeNo === episodeNo);
    const nextEpisode = episodes[currentIndex + 1];

    if (nextEpisode && !nextEpisode.isLocked) {
      router.push(`/play/${provider}/${dramaId}/${nextEpisode.episodeNo}`);
    }
  }

  // Handle episode select
  const handleEpisodeSelect = useCallback((selectedEpisodeNo: number) => {
    if (selectedEpisodeNo !== episodeNo) {
      router.push(`/play/${provider}/${dramaId}/${selectedEpisodeNo}`);
    }
  }, [provider, dramaId, episodeNo, router]);

  // Find next episode info
  const currentIndex = episodes.findIndex(ep => ep.episodeNo === episodeNo);
  const nextEpisode = episodes[currentIndex + 1];
  const episodesRemaining = episodes.length - currentIndex - 1;

  return (
    <div className="fixed inset-0 z-100 bg-black">
      {/* Header */}
      <div
        className={`absolute top-0 left-0 right-0 z-130 p-4 bg-linear-to-b from-black/80 to-transparent transition-opacity duration-300 ${playback.showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-white font-semibold line-clamp-1">
                {drama?.title || 'Loading...'}
              </h1>
              <p className="text-sm text-slate-400">
                Episode {episodeNo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Episode List Button */}
            <button
              onClick={playback.toggleEpisodeDrawer}
              className={`p-2 rounded-full transition-colors ${playback.isEpisodeDrawerOpen
                ? 'bg-red-600 text-white'
                : 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20'
                }`}
              aria-label="Episode list"
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Container */}
      <div className="h-full flex flex-col">
        <div className="flex-1 relative flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-mono">Memuat video...</p>
            </div>
          ) : error ? (
            <div className="text-center p-4 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-600/20 flex items-center justify-center">
                <span className="text-2xl">😕</span>
              </div>
              <p className="text-red-500 font-bold mb-2">Gagal Memuat Video</p>
              <p className="text-slate-400 text-sm mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          ) : streamUrl ? (
            <>
              {/* Video Element */}
              <video
                ref={videoRef}
                src={streamUrl}
                autoPlay
                className="w-full h-full object-contain"
                playsInline
              />

              {/* Gesture Overlay */}
              <GestureOverlay
                onDoubleTapLeft={() => playback.seekRelative(-10)}
                onDoubleTapRight={() => playback.seekRelative(10)}
                onSingleTap={playback.togglePlay}
                isPlaying={playback.isPlaying}
              />

              {/* Custom Controls */}
              <CustomVideoControls
                playback={playback}
                onSeek={playback.seek}
                onTogglePlay={playback.togglePlay}
                onToggleMute={playback.toggleMute}
                onToggleFullscreen={playback.toggleFullscreen}
                onToggleSettings={playback.toggleSettings}
                onToggleEpisodeDrawer={playback.toggleEpisodeDrawer}
                onToggleSubtitles={playback.toggleSubtitles}
                onCyclePlaybackSpeed={playback.cyclePlaybackSpeed}
                onShowControlsTemporarily={playback.showControlsTemporarily}
              />

              {/* Settings Panel */}
              <PlaybackSettings
                isOpen={playback.isSettingsOpen}
                onClose={playback.toggleSettings}
                playback={playback}
              />

              {/* Next Episode Countdown */}
              <NextEpisodeButton
                countdown={playback.nextEpisodeCountdown}
                onCancel={playback.cancelNextEpisodeCountdown}
                onPlayNow={handleNextEpisode}
                episodeTitle={nextEpisode?.title}
                episodeNumber={nextEpisode?.episodeNo}
              />

              {/* Binge Mode Indicator */}
              <BingeModeIndicator
                isActive={playback.isAutoPlayEnabled && episodesRemaining > 0}
                episodesRemaining={episodesRemaining}
              />

              {/* Keyboard Shortcuts Help */}
              <KeyboardShortcutsHelp
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* Bottom Action Bar */}
      {!loading && !error && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-130 p-4 bg-linear-to-t from-black/80 to-transparent transition-opacity duration-300 ${playback.showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Left: Back and Episode Info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-lg text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={18} />
                <span className="hidden sm:inline">Kembali</span>
              </button>
            </div>

            {/* Center: Action Buttons */}
            <div className="flex items-center gap-3">
              <button className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors">
                <Heart size={20} />
              </button>
              <button className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors">
                <Bookmark size={20} />
              </button>
              <button className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors">
                <Share2 size={20} />
              </button>
            </div>

            {/* Right: Next Episode */}
            <div className="flex items-center gap-3">
              {nextEpisode && !nextEpisode.isLocked && (
                <button
                  onClick={handleNextEpisode}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <span className="hidden sm:inline">Episode Selanjutnya</span>
                  <span className="sm:hidden">Next</span>
                  <SkipForward size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Episode Drawer */}
      <EpisodeDrawer
        isOpen={playback.isEpisodeDrawerOpen}
        onClose={playback.toggleEpisodeDrawer}
        episodes={episodes}
        currentEpisodeNo={episodeNo}
        dramaTitle={drama?.title || ''}
        onEpisodeSelect={handleEpisodeSelect}
        watchedEpisodes={watchedEpisodes}
      />
    </div>
  );
}
