import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DoorOpen, ParkingSquare, Lock, Tag, Bot } from 'lucide-react';

const CAT_COLORS = {
  S: 'border-emerald-500/40 text-emerald-300',
  M: 'border-cyan-500/40 text-cyan-300',
  L: 'border-amber-500/40 text-amber-300',
  XL: 'border-purple-500/40 text-purple-300',
};

const fmt = (n) => `$${Math.round(Number(n || 0)).toLocaleString('de-DE')}`;

export default function GateCard({ gate, lang, busy, onBuy, onSell, onUnlist }) {
  const isApron = gate.position_type === 'apron';
  const Icon = isApron ? ParkingSquare : DoorOpen;
  const de = lang === 'de';

  return (
    <div className={`rounded-lg border p-2.5 flex flex-col gap-1.5 bg-slate-900/70 ${
      gate.status === 'owned_by_me' ? 'border-emerald-600/60' :
      gate.status === 'sold_out' ? 'border-slate-800 opacity-60' :
      gate.status === 'for_sale' ? 'border-amber-600/60' :
      gate.status === 'ai_owned' ? 'border-purple-800/60' : 'border-slate-800'
    }`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono font-bold text-slate-100 text-sm flex items-center gap-1">
          <Icon className="w-3.5 h-3.5 text-cyan-400" />{gate.gate_code}
        </span>
        <Badge variant="outline" className={`text-[9px] px-1 ${CAT_COLORS[gate.size_category] || ''}`}>
          {gate.size_category}
        </Badge>
      </div>
      <p className="text-[10px] text-slate-500 font-mono leading-tight">
        {de ? 'Bonus' : 'Bonus'} +{gate.bonus_pct}%{isApron ? (de ? ' (inkl. Vorfeld-Extra)' : ' (incl. apron extra)') : ''}
      </p>
      {gate.status === 'available' && (
        <Button size="sm" disabled={busy} onClick={() => onBuy(gate)}
          className="h-6 text-[10px] font-mono bg-cyan-900/60 border border-cyan-700 text-cyan-200 hover:bg-cyan-800">
          {de ? 'Kaufen' : 'Buy'} {fmt(gate.price)}
        </Button>
      )}
      {gate.status === 'owned_by_me' && (
        gate.for_sale ? (
          <Button size="sm" disabled={busy} onClick={() => onUnlist(gate)}
            className="h-6 text-[10px] font-mono bg-amber-900/50 border border-amber-700 text-amber-200 hover:bg-amber-800">
            <Tag className="w-3 h-3 mr-1" />{de ? `Inseriert ${fmt(gate.sale_price)} – zurückziehen` : `Listed ${fmt(gate.sale_price)} – unlist`}
          </Button>
        ) : (
          <div className="flex gap-1">
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[9px]">{de ? 'Deins' : 'Yours'}</Badge>
            <Button size="sm" disabled={busy} onClick={() => onSell(gate)}
              className="h-6 flex-1 text-[10px] font-mono bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700">
              {de ? 'Verkaufen' : 'Sell'}
            </Button>
          </div>
        )
      )}
      {gate.status === 'for_sale' && (
        <Button size="sm" disabled={busy} onClick={() => onBuy(gate)}
          className="h-6 text-[10px] font-mono bg-amber-900/50 border border-amber-700 text-amber-200 hover:bg-amber-800">
          {de ? 'Kaufen' : 'Buy'} {fmt(gate.sale_price)} · {gate.owner_company_name}
        </Button>
      )}
      {gate.status === 'ai_owned' && (
        <Badge className="border-purple-500/40 bg-purple-500/10 text-purple-300 text-[9px] justify-center">
          <Bot className="w-3 h-3 mr-1" />{de ? 'KI-Airline' : 'AI airline'} · {gate.owner_company_name}
        </Badge>
      )}
      {gate.status === 'sold_out' && (
        <Badge className="border-rose-500/40 bg-rose-500/10 text-rose-300 text-[9px] justify-center">
          <Lock className="w-3 h-3 mr-1" />{de ? 'Ausverkauft' : 'Sold out'} · {gate.owner_company_name}
        </Badge>
      )}
    </div>
  );
}