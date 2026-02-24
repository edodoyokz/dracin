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
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md p-4 flex items-center justify-between border-b border-slate-900">
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
                <div className="relative w-full aspect-[3/4] overflow-hidden cursor-pointer">
                  <img 
                    src={featuredDrama.coverUrl} 
                    className="w-full h-full object-cover" 
                    alt={featuredDrama.title}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="bg-red-600 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        Baru
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        #1 Hari Ini
                      </span>
                    </div>
                    <h1 className="text-3xl font-black mb-4 leading-tight">
                      {featuredDrama.title}
                    </h1>
                    <button className="flex items-center justify-center space-x-2 bg-white text-black py-3 rounded-xl font-bold text-sm w-full">
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
                    <TrendingUp size={20} className="text-red-500" />
                    <h2 className="text-lg font-black">Trending</h2>
                  </div>
                </div>
                <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
                  {trendingDramas.map((drama) => (
                    <Link 
                      key={drama.id}
                      href={`/dramas/${drama.id}`}
                      className="flex-shrink-0 w-32"
                    >
                      <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2">
                        <img 
                          src={drama.coverUrl} 
                          className="w-full h-full object-cover" 
                          alt={drama.title}
                        />
                      </div>
                      <h3 className="text-[11px] font-bold truncate">{drama.title}</h3>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        {drama.episodeCount} Eps
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {popularDramas.length > 0 && (
              <section className="mt-8 px-4">
                <h2 className="text-lg font-black mb-4">Populer</h2>
                <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
                  {popularDramas.map((drama) => (
                    <Link 
                      key={drama.id}
                      href={`/dramas/${drama.id}`}
                      className="flex-shrink-0 w-32"
                    >
                      <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2">
                        <img 
                          src={drama.coverUrl} 
                          className="w-full h-full object-cover" 
                          alt={drama.title}
                        />
                      </div>
                      <h3 className="text-[11px] font-bold truncate">{drama.title}</h3>
                      <p className="text-[9px] text-slate-500 mt-0.5">
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
