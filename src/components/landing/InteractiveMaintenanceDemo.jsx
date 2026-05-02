import React, { useState } from 'react';
import { Wrench, CheckCircle2 } from 'lucide-react';
import { useSignupGate, GateIndicator } from './SignupGate';

const initialHotspots = [
  { key: 'engine', x: '22%', y: '38%', label_de: 'Triebwerk', label_en: 'Engine', val: 72 },
  { key: 'avionics', x: '50%', y: '25%', label_de: 'Avionik', label_en: 'Avionics', val: 18 },
  { key: 'hydraulics', x: '78%', y: '42%', label_de: 'Hydraulik', label_en: 'Hydraulics', val: 45 },
  { key: 'gear', x: '38%', y: '70%', label_de: 'Fahrwerk', label_en: 'Gear', val: 88 },
  { key: 'airframe', x: '62%', y: '72%', label_de: 'Zelle', label_en: 'Airframe', val: 32 },
];

function colorForVal(v) {
  if (v > 60) return { dot: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/50' };
  if (v > 40) return { dot: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/50' };
  return { dot: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/50' };
}

export default function InteractiveMaintenanceDemo({ lang = 'en' }) {
  const { requestInteraction } = useSignupGate();
  const [hotspots, setHotspots] = useState(initialHotspots);
  const [selected, setSelected] = useState('engine');
  const [justRepaired, setJustRepaired] = useState(null);

  const sel = hotspots.find((h) => h.key === selected) || hotspots[0];
  const col = colorForVal(sel.val);

  const handleRepair = () => {
    if (!requestInteraction({
      reason: lang === 'de'
        ? 'Echte Wartung mit Kosten, Versicherung und Failure-Prevention nur in der Vollversion.'
        : 'Real maintenance with cost, insurance and failure prevention only in full version.',
    })) return;
    setHotspots((prev) => prev.map((h) => h.key === selected ? { ...h, val: Math.max(0, h.val - 60) } : h));
    setJustRepaired(selected);
    setTimeout(() => setJustRepaired(null), 1500);
  };

  const handleSelect = (key) => {
    if (!requestInteraction()) return;
    setSelected(key);
  };

  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 border border-slate-700/60">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-cyan-500/10 to-transparent" />

      <svg viewBox="0 0 400 240" className="absolute inset-0 w-full h-full">
        <g fill="#0f172a" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.5">
          <ellipse cx="200" cy="120" rx="160" ry="14" />
          <path d="M40 120 L200 60 L360 120 L200 138 Z" />
          <path d="M340 120 L385 90 L385 150 Z" />
          <path d="M345 120 L365 105 L365 135 Z" fill="#0b1220" />
          <ellipse cx="135" cy="135" rx="12" ry="6" fill="#1e293b" />
          <ellipse cx="265" cy="135" rx="12" ry="6" fill="#1e293b" />
        </g>
      </svg>

      {hotspots.map((h) => {
        const c = colorForVal(h.val);
        const isSelected = h.key === selected;
        const isHealed = justRepaired === h.key;
        return (
          <button
            key={h.key}
            type="button"
            onClick={() => handleSelect(h.key)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
            style={{ left: h.x, top: h.y }}
          >
            <span className={`block w-3.5 h-3.5 rounded-full ${c.dot} ring-4 ${isSelected ? c.ring : 'ring-black/40'} ${isSelected ? 'scale-125' : ''} transition-transform animate-pulse`} />
            <span className={`absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/90 border ${isSelected ? 'border-cyan-500' : 'border-slate-700'} text-slate-200 transition-colors`}>
              {lang === 'de' ? h.label_de : h.label_en} <span className={c.text}>{h.val}%</span>
              {isHealed && <CheckCircle2 className="inline-block w-3 h-3 ml-1 text-emerald-400" />}
            </span>
          </button>
        );
      })}

      <div className="absolute top-2 left-2 flex gap-1.5">
        <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">3D MAINT</span>
        <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 bg-slate-950/70 border border-emerald-700/40 px-1.5 py-0.5 rounded">LIVE</span>
      </div>
      <div className="absolute top-2 right-2"><GateIndicator lang={lang} /></div>

      <div className="absolute bottom-2 left-2 right-2 rounded-md border border-slate-700 bg-slate-950/90 backdrop-blur-sm p-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
            {lang === 'de' ? 'Auswahl' : 'Selected'}
          </div>
          <div className="text-xs font-mono text-white truncate">
            {lang === 'de' ? sel.label_de : sel.label_en} · <span className={col.text}>{sel.val}%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRepair}
          disabled={sel.val === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono uppercase font-bold transition-colors ${
            sel.val === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
          }`}
        >
          <Wrench className="w-3 h-3" />
          {lang === 'de' ? 'Reparieren' : 'Repair'}
        </button>
      </div>
    </div>
  );
}