import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SC_PACKS, getScPackSavingsPct } from '@/lib/lemonItemCatalog';
import { useLanguage } from '@/components/LanguageContext';
import RealMoneyBuyButton from '@/components/store/RealMoneyBuyButton';
import { Coins, Crown, TrendingUp } from 'lucide-react';

function formatSc(amount) {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(amount % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`;
  return String(amount);
}

const TIER_TONES = [
  { label: 'STARTER',    accent: 'slate',   gradient: 'from-slate-800/40 to-slate-900',     ring: 'border-slate-700' },
  { label: 'POPULAR',    accent: 'cyan',    gradient: 'from-cyan-950/50 to-slate-900',      ring: 'border-cyan-700/50' },
  { label: 'VALUE',      accent: 'sky',     gradient: 'from-sky-950/50 to-slate-900',       ring: 'border-sky-700/50' },
  { label: 'PRO',        accent: 'violet',  gradient: 'from-violet-950/50 to-slate-900',    ring: 'border-violet-600/50' },
  { label: 'ELITE',      accent: 'fuchsia', gradient: 'from-fuchsia-950/50 to-slate-900',   ring: 'border-fuchsia-600/50' },
  { label: 'LEGENDARY',  accent: 'amber',   gradient: 'from-amber-900/50 via-orange-950/40 to-slate-900', ring: 'border-amber-500/70' },
];

export default function SkyDollarPacks() {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const de = lang === 'de';

  const maxSavings = Math.max(...SC_PACKS.map((p) => getScPackSavingsPct(p)));

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-amber-500/20 overflow-hidden">
      {/* Header */}
      <div className="relative px-5 py-4 border-b border-slate-800/80 bg-gradient-to-r from-amber-950/30 via-transparent to-transparent">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Coins className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {de ? 'SkyCareer Dollar' : 'SkyCareer Dollars'}
              </h3>
              <p className="text-xs text-slate-400">
                {de ? 'Sofort-Lieferung nach Zahlung' : 'Instant delivery after payment'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono font-bold text-emerald-300 uppercase tracking-wider">
              {de ? `Bis -${maxSavings}%` : `Up to -${maxSavings}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Packs grid */}
      <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
        {SC_PACKS.map((pack, idx) => {
          const savings = getScPackSavingsPct(pack);
          const isBest = idx === SC_PACKS.length - 1;
          const tone = TIER_TONES[idx] || TIER_TONES[0];
          const priceLabel = `$${(pack.priceCents / 100).toFixed(2)}`;

          return (
            <div
              key={pack.sku}
              className={`relative rounded-xl overflow-hidden bg-gradient-to-b ${tone.gradient} border ${
                isBest ? 'border-amber-400/70 shadow-[0_0_28px_rgba(245,158,11,0.25)]' : tone.ring
              } transition-transform hover:scale-[1.02]`}
            >
              {/* Best deal crown badge */}
              {isBest && (
                <div className="absolute -top-px left-0 right-0 h-7 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center gap-1.5">
                  <Crown className="w-3 h-3 text-slate-950" />
                  <span className="text-[10px] font-extrabold text-slate-950 uppercase tracking-widest">
                    {de ? 'Bestes Angebot' : 'Best Deal'}
                  </span>
                </div>
              )}

              <div className={`relative p-4 ${isBest ? 'pt-9' : ''} flex flex-col items-center text-center`}>
                {/* Tier label */}
                {!isBest && (
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.18em] mb-2 ${
                    tone.accent === 'cyan' ? 'text-cyan-400' :
                    tone.accent === 'sky' ? 'text-sky-400' :
                    tone.accent === 'violet' ? 'text-violet-400' :
                    tone.accent === 'fuchsia' ? 'text-fuchsia-400' :
                    'text-slate-400'
                  }`}>
                    {tone.label}
                  </span>
                )}

                {/* SC$ amount */}
                <div className={`font-extrabold leading-none ${isBest ? 'text-3xl' : 'text-2xl'} ${
                  isBest
                    ? 'bg-gradient-to-br from-amber-200 via-amber-300 to-orange-400 bg-clip-text text-transparent'
                    : 'text-white'
                }`}>
                  {formatSc(pack.scAmount)}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5 mb-2">SC$</div>

                {/* Savings chip */}
                <div className="h-5 mb-3 flex items-center">
                  {savings > 0 ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      isBest
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : savings >= 50
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      −{savings}% / SC$
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">{de ? 'Basispreis' : 'Base price'}</span>
                  )}
                </div>

                {/* Price + buy button */}
                <RealMoneyBuyButton
                  sku={pack.sku}
                  priceCents={pack.priceCents}
                  label={priceLabel}
                  className="w-full"
                  onDelivered={() => {
                    qc.invalidateQueries({ queryKey: ['company'] });
                    qc.invalidateQueries({ queryKey: ['transactions'] });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-5 py-2.5 border-t border-slate-800/80 bg-slate-950/40">
        <p className="text-[10px] text-slate-500 text-center">
          {de
            ? 'Sichere Zahlung über Lemon Squeezy. SC$ werden sofort deinem Konto gutgeschrieben.'
            : 'Secure payment via Lemon Squeezy. SC$ are credited to your account instantly.'}
        </p>
      </div>
    </div>
  );
}