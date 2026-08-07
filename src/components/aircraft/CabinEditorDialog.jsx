import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Armchair, Crown, Star, TrendingUp, TrendingDown, Plane, Wallet } from 'lucide-react';
import SeatMapView from '@/components/aircraft/SeatMapView';
import CabinClassRow from '@/components/aircraft/CabinClassRow';
import {
  ECONOMY_TIERS, BUSINESS_CLASS, FIRST_CLASS,
  getCabinConfig, getSeatCounts, canHaveBusiness, canHaveFirst, getRevenuePotential,
} from '@/lib/cabinConfig';
import { useLanguage } from '@/components/LanguageContext';

export default function CabinEditorDialog({ aircraft, company, open, onClose }) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [cabin, setCabin] = useState(() => getCabinConfig(aircraft));

  useEffect(() => {
    if (open && aircraft) setCabin(getCabinConfig(aircraft));
  }, [open, aircraft]);

  const current = getCabinConfig(aircraft);
  const seats = getSeatCounts(aircraft, cabin);
  const level = Number(company?.level || 1);
  const balance = Number(company?.balance || 0);

  // Costs: only additions cost money, downgrades/removals are free (no refund).
  const addedBusiness = Math.max(0, cabin.business_seats - current.business_seats);
  const addedFirst = Math.max(0, cabin.first_seats - current.first_seats);
  const ecoUpgradeCost = cabin.economy_tier > current.economy_tier
    ? Array.from({ length: cabin.economy_tier - current.economy_tier })
        .reduce((sum, _, i) => sum + (ECONOMY_TIERS[current.economy_tier + i + 1]?.upgradeCostPerSeat || 0) * seats.economy, 0)
    : 0;
  const totalCost = addedBusiness * BUSINESS_CLASS.costPerSeat + addedFirst * FIRST_CLASS.costPerSeat + ecoUpgradeCost;
  const changed = cabin.economy_tier !== current.economy_tier
    || cabin.business_seats !== current.business_seats
    || cabin.first_seats !== current.first_seats;
  const canAfford = balance >= totalCost;

  // Revenue potential comparison (reference reputation).
  const currentPotential = getRevenuePotential(aircraft, current);
  const newPotential = getRevenuePotential(aircraft, cabin);
  const potentialDeltaPct = currentPotential.total > 0
    ? Math.round(((newPotential.total - currentPotential.total) / currentPotential.total) * 100)
    : 0;

  const setBusiness = (delta) => {
    const next = Math.max(0, cabin.business_seats + delta);
    const test = getSeatCounts(aircraft, { ...cabin, business_seats: next });
    if (delta > 0 && test.economy <= 0) return;
    setCabin({ ...cabin, business_seats: next });
  };
  const setFirst = (delta) => {
    const next = Math.max(0, cabin.first_seats + delta);
    const test = getSeatCounts(aircraft, { ...cabin, first_seats: next });
    if (delta > 0 && test.economy <= 0) return;
    setCabin({ ...cabin, first_seats: next });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!changed) return null;
      if (!canAfford) throw new Error(lang === 'de' ? 'Nicht genug Guthaben.' : 'Insufficient balance.');
      await base44.entities.Aircraft.update(aircraft.id, { cabin_config: cabin });
      if (totalCost > 0) {
        await base44.entities.Company.update(company.id, { balance: balance - totalCost });
        await base44.entities.Transaction.create({
          company_id: company.id,
          type: 'expense',
          category: 'other',
          amount: totalCost,
          description: lang === 'de'
            ? `Kabinenumbau ${aircraft.registration || aircraft.name}`
            : `Cabin refit ${aircraft.registration || aircraft.name}`,
          reference_id: aircraft.id,
          date: new Date().toISOString(),
        });
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      onClose?.();
    },
  });

  if (!aircraft) return null;

  const de = lang === 'de';
  const businessAllowed = canHaveBusiness(aircraft);
  const firstAllowed = canHaveFirst(aircraft);
  const businessLevelOk = level >= BUSINESS_CLASS.levelReq;
  const firstLevelOk = level >= FIRST_CLASS.levelReq;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="max-w-4xl border border-cyan-900/60 bg-slate-950 p-0 text-slate-200 max-h-[94vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 border-b border-cyan-900/40 bg-gradient-to-r from-cyan-950/60 via-slate-950 to-slate-950 px-4 py-3 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-left text-sm font-semibold text-cyan-100">
            <Plane className="h-4 w-4 text-cyan-400" />
            <span className="font-mono uppercase tracking-[0.16em] text-cyan-300">
              {de ? 'Kabinen-Konfiguration' : 'Cabin configuration'}
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-cyan-100">{aircraft.name}</span>
            <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {aircraft.registration}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* Cabin plan */}
            <div className="rounded-xl border border-cyan-900/40 bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.16),transparent_45%),#020617] p-3">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <span>{de ? 'Sitzplan (Draufsicht)' : 'Seat map (top view)'}</span>
                <span className="text-cyan-300">
                  {seats.total} / {seats.capacity} {de ? 'Plätze' : 'seats'}
                </span>
              </div>

              <SeatMapView aircraft={aircraft} cabin={cabin} height={330} />

              <div className="mt-3 grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-2 py-1.5 text-center">
                  <span className="block text-amber-500/80">First</span>
                  <span className="text-sm font-bold text-amber-200">{seats.first}</span>
                </div>
                <div className="rounded-lg border border-purple-900/50 bg-purple-950/20 px-2 py-1.5 text-center">
                  <span className="block text-purple-400/80">Business</span>
                  <span className="text-sm font-bold text-purple-200">{seats.business}</span>
                </div>
                <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 px-2 py-1.5 text-center">
                  <span className="block text-cyan-500/80">Economy</span>
                  <span className="text-sm font-bold text-cyan-200">{seats.economy}</span>
                </div>
              </div>

              <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-2 font-mono text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{de ? 'Umsatz-Potenzial' : 'Revenue potential'}</span>
                  <span className={`flex items-center gap-1 font-bold ${
                    potentialDeltaPct > 0 ? 'text-emerald-300' : potentialDeltaPct < 0 ? 'text-rose-400' : 'text-slate-300'
                  }`}>
                    {potentialDeltaPct > 0 ? <TrendingUp className="h-3 w-3" /> : potentialDeltaPct < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {potentialDeltaPct > 0 ? '+' : ''}{potentialDeltaPct}%
                  </span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-800">
                  {newPotential.first > 0 && <div className="h-full bg-amber-400" style={{ width: `${(newPotential.first / newPotential.total) * 100}%` }} />}
                  {newPotential.business > 0 && <div className="h-full bg-purple-400" style={{ width: `${(newPotential.business / newPotential.total) * 100}%` }} />}
                  <div className="h-full bg-cyan-400" style={{ width: `${(newPotential.economy / Math.max(1, newPotential.total)) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-3">
              <div className="rounded-xl border border-cyan-800/50 bg-gradient-to-br from-cyan-950/35 to-slate-950/80 p-3">
                <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-cyan-200">
                  <Armchair className="h-4 w-4" /> {de ? 'Economy-Standard' : 'Economy standard'}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((tier) => {
                    const cfg = ECONOMY_TIERS[tier];
                    const locked = tier < current.economy_tier || level < cfg.levelReq;
                    const active = cabin.economy_tier === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        disabled={locked}
                        onClick={() => setCabin({ ...cabin, economy_tier: tier })}
                        className={`rounded-lg border px-1.5 py-2 font-mono text-[10px] transition ${
                          active
                            ? 'border-cyan-400 bg-cyan-900/50 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                            : locked
                              ? 'border-slate-800 bg-slate-900/60 text-slate-600'
                              : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-700 hover:text-cyan-100'
                        }`}
                      >
                        <span className="block font-semibold uppercase tracking-wide">
                          {cfg.label[de ? 'de' : 'en'].replace('Economy ', '')}
                        </span>
                        <span className="mt-0.5 block text-emerald-300">×{cfg.priceMult}</span>
                        {level < cfg.levelReq && <span className="mt-0.5 block text-amber-400">Lvl {cfg.levelReq}</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-400">
                  {ECONOMY_TIERS[cabin.economy_tier]?.desc?.[de ? 'de' : 'en']}
                  {(ECONOMY_TIERS[cabin.economy_tier]?.loadBonus || 0) > 0 && (
                    <span className="text-emerald-400"> · +{Math.round((ECONOMY_TIERS[cabin.economy_tier].loadBonus) * 100)}% {de ? 'Auslastung' : 'load factor'}</span>
                  )}
                </p>
                {ecoUpgradeCost > 0 && (
                  <p className="mt-1.5 rounded border border-amber-800/50 bg-amber-950/25 px-2 py-1 font-mono text-[10px] text-amber-200">
                    {de ? 'Upgrade-Kosten' : 'Upgrade cost'}: ${ecoUpgradeCost.toLocaleString()}
                  </p>
                )}
              </div>

              <CabinClassRow
                icon={Star}
                title="Business"
                accent="purple"
                priceMult={BUSINESS_CLASS.priceMult}
                seats={cabin.business_seats}
                onDec={() => setBusiness(-2)}
                onInc={() => setBusiness(2)}
                enabled={businessAllowed && businessLevelOk}
                lockLabel={!businessAllowed ? (de ? 'Ab Regional-Jet' : 'Regional jet+') : `Lvl ${BUSINESS_CLASS.levelReq}`}
                costPerSeat={BUSINESS_CLASS.costPerSeat}
                spacePerSeat={BUSINESS_CLASS.spacePerSeat}
                de={de}
              />

              <CabinClassRow
                icon={Crown}
                title="First"
                accent="amber"
                priceMult={FIRST_CLASS.priceMult}
                seats={cabin.first_seats}
                onDec={() => setFirst(-2)}
                onInc={() => setFirst(2)}
                enabled={firstAllowed && firstLevelOk}
                lockLabel={!firstAllowed ? (de ? 'Ab Narrow-Body' : 'Narrow body+') : `Lvl ${FIRST_CLASS.levelReq}`}
                costPerSeat={FIRST_CLASS.costPerSeat}
                spacePerSeat={FIRST_CLASS.spacePerSeat}
                de={de}
              />

              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/80">
                      {de ? 'Umbau-Kosten' : 'Refit cost'}
                    </p>
                    <p className={`font-mono text-xl font-bold ${canAfford ? 'text-emerald-300' : 'text-rose-400'}`}>
                      ${totalCost.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                    <Wallet className="h-3.5 w-3.5 text-slate-500" />
                    ${Math.round(balance).toLocaleString()}
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  {de
                    ? 'Premium-Sitze füllen sich nur bei guter Reputation und auf Langstrecken, bringen aber ein Vielfaches pro Sitz.'
                    : 'Premium seats only fill with good reputation and on long-haul routes, but earn multiples per seat.'}
                </p>
                {saveMutation.isError && (
                  <p className="mt-1 font-mono text-[10px] text-rose-400">{saveMutation.error?.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-slate-800 bg-slate-950/95 px-4 py-3">
          <Button onClick={() => onClose?.()} className="h-9 bg-slate-800 font-mono text-xs text-slate-200 hover:bg-slate-700">
            {de ? 'ABBRECHEN' : 'CANCEL'}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!changed || !canAfford || saveMutation.isPending}
            className="h-9 bg-cyan-600 font-mono text-xs font-bold text-slate-950 hover:bg-cyan-500 disabled:opacity-50"
          >
            {saveMutation.isPending
              ? (de ? 'SPEICHERE...' : 'SAVING...')
              : (de ? `UMBAUEN ($${totalCost.toLocaleString()})` : `REFIT ($${totalCost.toLocaleString()})`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}