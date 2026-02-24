'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ArrowLeft } from 'lucide-react';
import { searchDramas } from '../lib/api-client';
import type { DramaCard } from '../lib/types';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DramaCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    
    try {
      const data = await searchDramas(query);
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }

  const popularTags = ['CEO', 'Balas Dendam', 'Pewaris', 'Vampir', 'Istri'];

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/" className="text-white">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-black">Cari Drama</h1>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            autoFocus
            type="text"
            placeholder="Cari drama, genre, atau provider..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-red-600/30 text-sm"
          />
        </div>
      </form>

      {!searched && (
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Pencarian Populer
          </h3>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setQuery(tag);
                  setTimeout(() => handleSearch({ preventDefault: () => {} } as React.FormEvent), 0);
                }}
                className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-bold uppercase">Mencari di Provider...</p>
        </div>
      )}

      {!loading && searched && results.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4">
          {results.map((drama) => (
            <Link key={drama.id} href={`/dramas/${drama.id}`} className="space-y-2">
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-slate-900">
                <img src={drama.coverUrl} className="w-full h-full object-cover" alt={drama.title} />
              </div>
              <h4 className="text-[11px] font-bold truncate">{drama.title}</h4>
            </Link>
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="mt-20 text-center text-slate-500">
          Tidak ada hasil untuk "{query}"
        </div>
      )}
    </div>
  );
}
