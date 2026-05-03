import React from 'react';
import { Card } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { SC_PACKS, getScPackSavingsPct } from '@/lib/lemonItemCatalog';
import { useLanguage } from '@/components/LanguageContext';
import RealMoneyBuyButton from '@/components/store/RealMoneyBuyButton';
import { Coins, Sparkles } from 'lucide-react';

function formatSc(amount) {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(amount % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k`;
  return String(amount);
}

export default function SkyDollarPacks() {
  const { lang } = useLanguage();
  const qc = useQueryClient();

  return (
    <Card className="p-5 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30">
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-bold text-amber-200">
          {lang === 'de' ? 'SkyCareer Dollar kaufen' : 'Buy SkyCareer Dollars'}
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {lang === 'de'
          ? 'Größere Pakete sparen pro SC$. Lieferung sofort nach Zahlung.'
          : 'Bigger packs save more per SC$. Delivered instantly after payment.'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SC_PACKS.map((pack) => {
          const savings = getScPackSavingsPct(pack);
          const isBest = savings === Math.max(...SC_PACKS.map((p) => getScPackSavingsPct(p)));
          return (
            <div
              key={pack.sku}
              className={`relative rounded-xl border p-3 flex flex-col items-center text-center ${
                isBest
                  ? 'bg-gradient-to-b from-amber-500/15 to-slate-950 border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-950/60 border-slate-700'
              }`}
            >
              {isBest && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {lang === 'de' ? 'Bestes Angebot' : 'Best deal'}
                </span>
              )}
              {savings > 0 && !isBest && (
                <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[9px] font-bold">
                  -{savings}%
                </span>
              )}
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                {pack.label.replace('SC$ Pack ', '')}
              </div>
              <div className="text-2xl font-extrabold text-amber-300 leading-tight">
                {formatSc(pack.scAmount)}
              </div>
              <div className="text-[10px] text-slate-500 mb-2">SC$</div>
              {savings > 0 && (
                <div className="text-[10px] text-emerald-400 mb-2">
                  {lang === 'de' ? `${savings}% Ersparnis` : `${savings}% savings`}
                </div>
              )}
              <RealMoneyBuyButton
                sku={pack.sku}
                priceCents={pack.priceCents}
                label={`$${(pack.priceCents / 100).toFixed(2)}`}
                onDelivered={() => {
                  qc.invalidateQueries({ queryKey: ['company'] });
                  qc.invalidateQueries({ queryKey: ['transactions'] });
                }}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}