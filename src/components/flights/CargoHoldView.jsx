import React from 'react';
import { Package } from 'lucide-react';

// Cargo hold loading strip: ULD containers light up as freight is loaded.
export default function CargoHoldView({ loadedKg = 0, demandKg = 0, capacityKg = 0, revenue = 0, ratePerKg = 0, de = false }) {
  if (demandKg <= 0) return null;
  const slots = 12;
  const filled = Math.round((loadedKg / Math.max(1, demandKg)) * slots);

  return (
    <div className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-amber-950/25 to-slate-950/80 p-3">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-amber-300">
          <Package className="h-3.5 w-3.5" /> {de ? 'Frachtraum' : 'Cargo hold'}
        </span>
        <span className="text-slate-400">
          {Math.round(loadedKg).toLocaleString()} / {Math.round(demandKg).toLocaleString()} kg
        </span>
      </div>

      <div className="mt-2 flex gap-1">
        {Array.from({ length: slots }).map((_, i) => (
          <div
            key={i}
            className={`h-6 flex-1 rounded-sm border transition-colors duration-300 ${
              i < filled
                ? 'border-amber-400/70 bg-amber-500/70'
                : 'border-slate-800 bg-slate-900/70'
            }`}
          />
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 font-mono text-[10px]">
        <div className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1">
          <span className="block text-slate-500">{de ? 'Kapazität' : 'Capacity'}</span>
          <span className="text-slate-200">{Math.round(capacityKg).toLocaleString()} kg</span>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1">
          <span className="block text-slate-500">{de ? 'Frachtrate' : 'Freight rate'}</span>
          <span className="text-slate-200">${ratePerKg}/kg</span>
        </div>
        <div className="rounded border border-amber-900/40 bg-amber-950/25 px-2 py-1">
          <span className="block text-amber-500/80">{de ? 'Frachterlös' : 'Freight revenue'}</span>
          <span className="font-bold text-amber-200">${Math.round(revenue).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}