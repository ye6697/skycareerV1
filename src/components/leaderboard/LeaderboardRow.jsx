import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Plane, Users, Star } from 'lucide-react';

function RankBadge({ rank }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center"><Trophy className="w-4 h-4 text-amber-400" /></div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-slate-400/20 flex items-center justify-center"><Medal className="w-4 h-4 text-slate-300" /></div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center"><Award className="w-4 h-4 text-orange-400" /></div>;
  return <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-400">{rank}</div>;
}

function ScoreBar({ value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function LeaderboardRow({ entry, expanded }) {
  const isMe = entry.is_me;
  
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      isMe 
        ? 'bg-cyan-950/30 border-cyan-700/50 shadow-lg shadow-cyan-900/20' 
        : 'bg-slate-900/60 border-slate-800/50 hover:bg-slate-800/60'
    }`}>
      {/* Rank */}
      <RankBadge rank={entry.rank} />

      {/* Airline Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm font-bold truncate ${isMe ? 'text-cyan-300' : 'text-white'}`}>
            {entry.name}
          </span>
          {entry.callsign && (
            <span className="text-[10px] font-mono text-slate-500 uppercase">{entry.callsign}</span>
          )}
          {isMe && (
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[9px] px-1.5 py-0">YOU</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
          <span>Lv.{entry.level}</span>
          <span>{entry.hub_airport || '—'}</span>
          <span className="flex items-center gap-0.5"><Plane className="w-3 h-3" />{entry.total_flights}</span>
          <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{(entry.total_passengers || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4">
        {/* Avg Score */}
        <div className="text-center w-16">
          <p className="text-[9px] text-slate-600 uppercase">Score</p>
          <p className={`text-sm font-mono font-bold ${
            entry.avg_score >= 90 ? 'text-emerald-400' : 
            entry.avg_score >= 70 ? 'text-amber-400' : 'text-red-400'
          }`}>{entry.avg_score}</p>
          <ScoreBar value={entry.avg_score} color="bg-emerald-500" />
        </div>

        {/* Avg Landing VS */}
        <div className="text-center w-16">
          <p className="text-[9px] text-slate-600 uppercase">V/S</p>
          <p className={`text-sm font-mono font-bold ${
            entry.avg_landing_vs < 150 ? 'text-emerald-400' : 
            entry.avg_landing_vs < 300 ? 'text-amber-400' : 'text-red-400'
          }`}>{entry.avg_landing_vs}</p>
          <ScoreBar value={Math.max(0, 100 - entry.avg_landing_vs / 5)} color="bg-cyan-500" />
        </div>

        {/* Butter % */}
        <div className="text-center w-16">
          <p className="text-[9px] text-slate-600 uppercase">Butter</p>
          <p className="text-sm font-mono font-bold text-amber-400">{entry.butter_pct}%</p>
          <ScoreBar value={entry.butter_pct} color="bg-amber-500" />
        </div>

        {/* Reputation */}
        <div className="text-center w-16">
          <p className="text-[9px] text-slate-600 uppercase">Rep</p>
          <p className="text-sm font-mono font-bold text-purple-400">{entry.reputation}</p>
          <ScoreBar value={entry.reputation} color="bg-purple-500" />
        </div>
      </div>

      {/* Composite Score */}
      <div className="text-right min-w-[60px]">
        <p className="text-[9px] text-slate-600 uppercase">Rating</p>
        <p className={`text-lg font-mono font-black ${
          entry.rank <= 3 ? 'text-amber-400' : isMe ? 'text-cyan-400' : 'text-white'
        }`}>{entry.composite_score}</p>
      </div>
    </div>
  );
}