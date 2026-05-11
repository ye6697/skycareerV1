import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Award, Gauge, MapPin, Medal, Plane, Star, Trophy, Users } from 'lucide-react';

function RankBadge({ rank }) {
  const base = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-black';
  if (rank === 1) return <div className={`${base} border-amber-400/40 bg-amber-500/15 text-amber-300`}><Trophy className="h-5 w-5" /></div>;
  if (rank === 2) return <div className={`${base} border-slate-300/30 bg-slate-400/15 text-slate-200`}><Medal className="h-5 w-5" /></div>;
  if (rank === 3) return <div className={`${base} border-orange-400/35 bg-orange-500/15 text-orange-300`}><Award className="h-5 w-5" /></div>;
  return <div className={`${base} border-slate-700 bg-slate-900 text-slate-400`}>#{rank}</div>;
}

function ScoreBar({ value, max = 100, color = 'bg-cyan-400' }) {
  const pct = Math.min(100, Math.max(0, (Number(value || 0) / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatPill({ label, value, color = 'text-cyan-300' }) {
  return (
    <div className="min-w-[82px] rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5">
      <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function LeaderboardRow({ entry, onOpenProfile }) {
  const isMe = entry.is_me;
  const landingValue = Number(entry.avg_landing_vs || 0);
  const landingMagnitude = Math.abs(landingValue);

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(entry)}
      className={`w-full rounded-lg border p-3 text-left transition-all ${
        isMe
          ? 'border-cyan-500/50 bg-cyan-950/30 shadow-lg shadow-cyan-950/25'
          : 'border-slate-800 bg-slate-950/65 hover:border-cyan-700/60 hover:bg-slate-900/80'
      }`}
    >
      <div className="flex items-center gap-3">
        <RankBadge rank={entry.rank} />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`truncate text-base font-black ${isMe ? 'text-cyan-200' : 'text-white'}`}>
              {entry.name}
            </span>
            {entry.callsign && <Badge className="border-slate-700 bg-slate-900 text-slate-300">{entry.callsign}</Badge>}
            {isMe && <Badge className="border-cyan-500/30 bg-cyan-500/15 text-cyan-200">YOU</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-300" />Lv.{entry.level}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-cyan-300" />{entry.hub_airport || '-'}</span>
            <span className="flex items-center gap-1"><Plane className="h-3 w-3" />{entry.fleet_size || 0} aircraft</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{(entry.total_passengers || 0).toLocaleString()} pax</span>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <StatPill label="Avg Score" value={entry.avg_score || 0} color={entry.avg_score >= 85 ? 'text-emerald-300' : entry.avg_score >= 70 ? 'text-amber-300' : 'text-red-300'} />
          <StatPill label="Landing" value={landingMagnitude > 0 ? `${Math.round(landingValue)} fpm` : '-'} color={landingMagnitude < 180 ? 'text-emerald-300' : landingMagnitude < 320 ? 'text-amber-300' : 'text-red-300'} />
          <StatPill label="Butter" value={`${entry.butter_pct || 0}%`} color="text-amber-300" />
          <StatPill label="Rep" value={entry.reputation || 0} color="text-indigo-300" />
        </div>

        <div className="w-24 shrink-0 text-right">
          <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Rating</p>
          <p className={`text-2xl font-black ${entry.rank <= 3 ? 'text-amber-300' : isMe ? 'text-cyan-300' : 'text-white'}`}>
            {entry.composite_score}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <Gauge className="h-3 w-3 text-slate-500" />
            <ScoreBar value={entry.composite_score} color={entry.rank <= 3 ? 'bg-amber-400' : 'bg-cyan-400'} />
          </div>
        </div>
      </div>
    </button>
  );
}
