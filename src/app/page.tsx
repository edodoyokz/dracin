'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play, Search, User, Crown } from 'lucide-react';
import { useHomeData } from '@/hooks/useHome';
import {
  HeroBanner,
  ProviderFilterBar,
  ContinueWatchingSection,
  HorizontalDramaSection,
  ProviderSections,
  NewReleasesSection,
  GenreGridSection,
} from '@/app/components/home';
import type { HomeResponseData } from '@/lib/types';

export default function HomePage() {
  const { data, loading, error, refetch } = useHomeData();
  const [activeProvider, setActiveProvider] = useState<string | 'all'>('all');
  const [isPremium] = useState(false);

  // Filter data by selected provider
  const filteredData = filterDataByProvider(data, activeProvider);

  return (
    <div className="min-h-screen bg-neutral-950 selection:bg-red-500/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/40 backdrop-blur-xl p-4 flex items-center justify-between border-b border-white/5 transition-all duration-300">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <Play fill="white" size={16} />
          </div>
          <span className="text-lg font-black tracking-tighter">dracinhub</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/search" className="text-slate-400 hover:text-white transition-colors">
            <Search size={20} />
          </Link>
          <Crown className={isPremium ? 'text-amber-500' : 'text-slate-500'} size={20} />
          <Link href="/profile" className="text-slate-400 hover:text-white transition-colors">
            <User size={20} />
          </Link>
        </div>
      </header>

      {/* Provider Filter Bar */}
      {data?.providers && (
        <ProviderFilterBar
          providers={data.providers}
          activeProvider={activeProvider}
          onProviderChange={setActiveProvider}
        />
      )}

      {/* Main Content */}
      <main className="pb-20">
        {loading ? (
          <HomeLoadingState />
        ) : error ? (
          <HomeErrorState error={error} onRetry={refetch} />
        ) : filteredData ? (
          <>
            {/* Hero Banner */}
            {filteredData.featured.length > 0 && (
              <HeroBanner dramas={filteredData.featured} />
            )}

            {/* Continue Watching */}
            {filteredData.continueWatching && filteredData.continueWatching.length > 0 && (
              <ContinueWatchingSection
                items={filteredData.continueWatching}
                onContinue={(dramaId, episodeNumber) => {
                  console.log('Continue watching:', dramaId, episodeNumber);
                }}
              />
            )}

            {/* For You Section */}
            {filteredData.forYou.length > 0 && (
              <HorizontalDramaSection
                title="Untuk Kamu"
                subtitle="Rekomendasi personal berdasarkan tontonanmu"
                dramas={filteredData.forYou}
                actionLabel="Lihat Semua"
                onAction={() => console.log('View all For You')}
                animationDelay={100}
              />
            )}

            {/* Trending Global */}
            {filteredData.trending.length > 0 && (
              <HorizontalDramaSection
                title="🔥 Trending"
                subtitle="Paling populer minggu ini"
                dramas={filteredData.trending}
                showRank={true}
                showProviderBadge={true}
                actionLabel="Lihat Semua"
                onAction={() => console.log('View all Trending')}
                animationDelay={200}
              />
            )}

            {/* Provider Sections */}
            {filteredData.providerSections.length > 0 && (
              <ProviderSections
                sections={filteredData.providerSections}
                expandedCount={3}
              />
            )}

            {/* New Releases */}
            {filteredData.newReleases.length > 0 && (
              <NewReleasesSection
                groups={filteredData.newReleases}
                onViewAll={() => console.log('View all New Releases')}
                animationDelay={400}
              />
            )}

            {/* Genre Grid */}
            {filteredData.genres.length > 0 && (
              <GenreGridSection
                genres={filteredData.genres}
                animationDelay={500}
              />
            )}

            {/* Footer spacer */}
            <div className="h-20" />
          </>
        ) : null}
      </main>
    </div>
  );
}

// Helper function to filter data by provider
function filterDataByProvider(
  data: HomeResponseData | null,
  provider: string | 'all'
): HomeResponseData | null {
  if (!data) return null;
  if (provider === 'all') return data;

  return {
    ...data,
    featured: data.featured.filter((d) => d.providerSlug === provider),
    forYou: data.forYou.filter((d) => d.providerSlug === provider),
    trending: data.trending.filter((d) => d.providerSlug === provider),
    providerSections: data.providerSections.filter((s) => s.provider.slug === provider),
    newReleases: data.newReleases.map((group) => ({
      ...group,
      dramas: group.dramas.filter((d) => d.providerSlug === provider),
    })),
  };
}

// Loading State Component
function HomeLoadingState() {
  return (
    <div className="space-y-6">
      {/* Hero Skeleton */}
      <div className="aspect-3/4 sm:aspect-video bg-neutral-900 animate-pulse" />

      {/* Section Skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-4">
          <div className="h-6 w-32 bg-neutral-800 rounded animate-pulse mb-4" />
          <div className="flex space-x-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="w-32 shrink-0">
                <div className="aspect-2/3 bg-neutral-800 rounded-xl animate-pulse" />
                <div className="h-4 w-24 bg-neutral-800 rounded mt-2 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Error State Component
interface HomeErrorStateProps {
  error: string;
  onRetry: () => void;
}

function HomeErrorState({ error, onRetry }: HomeErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 animate-fade-in">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
        <span className="text-red-500 text-2xl">⚠️</span>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Gagal Memuat Data</h2>
      <p className="text-red-400 max-w-md text-sm">{error}</p>
      <button
        onClick={onRetry}
        className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
      >
        Coba Lagi
      </button>
    </div>
  );
}
