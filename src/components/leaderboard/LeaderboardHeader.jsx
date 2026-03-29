import React from 'react';
import { Trophy, TrendingUp, Hash } from 'lucide-react';

export default function LeaderboardHeader({ myRank, totalAirlines }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-mono">Your Rank</p>
          <p className="text-xl font-mono font-black text-cyan-400">
            {myRank ? `#${myRank}` : '—'}
          </p>
        </div>
      </div>
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Hash className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-mono">Airlines</p>
          <p className="text-xl font-mono font-black text-white">{totalAirlines}</p>
        </div>
      </div>
      <div className="hidden sm:flex bg-slate-900/80 border border-slate-800 rounded-lg p-3 items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-mono">Score Formula</p>
          <p className="text-[10px] font-mono text-slate-400">40% Score · 25% Level · 20% Landing · 15% Rep</p>
        </div>
      </div>
    </div>
  );
}