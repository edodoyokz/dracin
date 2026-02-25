'use client';

import { useEffect, useRef } from 'react';
import { X, Play, Lock, CheckCircle2 } from 'lucide-react';
import type { EpisodeItem } from '@/lib/types';

interface EpisodeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    episodes: EpisodeItem[];
    currentEpisodeNo: number;
    dramaTitle: string;
    onEpisodeSelect: (episodeNo: number) => void;
    watchedEpisodes?: number[];
    episodeProgress?: Record<number, number>; // episodeNo -> progressPercent
}

export function EpisodeDrawer({
    isOpen,
    onClose,
    episodes,
    currentEpisodeNo,
    dramaTitle,
    onEpisodeSelect,
    watchedEpisodes = [],
    episodeProgress = {},
}: EpisodeDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLButtonElement>(null);

    // Scroll to current episode when opened
    useEffect(() => {
        if (isOpen && currentRef.current) {
            currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const formatDuration = (ms: number): string => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        if (minutes < 60) {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div
            className={`fixed inset-0 z-200 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            onClick={handleBackdropClick}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Drawer */}
            <div
                ref={drawerRef}
                className={`absolute right-0 top-0 h-full w-full max-w-md bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-white line-clamp-1">{dramaTitle}</h2>
                        <p className="text-sm text-slate-400">
                            {episodes.length} Episode{episodes.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Close episodes"
                    >
                        <X size={24} className="text-white" />
                    </button>
                </div>

                {/* Episode List */}
                <div className="overflow-y-auto h-[calc(100%-80px)] p-2 space-y-1">
                    {episodes.map((episode) => {
                        const isCurrent = episode.episodeNo === currentEpisodeNo;
                        const isWatched = watchedEpisodes.includes(episode.episodeNo);
                        const isLocked = episode.isLocked;
                        const progress = episodeProgress[episode.episodeNo] || 0;

                        return (
                            <button
                                key={episode.episodeId}
                                ref={isCurrent ? currentRef : null}
                                onClick={() => !isLocked && onEpisodeSelect(episode.episodeNo)}
                                disabled={isLocked}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group ${isCurrent
                                    ? 'bg-red-600/20 border border-red-600/30'
                                    : isWatched
                                        ? 'bg-white/5 hover:bg-white/10'
                                        : 'hover:bg-white/5'
                                    } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                {/* Thumbnail */}
                                <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-black shrink-0">
                                    {episode.thumbnailUrl ? (
                                        <img
                                            src={episode.thumbnailUrl}
                                            alt={`Episode ${episode.episodeNo}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                            <span className="text-xs text-slate-500">EP {episode.episodeNo}</span>
                                        </div>
                                    )}

                                    {/* Overlay Icons */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        {isLocked ? (
                                            <Lock size={16} className="text-white/80" />
                                        ) : isCurrent ? (
                                            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                                                <Play size={14} className="text-white ml-0.5" fill="white" />
                                            </div>
                                        ) : isWatched ? (
                                            <CheckCircle2 size={16} className="text-green-500" />
                                        ) : (
                                            <Play size={16} className="text-white/80 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    {progress > 0 && progress < 100 && !isCurrent && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                            <div
                                                className="h-full bg-red-600"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`text-sm font-semibold ${isCurrent ? 'text-red-400' : 'text-white'
                                                }`}
                                        >
                                            Episode {episode.episodeNo}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-xs px-2 py-0.5 bg-red-600/30 text-red-400 rounded-full">
                                                Playing
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                        {episode.title || `Episode ${episode.episodeNo}`}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {formatDuration(episode.durationMs)}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}