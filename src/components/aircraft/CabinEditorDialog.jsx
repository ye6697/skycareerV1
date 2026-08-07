import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Armchair, Crown, Star, Minus, Plus } from 'lucide-react';
import SeatMapView from '@/components/aircraft/SeatMapView';
import {
  ECONOMY_TIERS, BUSINESS_CLASS, FIRST_CLASS,
  getCabinConfig, getSeatCounts, canHaveBusiness, canHaveFirst,
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
      <DialogContent className="max-w-3xl bg-slate-900 border border-cyan-800 text-slate-200 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 font-mono uppercase text-base">
            {de ? 'Kabinen-Editor' : 'Cabin Editor'} — {aircraft.name} ({aircraft.registration})
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Seat map preview */}
          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-2">
            <SeatMapView aircraft={aircraft} cabin={cabin} height={360} />
            <div className="flex justify-center gap-3 text-[10px] font-mono mt-1">
              {seats.first > 0 && <span className="text-amber-300">■ First: {seats.first}</span>}
              {seats.business > 0 && <span className="text-purple-300">■ Business: {seats.business}</span>}
              <span className="text-cyan-300">■ Economy: {seats.economy}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            {/* Economy tier */}
            <div className="rounded-lg border border-cyan-900/50 bg-slate-950/60 p-3">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono uppercase mb-2">
                <Armchair className="w-3.5 h-3.5" /> Economy
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((tier) => {
                  const cfg = ECONOMY_TIERS[tier];
                  const locked = tier < current.economy_tier || level < cfg.levelReq;
                  return (
                    <button
                      key={tier}
                      type="button"
                      disabled={locked}
                      onClick={() => setCabin({ ...cabin, economy_tier: tier })}
                      className={`flex-1 rounded border px-1.5 py-1.5 text-[10px] font-mono ${
                        cabin.economy_tier === tier
                          ? 'border-cyan-500 bg-cyan-900/40 text-cyan-100'
                          : locked
                            ? 'border-slate-800 bg-slate-900 text-slate-600'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-700'
                      }`}
                    >
                      <div>{cfg.label[de ? 'de' : 'en'].replace('Economy ', '')}</div>
                      <div className="text-emerald-300">×{cfg.priceMult}</div>
                      {level < cfg.levelReq && <div className="text-amber-400">Lvl {cfg.levelReq}</div>}
                    </button>
                  );
                })}
              </div>
              {ecoUpgradeCost > 0 && (
                <p className="text-[10px] text-amber-300 mt-1.5 font-mono">
                  {de ? 'Upgrade-Kosten' : 'Upgrade cost'}: ${ecoUpgradeCost.toLocaleString()}
                </p>
              )}
            </div>

            {/* Business */}
            <div className={`rounded-lg border p-3 ${businessAllowed ? 'border-purple-900/50 bg-slate-950/60' : 'border-slate-800 bg-slate-950/40 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-mono uppercase">
                  <Star className="w-3.5 h-3.5" /> Business <span className="text-emerald-300">×{BUSINESS_CLASS.priceMult}</span>
                </div>
                {businessAllowed && businessLevelOk ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setBusiness(-2)} className="h-6 w-6 p-0 bg-slate-800"><Minus className="w-3 h-3" /></Button>
                    <span className="w-8 text-center font-mono text-sm text-purple-200">{cabin.business_seats}</span>
                    <Button size="sm" onClick={() => setBusiness(2)} className="h-6 w-6 p-0 bg-purple-800"><Plus className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">
                    {!businessAllowed ? (de ? 'Ab Regional-Jet' : 'Regional jet+') : `Lvl ${BUSINESS_CLASS.levelReq}`}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                ${BUSINESS_CLASS.costPerSeat.toLocaleString()}/Sitz · {de ? 'belegt' : 'uses'} {BUSINESS_CLASS.spacePerSeat} Eco-{de ? 'Plätze' : 'slots'}
              </p>
            </div>

            {/* First */}
            <div className={`rounded-lg border p-3 ${firstAllowed ? 'border-amber-900/50 bg-slate-950/60' : 'border-slate-800 bg-slate-950/40 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-mono uppercase">
                  <Crown className="w-3.5 h-3.5" /> First <span className="text-emerald-300">×{FIRST_CLASS.priceMult}</span>
                </div>
                {firstAllowed && firstLevelOk ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setFirst(-2)} className="h-6 w-6 p-0 bg-slate-800"><Minus className="w-3 h-3" /></Button>
                    <span className="w-8 text-center font-mono text-sm text-amber-200">{cabin.first_seats}</span>
                    <Button size="sm" onClick={() => setFirst(2)} className="h-6 w-6 p-0 bg-amber-700"><Plus className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">
                    {!firstAllowed ? (de ? 'Ab Narrow-Body' : 'Narrow body+') : `Lvl ${FIRST_CLASS.levelReq}`}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                ${FIRST_CLASS.costPerSeat.toLocaleString()}/Sitz · {de ? 'belegt' : 'uses'} {FIRST_CLASS.spacePerSeat} Eco-{de ? 'Plätze' : 'slots'}
              </p>
            </div>

            {/* Cost summary */}
            <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-3 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">{de ? 'Umbau-Kosten' : 'Refit cost'}</span>
                <span className={canAfford ? 'text-emerald-300 font-bold' : 'text-red-400 font-bold'}>
                  ${totalCost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">{de ? 'Guthaben' : 'Balance'}</span>
                <span className="text-slate-300">${Math.round(balance).toLocaleString()}</span>
              </div>
              <p className="text-[9px] text-slate-500">
                {de
                  ? 'Höherwertige Sitze füllen sich nur bei guter Reputation, bringen aber deutlich mehr Umsatz pro Sitz.'
                  : 'Premium seats only fill with good reputation, but earn much more revenue per seat.'}
              </p>
              {saveMutation.isError && (
                <p className="text-[10px] text-red-400">{saveMutation.error?.message}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onClose?.()} className="bg-slate-800 text-slate-300 hover:bg-slate-700 h-8 text-xs font-mono">
            {de ? 'ABBRECHEN' : 'CANCEL'}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!changed || !canAfford || saveMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 h-8 text-xs font-mono font-bold"
          >
            {saveMutation.isPending ? (de ? 'SPEICHERE...' : 'SAVING...') : (de ? `UMBAUEN ($${totalCost.toLocaleString()})` : `REFIT ($${totalCost.toLocaleString()})`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}