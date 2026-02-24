'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Crown, Bookmark, Clock, ChevronRight, ArrowLeft, LogOut } from 'lucide-react';
import { useState, useTransition } from 'react';
import { logoutAction } from '../actions/auth';

interface ProfileClientProps {
    user: {
        id: string;
        email: string | null;
        displayName: string | null;
        avatarUrl: string | null;
    };
}

export default function ProfileClient({ user }: ProfileClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const isPremium = false;

    const handleLogout = () => {
        startTransition(async () => {
            await logoutAction();
        });
    };

    const displayName = user.displayName || user.email?.split('@')[0] || 'User';

    return (
        <div className="min-h-screen bg-slate-950 p-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <Link href="/" className="text-white">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-xl font-black">Profil</h1>
                </div>
                <button
                    onClick={handleLogout}
                    disabled={isPending}
                    className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Logout"
                >
                    <LogOut size={20} />
                </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-4 mb-10">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-600 to-slate-800 p-1">
                    <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center overflow-hidden">
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt={displayName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <User size={40} className="text-slate-700" />
                        )}
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-black italic">{displayName}</h2>
                    <p className="text-xs text-slate-500 font-bold tracking-widest mt-1 uppercase">
                        Tier: {isPremium ? 'PRO MEMBER' : 'FREE USER'}
                    </p>
                    {user.email && (
                        <p className="text-xs text-slate-600 mt-1">{user.email}</p>
                    )}
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
                        <span className="text-[10px] font-black bg-slate-800 px-2 py-0.5 rounded">0</span>
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
