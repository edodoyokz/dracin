'use client';

import Link from 'next/link';
import { Play, Lock, Clock, CheckCircle } from 'lucide-react';
import type { EpisodeItem } from '@/lib/types';

interface EpisodeListProps {
    episodes: EpisodeItem[];
    providerSlug: string;
    providerDramaId: string;
    isPremium: boolean;
    watchedEpisodes?: number[];
}

function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function EpisodeList({
    episodes,
    providerSlug,
    providerDramaId,
    isPremium,
    watchedEpisodes = [],
}: EpisodeListProps) {
    return (
        <div className="flex flex-col gap-2">
            {episodes.map((ep) => {
                const isLocked = ep.isLocked && !isPremium;
                const isWatched = watchedEpisodes.includes(ep.episodeNo);
                const thumbnailUrl = ep.thumbnailUrl || `https://picsum.photos/seed/${ep.episodeId}/400/225`;

                return (
                    <Link
                        key={ep.episodeId}
                        href={isLocked ? '#' : `/play/${providerSlug}/${providerDramaId}/${ep.episodeNo}`}
                        className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isLocked
                                ? 'bg-slate-900/50 border-slate-800 cursor-not-allowed'
                                : 'bg-slate-900 border-slate-800 hover:border-red-500/30 hover:bg-slate-800/50'
                            }`}
                        onClick={(e) => {
                            if (isLocked) {
                                e.preventDefault();
                            }
                        }}
                    >
                        {/* Thumbnail */}
                        <div className="relative w-24 h-14 shrink-0 rounded-lg overflow-hidden">
                            <img
                                src={thumbnailUrl}
                                alt={`Episode ${ep.episodeNo}`}
                                className={`w-full h-full object-cover transition-all duration-500 ${isLocked ? 'opacity-40 grayscale' : 'group-hover:scale-110'
                                    }`}
                                loading="lazy"
                            />

                            {/* Play overlay */}
                            {!isLocked && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                    <Play size={16} fill="white" className="text-white" />
                                </div>
                            )}

                            {/* Lock overlay */}
                            {isLocked && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
                                    <Lock size={14} className="text-slate-500" />
                                </div>
                            )}

                            {/* Duration */}
                            <div className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded text-[9px] text-white">
                                {formatDuration(ep.durationMs)}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span
                                    className={`text-sm font-bold ${isLocked ? 'text-slate-500' : 'text-white'
                                        }`}
                                >
                                    Episode {ep.episodeNo}
                                </span>

                                {/* Watched indicator */}
                                {isWatched && !isLocked && (
                                    <CheckCircle size={14} className="text-green-500" />
                                )}

                                {/* Locked badge */}
                                {isLocked && (
                                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Lock size={8} />
                                        VIP
                                    </span>
                                )}
                            </div>

                            {ep.title && (
                                <p
                                    className={`text-xs truncate ${isLocked ? 'text-slate-600' : 'text-slate-400'
                                        }`}
                                >
                                    {ep.title}
                                </p>
                            )}
                        </div>

                        {/* Arrow indicator */}
                        {!isLocked && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play size={16} className="text-red-500" />
                            </div>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}

export default EpisodeList;
