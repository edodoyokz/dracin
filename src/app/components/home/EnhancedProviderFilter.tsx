'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ProviderInfo } from '@/lib/types';

interface EnhancedProviderFilterProps {
  providers: ProviderInfo[];
  activeProvider: string | 'all';
  onProviderChange: (provider: string | 'all') => void;
}

export function EnhancedProviderFilter({
  providers,
  activeProvider,
  onProviderChange,
}: EnhancedProviderFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Sort providers alphabetically
  const sortedProviders = [...providers].sort((a, b) => a.name.localeCompare(b.name));

  // Filter providers by search
  const filteredProviders = searchQuery
    ? sortedProviders.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedProviders;

  // Check scroll position
  const checkScrollPosition = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollPosition();
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScrollPosition);
      return () => scrollEl.removeEventListener('scroll', checkScrollPosition);
    }
  }, [filteredProviders]);

  // Scroll handlers
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Scroll to active provider
  useEffect(() => {
    if (!scrollRef.current || activeProvider === 'all') return;
    
    const activeButton = scrollRef.current.querySelector(`[data-provider="${activeProvider}"]`) as HTMLElement;
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeProvider]);

  return (
    <div className="sticky top-[64px] z-30 bg-neutral-950/95 backdrop-blur-xl border-b border-white/5">
      <div className="px-4 py-3">
        {/* Header with search toggle */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-neutral-500">
            {providers.length} provider tersedia
          </p>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center space-x-1 text-[11px] px-2 py-1 rounded-full transition-colors ${
              showSearch ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Search size={12} />
            <span>Cari Provider</span>
          </button>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="mb-3 animate-fade-in">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Ketik nama provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 text-sm text-white placeholder-neutral-500 pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 border border-white/10"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* Provider scroll container */}
        <div className="relative">
          {/* Left scroll button */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-neutral-900/90 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-neutral-800 transition-colors shadow-lg"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Provider buttons */}
          <div
            ref={scrollRef}
            className="flex items-center space-x-2 overflow-x-auto scrollbar-hide snap-x py-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* All button */}
            <button
              onClick={() => onProviderChange('all')}
              className={`
                shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 snap-start whitespace-nowrap
                ${activeProvider === 'all'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              Semua
            </button>

            {/* Provider buttons */}
            {filteredProviders.map((provider) => (
              <button
                key={provider.slug}
                data-provider={provider.slug}
                onClick={() => onProviderChange(provider.slug)}
                className={`
                  shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 snap-start whitespace-nowrap
                  ${activeProvider === provider.slug
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                {provider.name}
                {provider.contentCount > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({provider.contentCount})
                  </span>
                )}
              </button>
            ))}

            {/* Empty state for search */}
            {filteredProviders.length === 0 && (
              <div className="text-neutral-500 text-sm py-2">
                Tidak ada provider ditemukan
              </div>
            )}
          </div>

          {/* Right scroll button */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-neutral-900/90 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-neutral-800 transition-colors shadow-lg"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EnhancedProviderFilter;
