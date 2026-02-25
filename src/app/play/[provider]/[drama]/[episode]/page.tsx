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
  SkipForward,
  Play
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
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
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
    const controller = new AbortController();
    const signal = controller.signal;

    async function loadDramaData() {
      try {
        const [dramaData, episodesData] = await Promise.all([
          getDramaDetail(`${provider}:${dramaId}`),
          getDramaEpisodes(`${provider}:${dramaId}`),
        ]);

        // Only update if not cancelled
        if (!signal.aborted) {
          if (dramaData) {
            setDrama(dramaData.drama);
          }
          setEpisodes(episodesData);
        }
      } catch (err) {
        // Only log if not cancelled
        if (!signal.aborted) {
          console.error('Failed to load drama data:', err);
        }
      }
    }

    loadDramaData();

    return () => {
      controller.abort();
    };
  }, [provider, dramaId]);

  // Load playback URL
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const requestedEpisodeNo = episodeNo;

    async function loadPlayback() {
      // Check if still the same episode
      if (signal.aborted) return;

      setLoading(true);
      setError(null);

      try {
        const playbackData = await getPlaybackUrl(
          provider,
          dramaId,
          String(requestedEpisodeNo),
          'guest'
        );

        // Only update if not cancelled and still the same episode
        if (!signal.aborted) {
          if (playbackData?.streamUrl) {
            setStreamUrl(playbackData.streamUrl);
          } else {
            setError('Video tidak tersedia');
          }
        }
      } catch (err) {
        // Only update if not cancelled
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : 'Gagal memuat video');
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadPlayback();

    return () => {
      controller.abort();
    };
  }, [provider, dramaId, episodeNo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let mounted = true;

    const cleanupCurrentSource = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const setupSource = async () => {
      cleanupCurrentSource();

      const isHlsStream = /\.m3u8(\?|$)/i.test(streamUrl);
      if (!isHlsStream) {
        video.src = streamUrl;
        return;
      }

      const canPlayNativeHls =
        video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
        video.canPlayType('application/x-mpegURL') !== '';

      if (canPlayNativeHls) {
        video.src = streamUrl;
        return;
      }

      try {
        const { default: Hls } = await import('hls.js');
        if (!mounted) return;

        if (!Hls.isSupported()) {
          setError('Browser tidak mendukung format HLS untuk video ini');
          return;
        }

        const hls = new Hls({
          enableWorker: true,
        });

        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean; type?: string }) => {
          if (!data?.fatal) return;

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }

          setError('Gagal memuat stream video HLS');
          hls.destroy();
          hlsRef.current = null;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat engine HLS');
      }
    };

    setupSource();

    return () => {
      mounted = false;
      cleanupCurrentSource();
    };
  }, [streamUrl]);

  // Handle next episode
  function handleNextEpisode() {
    const currentIndex = episodes.findIndex(ep => ep.episodeNo === episodeNo);
    const nextEpisode = episodes[currentIndex + 1];

    if (nextEpisode && !nextEpisode.isLocked) {
      router.push(`/play/${provider}/${dramaId}/${nextEpisode.episodeNo}`);
    }
  }

  // Handle video error
  function handleVideoError(e: React.SyntheticEvent<HTMLVideoElement, Event>) {
    const video = e.currentTarget;
    console.error('Video error:', video.error?.code, video.error?.message);
    setError('Gagal memuat video');
    setLoading(false);
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
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/20 transition-all duration-300 pointer-events-auto"
              aria-label="Go back"
            >
              <ArrowLeft size={22} className="text-white" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-white font-semibold line-clamp-1 drop-shadow-md text-lg">
                {drama?.title || 'Loading...'}
              </h1>
              <p className="text-sm text-white/80 drop-shadow-md">
                Episode {episodeNo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Action Buttons */}
            <div className="hidden md:flex items-center gap-2 mr-2">
              <button className="p-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-all duration-300">
                <Heart size={20} />
              </button>
              <button className="p-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-all duration-300">
                <Bookmark size={20} />
              </button>
              <button className="p-2.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-all duration-300">
                <Share2 size={20} />
              </button>
            </div>

            {/* Next Episode Button (Top Right) */}
            {nextEpisode && !nextEpisode.isLocked && (
              <button
                onClick={handleNextEpisode}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full hover:bg-white/20 transition-all duration-300"
              >
                <span className="text-sm font-medium">Episode Berikutnya</span>
                <SkipForward size={18} />
              </button>
            )}

            <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block"></div>

            {/* Episode List Button */}
            <button
              onClick={playback.toggleEpisodeDrawer}
              className={`p-2.5 rounded-full border border-white/10 transition-all duration-300 flex items-center gap-2 px-4 ${playback.isEpisodeDrawerOpen
                ? 'bg-red-600 text-white border-transparent'
                : 'bg-black/40 backdrop-blur-md text-white hover:bg-white/20'
                }`}
              aria-label="Episode list"
            >
              <List size={20} />
              <span className="hidden sm:inline text-sm font-medium">Episodes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Container */}
      <div className="h-full flex flex-col">
        <div className="flex-1 relative flex items-center justify-center">
          {loading ? (
            <div className="absolute inset-0 flex flex-col justify-center items-center bg-zinc-950 z-100">
              <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                <Play size={24} className="text-white/50 ml-1 animate-pulse" fill="currentColor" />
              </div>
              <p className="text-white/70 font-medium tracking-wide">Menyiapkan video...</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col justify-center items-center bg-zinc-950 z-100 p-6">
              <div className="w-20 h-20 mb-6 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-red-600/20 animate-ping opacity-50"></div>
                <span className="text-3xl relative z-10">😕</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Gagal Memuat Video</h3>
              <p className="text-slate-400 text-center max-w-sm mb-8 leading-relaxed">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 hover:scale-105 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] font-medium"
              >
                Coba Lagi
              </button>
            </div>
          ) : streamUrl ? (
            <>
              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
                onError={handleVideoError}
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
