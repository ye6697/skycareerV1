import React from 'react';
import { Minus, Plus } from 'lucide-react';

// One premium class row (Business / First) in the cabin editor.
const ACCENTS = {
  purple: {
    panel: 'border-purple-800/50 bg-gradient-to-br from-purple-950/40 to-slate-950/80',
    title: 'text-purple-200',
    value: 'text-purple-100',
    plus: 'bg-purple-700 hover:bg-purple-600',
    chip: 'border-purple-700/50 bg-purple-900/30 text-purple-200',
  },
  amber: {
    panel: 'border-amber-800/50 bg-gradient-to-br from-amber-950/40 to-slate-950/80',
    title: 'text-amber-200',
    value: 'text-amber-100',
    plus: 'bg-amber-700 hover:bg-amber-600',
    chip: 'border-amber-700/50 bg-amber-900/30 text-amber-200',
  },
};

export default function CabinClassRow({
  icon: Icon,
  title,
  accent = 'purple',
  priceMult,
  seats,
  onDec,
  onInc,
  enabled,
  lockLabel,
  costPerSeat,
  spacePerSeat,
  de,
}) {
  const a = ACCENTS[accent] || ACCENTS.purple;
  return (
    <div className={`rounded-xl border p-3 ${enabled ? a.panel : 'border-slate-800 bg-slate-950/50 opacity-60'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${a.title}`} />
          <span className={`truncate font-mono text-xs uppercase tracking-wider ${a.title}`}>{title}</span>
          <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${a.chip}`}>
            ×{priceMult} {de ? 'Preis' : 'fare'}
          </span>
        </div>

        {enabled ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDec}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className={`w-9 text-center font-mono text-base font-bold ${a.value}`}>{seats}</span>
            <button
              type="button"
              onClick={onInc}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-slate-950 ${a.plus}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="shrink-0 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            {lockLabel}
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
        <div className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1">
          <span className="block text-slate-500">{de ? 'Kosten/Sitz' : 'Cost/seat'}</span>
          <span className="text-slate-200">${costPerSeat.toLocaleString()}</span>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1">
          <span className="block text-slate-500">{de ? 'Platzbedarf' : 'Floor space'}</span>
          <span className="text-slate-200">{spacePerSeat}× Economy</span>
        </div>
      </div>
    </div>
  );
}