'use client';

import { useState, useRef, useCallback } from 'react';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
    Minimize,
    Settings,
    SkipForward,
    SkipBack,
    Subtitles,
} from 'lucide-react';
import type { PlaybackHookReturn } from '@/hooks/usePlayback';

interface CustomVideoControlsProps {
    playback: PlaybackHookReturn;
    onSeek: (time: number) => void;
    onTogglePlay: () => void;
    onToggleMute: () => void;
    onToggleFullscreen: () => void;
    onToggleSettings: () => void;
    onToggleEpisodeDrawer: () => void;
    onToggleSubtitles: () => void;
    onCyclePlaybackSpeed: () => void;
    onShowControlsTemporarily: () => void;
}

export function CustomVideoControls({
    playback,
    onSeek,
    onTogglePlay,
    onToggleMute,
    onToggleFullscreen,
    onToggleSettings,
    onToggleEpisodeDrawer,
    onToggleSubtitles,
    onCyclePlaybackSpeed,
    onShowControlsTemporarily,
}: CustomVideoControlsProps) {
    const progressRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverPosition, setHoverPosition] = useState(0);

    const progress = playback.duration > 0
        ? (playback.currentTime / playback.duration) * 100
        : 0;

    const buffered = playback.duration > 0
        ? (playback.buffered / playback.duration) * 100
        : 0;

    // Calculate time from mouse position
    const calculateTimeFromPosition = useCallback((clientX: number): number => {
        if (!progressRef.current || !playback.duration) return 0;

        const rect = progressRef.current.getBoundingClientRect();
        const position = (clientX - rect.left) / rect.width;
        return Math.max(0, Math.min(1, position)) * playback.duration;
    }, [playback.duration]);

    // Handle progress bar click/drag
    const handleProgressMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        const time = calculateTimeFromPosition(e.clientX);
        onSeek(time);
    };

    const handleProgressMouseMove = (e: React.MouseEvent) => {
        if (!progressRef.current) return;

        const rect = progressRef.current.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setHoverPosition(position * 100);
        setHoverTime(calculateTimeFromPosition(e.clientX));

        if (isDragging) {
            onSeek(calculateTimeFromPosition(e.clientX));
        }
    };

    const handleProgressMouseLeave = () => {
        setHoverTime(null);
        setIsDragging(false);
    };

    const handleProgressMouseUp = () => {
        setIsDragging(false);
    };

    // Global mouse up handler for drag release
    const handleGlobalMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Attach global mouse up listener
    if (typeof window !== 'undefined' && isDragging) {
        window.addEventListener('mouseup', handleGlobalMouseUp, { once: true });
    }

    // Handle volume bar click
    const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const volume = (e.clientX - rect.left) / rect.width;
        playback.setVolume(volume);
    };

    return (
        <div
            className={`absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 ${playback.showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            onMouseMove={onShowControlsTemporarily}
            onClick={onShowControlsTemporarily}
        >
            {/* Top bar - Title and Episode */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-linear-to-b from-black/80 to-transparent">
                <div className="flex items-center justify-between">
                    <div className="text-white">
                        {/* Title will be passed from parent */}
                    </div>
                </div>
            </div>

            {/* Center controls - Play/Pause */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePlay();
                    }}
                    className={`w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:bg-white/30 hover:scale-110 pointer-events-auto ${playback.isPlaying ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
                        }`}
                >
                    {playback.isPlaying ? (
                        <Pause size={32} className="text-white ml-0" />
                    ) : (
                        <Play size={32} className="text-white ml-1" fill="white" />
                    )}
                </button>
            </div>

            {/* Bottom controls */}
            <div className="p-4 space-y-2">
                {/* Progress bar */}
                <div
                    ref={progressRef}
                    className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group"
                    onMouseDown={handleProgressMouseDown}
                    onMouseMove={handleProgressMouseMove}
                    onMouseLeave={handleProgressMouseLeave}
                    onMouseUp={handleProgressMouseUp}
                >
                    {/* Buffered progress */}
                    <div
                        className="absolute h-full bg-white/30 rounded-full"
                        style={{ width: `${buffered}%` }}
                    />

                    {/* Playback progress */}
                    <div
                        className="absolute h-full bg-red-600 rounded-full transition-all duration-100"
                        style={{ width: `${progress}%` }}
                    />

                    {/* Hover preview */}
                    {hoverTime !== null && !isDragging && (
                        <>
                            <div
                                className="absolute top-0 h-full w-0.5 bg-white/50"
                                style={{ left: `${hoverPosition}%` }}
                            />
                            <div
                                className="absolute -top-10 transform -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-xs text-white"
                                style={{ left: `${hoverPosition}%` }}
                            >
                                {playback.formatTime(hoverTime)}
                            </div>
                        </>
                    )}

                    {/* Seek handle */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
                    />
                </div>

                {/* Control buttons */}
                <div className="flex items-center justify-between">
                    {/* Left controls */}
                    <div className="flex items-center gap-2">
                        {/* Play/Pause */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePlay();
                            }}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            aria-label={playback.isPlaying ? 'Pause' : 'Play'}
                        >
                            {playback.isPlaying ? (
                                <Pause size={24} className="text-white" />
                            ) : (
                                <Play size={24} className="text-white" />
                            )}
                        </button>

                        {/* Skip backward */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                playback.seekRelative(-10);
                            }}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            aria-label="Skip back 10s"
                        >
                            <SkipBack size={20} className="text-white" />
                        </button>

                        {/* Skip forward */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                playback.seekRelative(10);
                            }}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            aria-label="Skip forward 10s"
                        >
                            <SkipForward size={20} className="text-white" />
                        </button>

                        {/* Time display */}
                        <div className="text-sm text-white font-medium tabular-nums">
                            <span>{playback.formatTime(playback.currentTime)}</span>
                            <span className="text-white/60 mx-1">/</span>
                            <span className="text-white/60">{playback.formatTime(playback.duration)}</span>
                        </div>

                        {/* Volume control */}
                        <div className="flex items-center gap-2 group ml-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleMute();
                                }}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                aria-label={playback.isMuted ? 'Unmute' : 'Mute'}
                            >
                                {playback.isMuted || playback.volume === 0 ? (
                                    <VolumeX size={20} className="text-white" />
                                ) : (
                                    <Volume2 size={20} className="text-white" />
                                )}
                            </button>

                            {/* Volume slider */}
                            <div
                                className="w-0 overflow-hidden group-hover:w-20 transition-all duration-200"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div
                                    className="h-1 bg-white/30 rounded-full cursor-pointer mx-2"
                                    onClick={handleVolumeClick}
                                >
                                    <div
                                        className="h-full bg-white rounded-full"
                                        style={{ width: `${playback.isMuted ? 0 : playback.volume * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-1">
                        {/* Subtitles toggle */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSubtitles();
                            }}
                            className={`p-2 rounded-full transition-colors ${playback.showSubtitles ? 'bg-white/20' : 'hover:bg-white/10'
                                }`}
                            aria-label="Toggle subtitles"
                        >
                            <Subtitles size={20} className="text-white" />
                        </button>

                        {/* Playback speed */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCyclePlaybackSpeed();
                            }}
                            className="px-2 py-1 hover:bg-white/10 rounded transition-colors min-w-[40px]"
                            aria-label="Change playback speed"
                        >
                            <span className="text-sm text-white font-medium">
                                {playback.playbackSpeed}x
                            </span>
                        </button>

                        {/* Settings */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSettings();
                            }}
                            className={`p-2 rounded-full transition-colors ${playback.isSettingsOpen ? 'bg-white/20' : 'hover:bg-white/10'
                                }`}
                            aria-label="Settings"
                        >
                            <Settings size={20} className="text-white" />
                        </button>

                        {/* Fullscreen */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFullscreen();
                            }}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            aria-label={playback.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {playback.isFullscreen ? (
                                <Minimize size={20} className="text-white" />
                            ) : (
                                <Maximize size={20} className="text-white" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Buffering indicator */}
            {playback.isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
                    <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}