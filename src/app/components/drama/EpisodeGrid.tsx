'use client';

import Link from 'next/link';
import { Play, Lock, Clock } from 'lucide-react';
import type { EpisodeItem } from '@/lib/types';

interface EpisodeGridProps {
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

export function EpisodeGrid({
    episodes,
    providerSlug,
    providerDramaId,
    isPremium,
    watchedEpisodes = [],
}: EpisodeGridProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {episodes.map((ep) => {
                const isLocked = ep.isLocked && !isPremium;
                const isWatched = watchedEpisodes.includes(ep.episodeNo);
                const thumbnailUrl = ep.thumbnailUrl || `https://picsum.photos/seed/${ep.episodeId}/400/225`;

                return (
                    <Link
                        key={ep.episodeId}
                        href={isLocked ? '#' : `/play/${providerSlug}/${providerDramaId}/${ep.episodeNo}`}
                        className={`group relative aspect-video rounded-xl overflow-hidden border transition-all duration-300 ${isLocked
                            ? 'bg-slate-900 border-slate-800 cursor-not-allowed'
                            : 'bg-slate-800 border-slate-700 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10'
                            }`}
                        onClick={(e) => {
                            if (isLocked) {
                                e.preventDefault();
                            }
                        }}
                    >
                        {/* Thumbnail */}
                        <img
                            src={thumbnailUrl}
                            alt={`Episode ${ep.episodeNo}`}
                            className={`w-full h-full object-cover transition-all duration-500 ${isLocked ? 'opacity-30 grayscale' : 'group-hover:scale-110'
                                }`}
                            loading="lazy"
                        />

                        {/* Overlay */}
                        <div
                            className={`absolute inset-0 transition-all duration-300 ${isLocked
                                ? 'bg-slate-950/60'
                                : 'bg-linear-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/70'
                                }`}
                        />

                        {/* Play Icon (center) */}
                        {!isLocked && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                    <Play size={18} fill="white" className="text-white ml-0.5" />
                                </div>
                            </div>
                        )}

                        {/* Lock Icon (center when locked) */}
                        {isLocked && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                    <Lock size={16} className="text-slate-500" />
                                </div>
                            </div>
                        )}

                        {/* Duration Badge */}
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white font-medium flex items-center gap-1">
                            <Clock size={10} />
                            {formatDuration(ep.durationMs)}
                        </div>

                        {/* Watched Badge */}
                        {isWatched && !isLocked && (
                            <div className="absolute top-2 left-2 bg-green-600/90 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                                ✓
                            </div>
                        )}

                        {/* Episode Info (bottom) */}
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                            <div className="flex items-center justify-between">
                                <span
                                    className={`text-xs font-bold ${isLocked ? 'text-slate-500' : 'text-white'
                                        }`}
                                >
                                    Ep {ep.episodeNo}
                                </span>
                                {ep.title && !isLocked && (
                                    <span className="text-[10px] text-slate-300 truncate max-w-[60%]">
                                        {ep.title}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Lock Badge (top right for locked) */}
                        {isLocked && (
                            <div className="absolute top-2 right-2 bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 rounded text-[10px] text-amber-400 font-bold flex items-center gap-1">
                                <Lock size={10} />
                                VIP
                            </div>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}

export default EpisodeGrid;
