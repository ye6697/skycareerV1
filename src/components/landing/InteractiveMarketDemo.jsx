import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { useSignupGate, GateIndicator } from './SignupGate';

const FLEET = [
  { name: 'Cessna 172', tier: 'PROP', tier_label: 'Propeller', pax: '3', range: '640 NM', price: '$425K', level: 1 },
  { name: 'A320neo', tier: 'NB', tier_label: 'Narrow-Body', pax: '180', range: '3,500 NM', price: '$100M', level: 17 },
  { name: 'B777-300ER', tier: 'WB', tier_label: 'Wide-Body', pax: '396', range: '7,370 NM', price: '$285M', level: 26 },
  { name: 'B747-8F', tier: 'CARGO', tier_label: 'Cargo', pax: '134t', range: '4,120 NM', price: '$400M', level: 30 },
];

export default function InteractiveMarketDemo({ lang = 'en' }) {
  const { requestInteraction } = useSignupGate();
  const [idx, setIdx] = useState(1);

  const move = (delta) => {
    if (!requestInteraction()) return;
    setIdx((prev) => (prev + delta + FLEET.length) % FLEET.length);
  };

  const buy = () => {
    requestInteraction({
      force: true,
      reason: lang === 'de'
        ? 'Flugzeugkauf und Hangar-Slot-Zuweisung sind nur in der Vollversion verfügbar.'
        : 'Aircraft purchase and hangar slot assignment are only available in the full version.',
    });
  };

  const a = FLEET[idx];

  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-blue-950/30 border border-slate-700/60">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-cyan-500/15 to-transparent" />

      <div className="absolute left-1/2 -translate-x-1/2 bottom-10 w-[70%] aspect-[3/1] rounded-[50%] bg-gradient-to-r from-cyan-500/0 via-cyan-500/30 to-cyan-500/0 blur-md" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-[60%] aspect-[3/1] rounded-[50%] border-2 border-cyan-500/40" />

      <div key={a.name} className="absolute left-1/2 bottom-16 -translate-x-1/2 w-[55%] max-w-[280px] animate-[fadeIn_0.4s_ease-out]">
        <svg viewBox="0 0 400 120" className="w-full">
          <g fill="#0f172a" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="2">
            <ellipse cx="200" cy="60" rx="170" ry="11" />
            <path d="M70 60 L210 14 L210 50 Z" />
            <path d="M70 60 L210 106 L210 70 Z" />
            <path d="M340 60 L385 35 L385 60 Z" />
            <path d="M340 60 L385 85 L385 60 Z" />
            {a.tier !== 'PROP' && <ellipse cx="155" cy="74" rx="14" ry="6" fill="#1e293b" />}
            {a.tier !== 'PROP' && <ellipse cx="245" cy="74" rx="14" ry="6" fill="#1e293b" />}
            {a.tier === 'PROP' && <circle cx="20" cy="60" r="10" fill="#22d3ee" opacity="0.5" />}
          </g>
        </svg>
      </div>

      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5">
        {FLEET.map((f, i) => (
          <button
            key={f.name}
            type="button"
            onClick={() => {
              if (!requestInteraction()) return;
              setIdx(i);
            }}
            className={`px-2 py-1 rounded-md border backdrop-blur-sm text-[9px] font-mono uppercase transition-all ${
              i === idx
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {f.tier}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => move(-1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950/80 border border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-cyan-300 flex items-center justify-center"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-950/80 border border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-cyan-300 flex items-center justify-center"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="absolute top-2 right-2 w-32 rounded-md border border-slate-700 bg-slate-950/90 backdrop-blur-sm p-2 space-y-1">
        <div className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 truncate">{a.name}</div>
        {[
          { k: 'TYPE', v: a.tier_label },
          { k: 'PAX', v: a.pax },
          { k: 'RANGE', v: a.range },
          { k: 'LVL', v: `≥${a.level}` },
          { k: 'PRICE', v: a.price },
        ].map((row) => (
          <div key={row.k} className="flex items-center justify-between text-[9px] font-mono">
            <span className="text-slate-500">{row.k}</span>
            <span className="text-white truncate ml-1">{row.v}</span>
          </div>
        ))}
        <button
          type="button"
          onClick={buy}
          className="w-full mt-1 flex items-center justify-center gap-1 py-1 rounded bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-[9px] font-mono font-bold uppercase"
        >
          <ShoppingCart className="w-3 h-3" />
          {lang === 'de' ? 'Kaufen' : 'Buy'}
        </button>
      </div>

      <div className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">
        {lang === 'de' ? '3D FLUGZEUG-MARKT' : '3D AIRCRAFT MARKET'}
      </div>
      <div className="absolute bottom-12 left-2"><GateIndicator lang={lang} /></div>
    </div>
  );
}