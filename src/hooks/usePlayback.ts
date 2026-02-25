'use client';

import { useState, useCallback, useEffect, useRef, RefObject } from 'react';

interface UsePlaybackOptions {
    videoRef: RefObject<HTMLVideoElement | null>;
    onProgress?: (currentTime: number, duration: number) => void;
    onEnded?: () => void;
    onNextEpisode?: () => void;
}

interface PlaybackState {
    currentTime: number;
    duration: number;
    volume: number;
    isPlaying: boolean;
    isFullscreen: boolean;
    isMuted: boolean;
    playbackSpeed: number;
    showSubtitles: boolean;
    isBuffering: boolean;
    buffered: number;
}

interface UIState {
    isEpisodeDrawerOpen: boolean;
    isSettingsOpen: boolean;
    isAutoPlayEnabled: boolean;
    nextEpisodeCountdown: number | null;
    showControls: boolean;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const AUTOPLAY_COUNTDOWN = 5;

export function usePlayback({ videoRef, onProgress, onEnded, onNextEpisode }: UsePlaybackOptions) {
    // Playback state
    const [playback, setPlayback] = useState<PlaybackState>({
        currentTime: 0,
        duration: 0,
        volume: 1,
        isPlaying: false,
        isFullscreen: false,
        isMuted: false,
        playbackSpeed: 1,
        showSubtitles: true,
        isBuffering: false,
        buffered: 0,
    });

    // UI state
    const [ui, setUI] = useState<UIState>({
        isEpisodeDrawerOpen: false,
        isSettingsOpen: false,
        isAutoPlayEnabled: true,
        nextEpisodeCountdown: null,
        showControls: true,
    });

    // Refs for timers and intervals
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const hideControlsDelay = 3000;

    // Load auto-play preference from localStorage
    useEffect(() => {
        const savedAutoPlay = localStorage.getItem('dracinhub_autoplay');
        if (savedAutoPlay !== null) {
            setUI(prev => ({ ...prev, isAutoPlayEnabled: savedAutoPlay === 'true' }));
        }
    }, []);

    // Save auto-play preference
    const setAutoPlayEnabled = useCallback((enabled: boolean) => {
        localStorage.setItem('dracinhub_autoplay', String(enabled));
        setUI(prev => ({ ...prev, isAutoPlayEnabled: enabled }));
    }, []);

    // Toggle play/pause
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }, [videoRef]);

    // Seek to time
    const seek = useCallback((time: number) => {
        const video = videoRef.current;
        if (!video) return;

        const newTime = Math.max(0, Math.min(time, video.duration || 0));
        video.currentTime = newTime;
    }, [videoRef]);

    // Seek relative (forward/backward)
    const seekRelative = useCallback((delta: number) => {
        const video = videoRef.current;
        if (!video) return;

        seek(video.currentTime + delta);
    }, [videoRef, seek]);

    // Set volume
    const setVolume = useCallback((volume: number) => {
        const video = videoRef.current;
        if (!video) return;

        const newVolume = Math.max(0, Math.min(1, volume));
        video.volume = newVolume;
        if (newVolume > 0 && video.muted) {
            video.muted = false;
        }
    }, [videoRef]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !video.muted;
    }, [videoRef]);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            if (!document.fullscreenElement) {
                await video.requestFullscreen();
                setPlayback(prev => ({ ...prev, isFullscreen: true }));
            } else {
                await document.exitFullscreen();
                setPlayback(prev => ({ ...prev, isFullscreen: false }));
            }
        } catch {
            // Fullscreen not supported
        }
    }, [videoRef]);

    // Cycle through playback speeds
    const cyclePlaybackSpeed = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        const currentIndex = PLAYBACK_SPEEDS.indexOf(playback.playbackSpeed);
        const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
        const newSpeed = PLAYBACK_SPEEDS[nextIndex];

        video.playbackRate = newSpeed;
        setPlayback(prev => ({ ...prev, playbackSpeed: newSpeed }));
    }, [videoRef, playback.playbackSpeed]);

    // Set specific playback speed
    const setPlaybackSpeed = useCallback((speed: number) => {
        const video = videoRef.current;
        if (!video) return;

        video.playbackRate = speed;
        setPlayback(prev => ({ ...prev, playbackSpeed: speed }));
    }, [videoRef]);

    // Toggle subtitles
    const toggleSubtitles = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        // Toggle text tracks
        const tracks = video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
            tracks[i].mode = playback.showSubtitles ? 'disabled' : 'showing';
        }

        setPlayback(prev => ({ ...prev, showSubtitles: !prev.showSubtitles }));
    }, [videoRef, playback.showSubtitles]);

    // Toggle episode drawer
    const toggleEpisodeDrawer = useCallback(() => {
        setUI(prev => ({ ...prev, isEpisodeDrawerOpen: !prev.isEpisodeDrawerOpen }));
    }, []);

    // Toggle settings
    const toggleSettings = useCallback(() => {
        setUI(prev => ({ ...prev, isSettingsOpen: !prev.isSettingsOpen }));
    }, []);

    // Show/hide controls
    const showControlsTemporarily = useCallback(() => {
        setUI(prev => ({ ...prev, showControls: true }));

        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }

        controlsTimeoutRef.current = setTimeout(() => {
            if (!ui.isEpisodeDrawerOpen && !ui.isSettingsOpen) {
                setUI(prev => ({ ...prev, showControls: false }));
            }
        }, hideControlsDelay);
    }, [ui.isEpisodeDrawerOpen, ui.isSettingsOpen]);

    // Start next episode countdown
    const startNextEpisodeCountdown = useCallback(() => {
        if (!ui.isAutoPlayEnabled || ui.nextEpisodeCountdown !== null) return;

        setUI(prev => ({ ...prev, nextEpisodeCountdown: AUTOPLAY_COUNTDOWN }));

        countdownIntervalRef.current = setInterval(() => {
            setUI(prev => {
                if (prev.nextEpisodeCountdown === null || prev.nextEpisodeCountdown <= 1) {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                    }
                    if (prev.nextEpisodeCountdown !== null && onNextEpisode) {
                        onNextEpisode();
                    }
                    return { ...prev, nextEpisodeCountdown: null };
                }
                return { ...prev, nextEpisodeCountdown: prev.nextEpisodeCountdown - 1 };
            });
        }, 1000);
    }, [ui.isAutoPlayEnabled, ui.nextEpisodeCountdown, onNextEpisode]);

    // Cancel next episode countdown
    const cancelNextEpisodeCountdown = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
        setUI(prev => ({ ...prev, nextEpisodeCountdown: null }));
    }, []);

    // Video event handlers
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            const current = video.currentTime;
            const duration = video.duration || 0;

            setPlayback(prev => ({
                ...prev,
                currentTime: current,
                duration: duration,
                buffered: video.buffered.length > 0
                    ? video.buffered.end(video.buffered.length - 1)
                    : 0,
            }));

            onProgress?.(current, duration);

            // Start countdown when video is near end (>90% and last 10 seconds)
            if (duration > 0 && current / duration > 0.9 && duration - current < 10) {
                startNextEpisodeCountdown();
            }
        };

        const handlePlay = () => {
            setPlayback(prev => ({ ...prev, isPlaying: true }));
        };

        const handlePause = () => {
            setPlayback(prev => ({ ...prev, isPlaying: false }));
        };

        const handleVolumeChange = () => {
            setPlayback(prev => ({
                ...prev,
                volume: video.volume,
                isMuted: video.muted,
            }));
        };

        const handleLoadedMetadata = () => {
            setPlayback(prev => ({
                ...prev,
                duration: video.duration || 0,
            }));
        };

        const handleWaiting = () => {
            setPlayback(prev => ({ ...prev, isBuffering: true }));
        };

        const handleCanPlay = () => {
            setPlayback(prev => ({ ...prev, isBuffering: false }));
        };

        const handleEnded = () => {
            onEnded?.();
            if (ui.isAutoPlayEnabled) {
                startNextEpisodeCountdown();
            }
        };

        const handleFullscreenChange = () => {
            setPlayback(prev => ({
                ...prev,
                isFullscreen: !!document.fullscreenElement,
            }));
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('ended', handleEnded);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('ended', handleEnded);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [videoRef, onProgress, onEnded, ui.isAutoPlayEnabled, startNextEpisodeCountdown]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, []);

    // Format time as MM:SS or HH:MM:SS
    const formatTime = useCallback((seconds: number): string => {
        if (!isFinite(seconds) || seconds < 0) return '0:00';

        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Destructure ui without showControls to avoid conflict
    const { showControls: showControlsState, ...restUI } = ui;

    return {
        // State from playback
        ...playback,
        // State from ui (without showControls)
        ...restUI,
        // showControls boolean state
        showControls: showControlsState,

        // Actions
        togglePlay,
        seek,
        seekRelative,
        setVolume,
        toggleMute,
        toggleFullscreen,
        cyclePlaybackSpeed,
        setPlaybackSpeed,
        toggleSubtitles,
        toggleEpisodeDrawer,
        toggleSettings,
        showControlsTemporarily,
        setAutoPlayEnabled,
        cancelNextEpisodeCountdown,

        // Utilities
        formatTime,
        PLAYBACK_SPEEDS,
        AUTOPLAY_COUNTDOWN,
    };
}

export type PlaybackHookReturn = ReturnType<typeof usePlayback>;