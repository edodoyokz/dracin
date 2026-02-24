'use client';

import Link from 'next/link';
import { User, Crown, Bookmark, Clock, ChevronRight, ArrowLeft } from 'lucide-react';

export default function ProfilePage() {
  const isPremium = false;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="flex items-center space-x-4 mb-8">
        <Link href="/" className="text-white">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-black">Profil</h1>
      </div>

      <div className="flex flex-col items-center text-center space-y-4 mb-10">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-600 to-slate-800 p-1">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
            <User size={40} className="text-slate-700" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-black italic">Pengguna Tamu</h2>
          <p className="text-xs text-slate-500 font-bold tracking-widest mt-1 uppercase">
            Tier: {isPremium ? 'PRO MEMBER' : 'FREE USER'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div 
          className={`w-full p-4 rounded-2xl flex items-center justify-between border
            ${isPremium ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-600/10 border-red-600/20'}`}
        >
          <div className="flex items-center space-x-3">
            <Crown size={20} className={isPremium ? 'text-amber-500' : 'text-red-500'} />
            <span className="text-sm font-bold">
              {isPremium ? 'Premium Aktif' : 'Langganan Premium'}
            </span>
          </div>
          <ChevronRight size={18} />
        </div>

        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 divide-y divide-slate-800">
          <button className="w-full p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3 text-slate-300">
              <Bookmark size={20} />
              <span className="text-sm font-medium">Daftar Tontonan</span>
            </div>
            <span className="text-[10px] font-black bg-slate-800 px-2 py-0.5 rounded">12</span>
          </button>
          
          <button className="w-full p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3 text-slate-300">
              <Clock size={20} />
              <span className="text-sm font-medium">Riwayat</span>
            </div>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
