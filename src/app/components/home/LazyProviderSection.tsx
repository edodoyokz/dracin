'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { DramaCard } from './DramaCard';
import { useIntersectionObserver } from '@/lib/hooks/useIntersectionObserver';
import type { ProviderSectionData } from '@/lib/types';

interface LazyProviderSectionProps {
  section: ProviderSectionData;
  index: number;
  onViewAll?: (providerSlug: string) => void;
}

export function LazyProviderSection({
  section,
  index,
  onViewAll,
}: LazyProviderSectionProps) {
  const [isExpanded, setIsExpanded] = useState(index < 3); // Expand first 3 by default
  const { ref, isIntersecting } = useIntersectionObserver<HTMLElement>({
    threshold: 0.1,
    rootMargin: '100px',
    triggerOnce: true,
  });

  const { provider, dramas, totalCount } = section;

  if (!dramas || dramas.length === 0) {
    return null;
  }

  return (
    <section
      ref={ref}
      className="mt-8 pt-6 border-t border-white/5 animate-slide-up min-h-[200px]"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-3 group"
          >
            {/* Provider Logo/Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600/30 to-red-900/30 flex items-center justify-center border border-red-500/20">
              <span className="text-lg font-black text-red-500">
                {provider.name.charAt(0)}
              </span>
            </div>

            <div className="text-left">
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2 group-hover:text-neutral-200 transition-colors">
                {provider.name}
                <ChevronDown
                  size={18}
                  className={`text-neutral-500 transition-transform duration-300 ${isExpanded ? '' : '-rotate-90'}`}
                />
              </h2>
              <p className="text-xs text-neutral-500">
                {totalCount} drama tersedia
              </p>
            </div>
          </button>

          {onViewAll && (
            <button
              onClick={() => onViewAll(provider.slug)}
              className="flex items-center text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/5"
            >
              <span>Lihat Semua</span>
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Cards (collapsible) */}
        <div
          className={`
            overflow-hidden transition-all duration-500 ease-in-out
            ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          {!isIntersecting ? (
            // Skeleton loading
            <div className="flex space-x-4 overflow-hidden pb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-36 shrink-0">
                  <div className="aspect-2/3 bg-neutral-800 rounded-xl animate-pulse" />
                  <div className="h-4 w-24 bg-neutral-800 rounded mt-2 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            // Actual content
            <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {dramas.map((drama) => (
                <div key={drama.id} className="snap-start">
                  <DramaCard
                    drama={drama}
                    showProviderBadge={false}
                    variant="default"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default LazyProviderSection;
