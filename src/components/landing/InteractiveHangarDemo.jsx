import React, { useState } from 'react';
import { CheckCircle2, ArrowUp } from 'lucide-react';
import { useSignupGate, GateIndicator } from './SignupGate';

const TIERS = [
  { key: 'small', name: 'Small', color: 'from-slate-700 to-slate-900', accent: 'bg-slate-500', height: 60, price: 250000 },
  { key: 'medium', name: 'Medium', color: 'from-blue-700 to-blue-950', accent: 'bg-blue-500', height: 90, price: 850000 },
  { key: 'large', name: 'Large', color: 'from-amber-600 to-amber-900', accent: 'bg-amber-500', height: 120, price: 2500000 },
  { key: 'mega', name: 'Mega', color: 'from-purple-700 to-purple-950', accent: 'bg-purple-500', height: 150, price: 7500000 },
];

const TIER_INDEX = TIERS.reduce((acc, t, i) => ({ ...acc, [t.key]: i }), {});

export default function InteractiveHangarDemo({ lang = 'en' }) {
  const { requestInteraction } = useSignupGate();
  const [ownedTier, setOwnedTier] = useState('small');
  const [selectedTier, setSelectedTier] = useState('large');

  const ownedIdx = TIER_INDEX[ownedTier];
  const selectedIdx = TIER_INDEX[selectedTier];
  const action = selectedIdx > ownedIdx ? 'upgrade' : selectedIdx === ownedIdx ? 'owned' : 'invalid';

  const handleSelect = (key) => {
    if (!requestInteraction()) return;
    setSelectedTier(key);
  };

  const handleAction = () => {
    if (action !== 'upgrade') return;
    if (!requestInteraction({
      reason: lang === 'de'
        ? 'Hangar-Upgrades und Aircraft-Transfers gibt es in der Vollversion an 24+ echten Hubs.'
        : 'Hangar upgrades and aircraft transfers are available in the full version at 24+ real hubs.',
    })) return;
    setOwnedTier(selectedTier);
  };

  return (
    <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-b from-sky-900/30 via-slate-950 to-slate-950 border border-slate-700/60">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.15) 1px, transparent 1px)', backgroundSize: '100% 24px' }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-emerald-900/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-800 to-slate-900 border-t border-cyan-500/20" />

      <div className="absolute inset-x-0 bottom-12 flex items-end justify-around px-4 gap-2">
        {TIERS.map((t) => {
          const idx = TIER_INDEX[t.key];
          const isOwned = idx === ownedIdx;
          const isSelected = idx === selectedIdx;
          const canUpgrade = idx > ownedIdx;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => handleSelect(t.key)}
              className="flex flex-col items-center gap-1 flex-1 group focus:outline-none"
            >
              {isOwned && (
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 uppercase tracking-wider">
                  {lang === 'de' ? 'IM BESITZ' : 'OWNED'}
                </span>
              )}
              {!isOwned && canUpgrade && isSelected && (
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 uppercase tracking-wider">
                  UPGRADE
                </span>
              )}
              <div
                className={`relative w-full max-w-[80px] rounded-t-2xl bg-gradient-to-b ${t.color} border-x border-t shadow-lg transition-all ${
                  isSelected ? 'border-cyan-400 ring-2 ring-cyan-500/40 scale-105' : 'border-slate-700 group-hover:border-slate-500'
                }`}
                style={{ height: t.height }}
              >
                <div className={`absolute -top-1 left-2 right-2 h-1 rounded-full ${t.accent}/60`} />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-1/2 bg-slate-950/70 border-t border-cyan-500/30 rounded-t-md" />
                {isOwned && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />}
              </div>
              <span className={`text-[10px] font-mono uppercase ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>{t.name}</span>
              <span className="text-[9px] font-mono text-slate-500">${(t.price / 1000).toFixed(0)}K</span>
            </button>
          );
        })}
      </div>

      <div className="absolute top-2 left-2">
        <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 border border-cyan-700/40 px-1.5 py-0.5 rounded">
          EDDF · {lang === 'de' ? 'HANGAR MARKT' : 'HANGAR MARKET'}
        </span>
      </div>
      <div className="absolute top-2 right-2"><GateIndicator lang={lang} /></div>

      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] rounded-md border border-slate-700 bg-slate-950/90 backdrop-blur-sm p-1.5 flex items-center justify-between gap-2">
        <div className="text-[9px] font-mono text-slate-300 truncate">
          {action === 'owned' && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> {lang === 'de' ? 'Bereits im Besitz' : 'Already owned'}
            </span>
          )}
          {action === 'upgrade' && (
            <span className="text-cyan-300">
              {lang === 'de' ? 'Upgrade auf' : 'Upgrade to'} {TIERS[selectedIdx].name} · ${(TIERS[selectedIdx].price / 1000000).toFixed(1)}M
            </span>
          )}
          {action === 'invalid' && (
            <span className="text-amber-400">{lang === 'de' ? 'Downgrade nicht möglich' : 'Downgrade not allowed'}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAction}
          disabled={action !== 'upgrade'}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono uppercase font-bold transition-colors ${
            action === 'upgrade'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <ArrowUp className="w-3 h-3" />
          {lang === 'de' ? 'Bauen' : 'Build'}
        </button>
      </div>
    </div>
  );
}