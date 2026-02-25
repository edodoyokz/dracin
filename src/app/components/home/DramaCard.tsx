'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import type { DramaCard as DramaCardType, DramaWithRank, ContinueWatchingItem } from '@/lib/types';

type DramaCardProps = {
    drama: DramaCardType | DramaWithRank;
    variant?: 'default' | 'compact' | 'wide';
    showProviderBadge?: boolean;
    showRank?: boolean;
    showProgress?: number;
    showNewBadge?: boolean;
    showPlayOverlay?: boolean;
    onClick?: () => void;
};

export function DramaCard({
    drama,
    variant = 'default',
    showProviderBadge = true,
    showRank = false,
    showProgress,
    showNewBadge = false,
    showPlayOverlay = false,
    onClick,
}: DramaCardProps) {
    const rank = (drama as DramaWithRank).rank;
    const isTopThree = rank && rank <= 3;

    const widthClass = variant === 'compact' ? 'w-28' : variant === 'wide' ? 'w-40' : 'w-32';

    return (
        <Link
            href={`/dramas/${drama.id}`}
            className={`${widthClass} shrink-0 group block`}
            onClick={onClick}
        >
            <div className="relative aspect-2/3 rounded-xl overflow-hidden mb-2 ring-1 ring-white/10 shadow-lg">
                {/* Cover Image */}
                <img
                    src={drama.coverUrl}
                    alt={drama.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

                {/* Play Overlay for Continue Watching */}
                {showPlayOverlay && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                            <Play size={20} fill="white" className="text-white ml-1" />
                        </div>
                    </div>
                )}

                {/* Rank Badge (for Trending) */}
                {showRank && rank && (
                    <div className="absolute top-2 left-2 flex flex-col items-center">
                        <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm
              ${isTopThree ? 'bg-red-600 text-white' : 'bg-black/60 backdrop-blur text-white'}
            `}>
                            {rank === 1 && '🥇'}
                            {rank === 2 && '🥈'}
                            {rank === 3 && '🥉'}
                            {rank > 3 && rank}
                        </div>
                    </div>
                )}

                {/* Provider Badge */}
                {showProviderBadge && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded border border-red-500/30">
                        <span className="text-[9px] text-red-500 font-bold">
                            {drama.providerName}
                        </span>
                    </div>
                )}

                {/* New Badge */}
                {showNewBadge && (
                    <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        BARU
                    </div>
                )}

                {/* Progress Bar (for Continue Watching) */}
                {showProgress !== undefined && showProgress > 0 && (
                    <>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                            <div
                                className="h-full bg-red-600 transition-all duration-300"
                                style={{ width: `${showProgress}%` }}
                            />
                        </div>
                        {/* Progress Percentage */}
                        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-white font-medium">
                            {Math.round(showProgress)}%
                        </div>
                    </>
                )}
            </div>

            {/* Title */}
            <h3 className="text-xs font-bold truncate text-neutral-100 group-hover:text-white transition-colors">
                {drama.title}
            </h3>

            {/* Episode Count */}
            <p className="text-[10px] text-neutral-500 mt-0.5 font-medium">
                {drama.episodeCount} Eps
            </p>
        </Link>
    );
}

// Continue Watching Card (specialized variant)
type ContinueWatchingCardProps = {
    item: ContinueWatchingItem;
    onContinue?: (dramaId: string, episodeNumber: number) => void;
    onRemove?: (dramaId: string) => void;
};

export function ContinueWatchingCard({ item, onContinue, onRemove }: ContinueWatchingCardProps) {
    return (
        <div className="w-36 shrink-0 group relative">
            <Link
                href={`/dramas/${item.dramaId}`}
                className="block"
                onClick={() => onContinue?.(item.dramaId, item.episodeNumber)}
            >
                <div className="relative aspect-2/3 rounded-xl overflow-hidden mb-2 ring-1 ring-white/10 shadow-lg">
                    {/* Cover Image */}
                    <img
                        src={item.coverUrl}
                        alt={item.dramaTitle}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                    />

                    {/* Play Icon Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                            <Play size={20} fill="white" className="text-white ml-1" />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                        <div
                            className="h-full bg-red-600 transition-all duration-300"
                            style={{ width: `${item.progressPercent}%` }}
                        />
                    </div>

                    {/* Episode Number Badge */}
                    <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-white font-bold">
                        Ep {item.episodeNumber}
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xs font-bold truncate text-neutral-100 group-hover:text-white transition-colors">
                    {item.dramaTitle}
                </h3>

                {/* Progress Text */}
                <p className="text-[10px] text-neutral-500 mt-0.5 font-medium">
                    {Math.round(item.progressPercent)}% • {item.provider}
                </p>
            </Link>

            {/* Remove Button */}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove(item.dramaId);
                    }}
                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 backdrop-blur text-white/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove from continue watching"
                >
                    <span className="text-xs">×</span>
                </button>
            )}
        </div>
    );
}

export default DramaCard;
