import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Swords, Shield, Clock } from 'lucide-react';

const CAT_COLORS = {
  S: 'border-emerald-500/40 text-emerald-300',
  M: 'border-cyan-500/40 text-cyan-300',
  L: 'border-amber-500/40 text-amber-300',
  XL: 'border-purple-500/40 text-purple-300',
};

const fmt = (n) => `$${Math.round(Number(n || 0)).toLocaleString('de-DE')}`;

export default function ConquestTargetCard({ gate, de, busy, myPower, onAttack }) {
  const c = gate.conquest;
  if (!c) return null;
  const isAi = c.type === 'ai';
  const cost = isAi ? c.fee : c.stake;
  const onCooldown = isAi && !!c.cooldown_until;
  const hasDuel = !isAi && c.active_challenge;
  const disabled = busy || onCooldown || hasDuel;

  return (
    <div className={`rounded-lg border p-2.5 flex flex-col gap-1.5 bg-slate-900/70 ${isAi ? 'border-purple-800/60' : 'border-rose-800/60'}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono font-bold text-slate-100 text-sm">{gate.gate_code}</span>
        <Badge variant="outline" className={`text-[9px] px-1 ${CAT_COLORS[gate.size_category] || ''}`}>
          {gate.size_category}
        </Badge>
      </div>
      <p className="text-[10px] font-mono leading-tight flex items-center gap-1 truncate text-slate-400">
        {isAi ? <Bot className="w-3 h-3 text-purple-400 flex-shrink-0" /> : <Swords className="w-3 h-3 text-rose-400 flex-shrink-0" />}
        <span className="truncate">{isAi ? c.ai_name : c.owner_name}</span>
      </p>
      {isAi ? (
        <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <Shield className="w-3 h-3 text-slate-500" />
          {de ? 'Verteidigung' : 'Defense'} ~{c.defense_est}
          <span className={myPower >= c.defense_est ? 'text-emerald-400' : 'text-amber-400'}>
            · {de ? 'Deine Stärke' : 'Your power'} {myPower}
          </span>
        </p>
      ) : (
        <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          <Shield className="w-3 h-3 text-slate-500" />
          {de ? 'Festung Stufe' : 'Fortress level'} {c.defense_level}/5
        </p>
      )}
      {onCooldown ? (
        <Badge className="border-slate-600/50 bg-slate-800/60 text-slate-400 text-[9px] justify-center">
          <Clock className="w-3 h-3 mr-1" />{de ? 'Abklingzeit 24h' : 'Cooldown 24h'}
        </Badge>
      ) : hasDuel ? (
        <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[9px] justify-center">
          <Swords className="w-3 h-3 mr-1" />{de ? 'Duell läuft' : 'Duel in progress'}
        </Badge>
      ) : (
        <Button size="sm" disabled={disabled} onClick={() => onAttack(gate)}
          className={`h-6 text-[10px] font-mono border ${isAi
            ? 'bg-purple-900/60 border-purple-700 text-purple-200 hover:bg-purple-800'
            : 'bg-rose-900/60 border-rose-700 text-rose-200 hover:bg-rose-800'}`}>
          <Swords className="w-3 h-3 mr-1" />
          {isAi ? (de ? 'Erobern' : 'Conquer') : (de ? 'Herausfordern' : 'Challenge')} {fmt(cost)}
        </Button>
      )}
    </div>
  );
}