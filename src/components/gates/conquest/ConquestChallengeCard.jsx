import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Bot, Swords, Clock, Trophy, ShieldX } from 'lucide-react';

const fmt = (n) => `$${Math.round(Number(n || 0)).toLocaleString('de-DE')}`;

export default function ConquestChallengeCard({ challenge, myCompanyId, de }) {
  const ch = challenge;
  const iAmChallenger = String(ch.challenger_company_id) === String(myCompanyId);
  const opponent = iAmChallenger ? ch.defender_company_name : ch.challenger_company_name;
  const iWon = (ch.status === 'won' && iAmChallenger) || (ch.status === 'lost' && !iAmChallenger);

  const remainingLabel = () => {
    if (ch.status !== 'active' || !ch.resolve_at) return null;
    const ms = new Date(ch.resolve_at).getTime() - Date.now();
    if (ms <= 0) return de ? 'Wird ausgewertet…' : 'Resolving…';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 flex flex-col gap-1 font-mono">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
          {ch.mode === 'pve' ? <Bot className="w-3.5 h-3.5 text-purple-400" /> : <Swords className="w-3.5 h-3.5 text-rose-400" />}
          {ch.airport_icao} {ch.gate_code}
        </span>
        {ch.status === 'active' ? (
          <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[9px]">
            <Clock className="w-3 h-3 mr-1" />{remainingLabel()}
          </Badge>
        ) : ch.status === 'cancelled' ? (
          <Badge className="border-slate-600/40 bg-slate-800/60 text-slate-400 text-[9px]">
            {de ? 'Abgebrochen' : 'Cancelled'}
          </Badge>
        ) : iWon ? (
          <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[9px]">
            <Trophy className="w-3 h-3 mr-1" />{de ? 'Gewonnen' : 'Won'}
          </Badge>
        ) : (
          <Badge className="border-rose-500/40 bg-rose-500/10 text-rose-300 text-[9px]">
            <ShieldX className="w-3 h-3 mr-1" />{de ? 'Verloren' : 'Lost'}
          </Badge>
        )}
      </div>
      <p className="text-[10px] text-slate-400 truncate">
        {iAmChallenger ? (de ? 'Angriff auf' : 'Attacking') : (de ? 'Verteidigung gegen' : 'Defending against')} {opponent || (de ? 'KI-Airline' : 'AI airline')}
        {' · '}{de ? 'Einsatz' : 'Stake'} {fmt(ch.stake)}
      </p>
      {ch.status !== 'active' && ch.status !== 'cancelled' && (
        <p className="text-[10px] text-slate-500">
          {de ? 'Wertung' : 'Score'}: {ch.challenger_score ?? '-'} vs {ch.defender_score ?? '-'}
        </p>
      )}
      {ch.mode === 'pvp' && ch.status === 'active' && (
        <p className="text-[10px] text-cyan-400">
          {de ? 'Beste Flug-Wertung im Zeitfenster gewinnt – flieg jetzt!' : 'Best flight score in the window wins – fly now!'}
        </p>
      )}
    </div>
  );
}