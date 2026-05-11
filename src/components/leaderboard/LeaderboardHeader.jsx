import React from 'react';
import { Activity, Hash, Radar, Trophy } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, detail, tone = 'cyan' }) {
  const tones = {
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    slate: 'border-slate-700 bg-slate-900/70 text-slate-300',
  };
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${tones[tone] || tones.cyan}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{label}</p>
          <p className="truncate text-xl font-black text-white">{value}</p>
          {detail && <p className="truncate text-[10px] text-slate-500">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardHeader({ myRank, totalAirlines, leader, scopedCount }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={Trophy}
        label="Your Rank"
        value={myRank ? `#${myRank}` : '-'}
        detail="Global airline position"
        tone="amber"
      />
      <MetricCard
        icon={Hash}
        label="Airlines"
        value={totalAirlines}
        detail={`${scopedCount || 0} shown in this view`}
        tone="cyan"
      />
      <MetricCard
        icon={Radar}
        label="Current Leader"
        value={leader?.name || '-'}
        detail={leader ? `Rating ${leader.composite_score}` : 'No ranked airline yet'}
        tone="emerald"
      />
      <MetricCard
        icon={Activity}
        label="Score Model"
        value="45 / 30 / 25"
        detail="Flight score, level, reputation"
        tone="slate"
      />
    </div>
  );
}
