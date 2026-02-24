'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Play, Share2, TrendingUp, Crown } from 'lucide-react';
import { useDramaDetail } from '@/hooks/useDrama';

export default function DramaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { drama, episodes, loading } = useDramaDetail(id);
  const [isPremium] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!drama) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Drama tidak ditemukan
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 p-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white"
      >
        <ChevronLeft size={20} />
      </Link>

      <div className="relative w-full aspect-[4/5] bg-slate-900">
        <img
          src={drama.coverUrl}
          className="w-full h-full object-cover"
          alt={drama.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {drama.tags.map((tag) => (
              <span
                key={tag}
                className="text-[9px] font-black px-2 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded uppercase"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl font-black mb-3 leading-tight">{drama.title}</h1>

          <div className="flex items-center space-x-4 text-xs font-bold text-slate-400">
            <span className="flex items-center text-green-500">
              <TrendingUp size={14} className="mr-1" />
              {drama.rating || '4.5'}
            </span>
            <span>{drama.episodeCount} Episode</span>
            <span className="text-red-500">{drama.providerName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3 p-4 border-b border-slate-900">
        {episodes.length > 0 && (
          <Link
            href={`/play/${drama.providerSlug}/${drama.providerDramaId}/${episodes[0].episodeNo}`}
            className="flex-1 bg-red-600 py-3.5 rounded-2xl flex items-center justify-center space-x-2 font-black"
          >
            <Play size={20} fill="white" />
            <span>Mulai Menonton</span>
          </Link>
        )}

        <button className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
          <Share2 size={20} />
        </button>
      </div>

      <div className="p-6">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3">
          Sinopsis
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          {drama.synopsis || 'Tidak ada sinopsis tersedia.'}
        </p>
      </div>

      <div className="px-4 pb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black">Episode</h3>
          <span className="text-xs text-slate-500">Total: {episodes.length}</span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {episodes.map((ep) => (
            <Link
              key={ep.episodeId}
              href={`/play/${drama.providerSlug}/${drama.providerDramaId}/${ep.episodeNo}`}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center relative border transition-all
                ${ep.isLocked && !isPremium
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-slate-800 border-slate-700 active:scale-95'
                }`}
            >
              <span className={`text-sm font-black ${ep.isLocked && !isPremium ? 'text-slate-600' : 'text-white'}`}>
                {ep.episodeNo}
              </span>

              {ep.isLocked && !isPremium && (
                <div className="absolute top-1 right-1">
                  <Crown size={10} className="text-amber-500" />
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
