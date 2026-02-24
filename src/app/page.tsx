'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play, Search, TrendingUp, User, Crown } from 'lucide-react';
import { useHomeDramas } from '../hooks/useHome';

export default function HomePage() {
  const { dramas, loading } = useHomeDramas();
  const [isPremium] = useState(false);

  const featuredDrama = dramas[0];
  const trendingDramas = dramas.slice(0, 4);
  const popularDramas = dramas.slice(4, 8);

  return (
    <div className="min-h-screen bg-neutral-950 selection:bg-red-500/30">
      <header className="sticky top-0 z-40 bg-neutral-950/40 backdrop-blur-xl p-4 flex items-center justify-between border-b border-white/5 transition-all duration-300">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <Play fill="white" size={16} />
          </div>
          <span className="text-lg font-black tracking-tighter">dracinhub</span>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/search" className="text-slate-400 hover:text-white">
            <Search size={20} />
          </Link>
          <Crown className={isPremium ? 'text-amber-500' : 'text-slate-500'} size={20} />
          <Link href="/profile" className="text-slate-400 hover:text-white">
            <User size={20} />
          </Link>
        </div>
      </header>

      <main className="pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {featuredDrama && (
              <Link href={`/dramas/${featuredDrama.id}`}>
                <div className="relative w-full aspect-3/4 overflow-hidden cursor-pointer group animate-fade-in shadow-2xl">
                  <img
                    src={featuredDrama.coverUrl}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    alt={featuredDrama.title}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-neutral-950 via-neutral-950/40 to-black/10 opacity-90" />
                  <div className="absolute bottom-6 left-6 right-6 transform transition-transform duration-500 group-hover:-translate-y-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-red-600 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        Baru
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        #1 Hari Ini
                      </span>
                    </div>
                    <h1 className="text-4xl font-black mb-5 leading-tight tracking-tight drop-shadow-lg text-white">
                      {featuredDrama.title}
                    </h1>
                    <button className="flex items-center justify-center space-x-2 bg-white text-black py-3.5 rounded-xl font-bold text-sm w-full transition-all duration-300 hover:scale-105 hover:bg-neutral-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95">
                      <Play size={18} fill="black" />
                      <span>Tonton Sekarang</span>
                    </button>
                  </div>
                </div>
              </Link>
            )}

            {trendingDramas.length > 0 && (
              <section className="mt-8 px-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp size={20} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <h2 className="text-xl font-black tracking-tight">Trending</h2>
                  </div>
                </div>
                <div className="flex space-x-4 overflow-x-auto pb-6 scrollbar-hide snap-x">
                  {trendingDramas.map((drama) => (
                    <Link
                      key={drama.id}
                      href={`/dramas/${drama.id}`}
                      className="shrink-0 w-32"
                    >
                      <div className="aspect-2/3 rounded-xl overflow-hidden mb-3 relative group ring-1 ring-white/10 shadow-lg">
                        <img
                          src={drama.coverUrl}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          alt={drama.title}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                      </div>
                      <h3 className="text-[12px] font-bold truncate text-neutral-100">{drama.title}</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 font-medium">
                        {drama.episodeCount} Eps
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {popularDramas.length > 0 && (
              <section className="mt-8 px-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
                <h2 className="text-xl font-black mb-4 tracking-tight">Populer</h2>
                <div className="flex space-x-4 overflow-x-auto pb-6 scrollbar-hide snap-x">
                  {popularDramas.map((drama) => (
                    <Link
                      key={drama.id}
                      href={`/dramas/${drama.id}`}
                      className="shrink-0 w-32"
                    >
                      <div className="aspect-2/3 rounded-xl overflow-hidden mb-3 relative group ring-1 ring-white/10 shadow-lg">
                        <img
                          src={drama.coverUrl}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          alt={drama.title}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                      </div>
                      <h3 className="text-[12px] font-bold truncate text-neutral-100">{drama.title}</h3>
                      <p className="text-[10px] text-neutral-500 mt-1 font-medium">
                        {drama.episodeCount} Eps
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
