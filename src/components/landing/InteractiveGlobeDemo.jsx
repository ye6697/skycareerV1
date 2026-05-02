import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useSignupGate, GateIndicator } from './SignupGate';

const ROUTES = [
  { id: 'jfk', from: { x: 28, y: 42, code: 'EDDF' }, to: { x: 70, y: 32, code: 'KJFK' }, payout: '$284K', diff: 'HARD', color: '#3b82f6', diffColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300', dist: 3340 },
  { id: 'omdb', from: { x: 28, y: 42, code: 'EDDF' }, to: { x: 50, y: 56, code: 'OMDB' }, payout: '$192K', diff: 'MED', color: '#10b981', diffColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', dist: 2780 },
  { id: 'yssy', from: { x: 28, y: 42, code: 'EDDF' }, to: { x: 78, y: 70, code: 'YSSY' }, payout: '$612K', diff: 'EXTREME', color: '#f59e0b', diffColor: 'border-red-500/40 bg-red-500/10 text-red-300', dist: 9180 },
];

export default function InteractiveGlobeDemo({ lang = 'en' }) {
  const { requestInteraction } = useSignupGate();
  const [selected, setSelected] = useState('jfk');
  const [accepted, setAccepted] = useState(null);

  const handleSelect = (id) => {
    if (!requestInteraction()) return;
    setSelected(id);
  };

  const handleAccept = () => {
    if (!requestInteraction({
      reason: lang === 'de'
        ? 'Auftragsannahme und Live-Routenführung gibt es in der Vollversion mit allen Features.'
        : 'Contract acceptance and live routing are only available in the full version.',
    })) return;
    setAccepted(selected);
    setTimeout(() => setAccepted(null), 1500);
  };

  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950/40 to-slate-950 border border-slate-700/60">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(56,189,248,.4), transparent 60%)' }} />
      <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full">
        <g fill="#1e293b" stroke="#334155" strokeWidth="0.3">
          <path d="M10 40 Q15 30 25 32 L32 38 L28 48 L18 50 Z" />
          <path d="M40 28 L60 26 L62 38 L48 42 L42 36 Z" />
          <path d="M65 22 L82 20 L86 30 L78 36 L66 32 Z" />
          <path d="M70 50 L85 48 L88 58 L72 60 Z" />
          <path d="M48 50 L58 48 L60 58 L50 60 Z" />
        </g>
        {ROUTES.map((r) => {
          const isSelected = selected === r.id;
          return (
            <g key={r.id} onClick={() => handleSelect(r.id)} style={{ cursor: 'pointer' }}>
              <path
                d={`M${r.from.x} ${r.from.y} Q ${(r.from.x + r.to.x) / 2} ${Math.min(r.from.y, r.to.y) - 18} ${r.to.x} ${r.to.y}`}
                fill="none"
                stroke={r.color}
                strokeWidth={isSelected ? '1.0' : '0.5'}
                strokeDasharray={isSelected ? '0' : '1.5 1.2'}
                opacity={isSelected ? '1' : '0.55'}
              />
              <circle cx={r.to.x} cy={r.to.y} r={isSelected ? '1.8' : '1.2'} fill={r.color} />
              <path
                d={`M${r.from.x} ${r.from.y} Q ${(r.from.x + r.to.x) / 2} ${Math.min(r.from.y, r.to.y) - 18} ${r.to.x} ${r.to.y}`}
                fill="none"
                stroke="transparent"
                strokeWidth="3"
              />
            </g>
          );
        })}
        <circle cx="28" cy="42" r="1.5" fill="#10b981" />
        <circle cx="28" cy="42" r="2.5" fill="none" stroke="#10b981" strokeWidth="0.4" opacity="0.7">
          <animate attributeName="r" values="1.5;3.5;1.5" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </svg>

      <div className="absolute top-9 right-2 w-44 space-y-1.5">
        {ROUTES.map((r) => {
          const isSelected = selected === r.id;
          const isAccepted = accepted === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r.id)}
              className={`block w-full text-left rounded-md border p-1.5 transition-all ${
                isSelected
                  ? 'border-cyan-400 bg-slate-950/95 ring-1 ring-cyan-500/40'
                  : 'border-slate-700 bg-slate-950/85 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-white">{r.from.code} → {r.to.code}</span>
                <span className={`px-1 rounded border ${r.diffColor}`}>{r.diff}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-emerald-400 font-bold">{r.payout}</span>
                {isAccepted && <Check className="w-3 h-3 text-emerald-400" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">
        {lang === 'de' ? 'AUFTRAGS-GLOBUS' : 'CONTRACT GLOBE'}
      </div>
      <div className="absolute top-2 right-2"><GateIndicator lang={lang} /></div>

      <div className="absolute bottom-2 left-2 right-2 rounded-md border border-cyan-500/40 bg-slate-950/90 backdrop-blur-sm p-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-mono">
          <span className="text-slate-500">{lang === 'de' ? 'Aktiv:' : 'Active:'} </span>
          <span className="text-cyan-300">
            {ROUTES.find((r) => r.id === selected)?.from.code} → {ROUTES.find((r) => r.id === selected)?.to.code} · {ROUTES.find((r) => r.id === selected)?.dist} NM
          </span>
        </div>
        <button
          type="button"
          onClick={handleAccept}
          className="px-3 py-1 rounded bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-[10px] font-mono font-bold uppercase shadow-[0_0_10px_rgba(34,211,238,0.3)]"
        >
          {lang === 'de' ? 'Annehmen' : 'Accept'}
        </button>
      </div>
    </div>
  );
}