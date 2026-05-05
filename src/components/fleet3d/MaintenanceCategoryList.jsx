import React from 'react';
import { motion } from 'framer-motion';
import { Cog, Gauge, CircuitBoard, Shield, Plane, Zap, Wind, AlertTriangle, Wrench, Skull } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/LanguageContext';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MAINTENANCE_CATEGORY_KEYS, normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, applyPermanentWearIncrease, calculateCategoryRepairCost, resolveAircraftValueSnapshot } from '@/lib/maintenance';
import { resolveAircraftInsurance } from '@/lib/insurance';
import { isAtOverdraftLimit } from '@/components/InsolvencyBanner';

const CATEGORY_ICONS = {
  engine: Cog, hydraulics: Gauge, avionics: CircuitBoard, airframe: Shield,
  landing_gear: Plane, electrical: Zap, flight_controls: Wind, pressurization: Shield,
};

const CATEGORY_LABELS = {
  engine: { en: 'Engines', de: 'Triebwerke' },
  hydraulics: { en: 'Hydraulics', de: 'Hydraulik' },
  avionics: { en: 'Avionics', de: 'Avionik' },
  airframe: { en: 'Airframe', de: 'Zelle' },
  landing_gear: { en: 'Landing Gear', de: 'Fahrwerk' },
  electrical: { en: 'Electrical', de: 'Elektrik' },
  flight_controls: { en: 'Flight Controls', de: 'Flugsteuerung' },
  pressurization: { en: 'Pressurization', de: 'Druckkabine' },
};

function getColor(p) {
  if (p <= 20) return { text: 'text-emerald-400', bar: 'bg-emerald-500', glow: 'shadow-emerald-500/30', accent: 'border-emerald-500/40' };
  if (p <= 50) return { text: 'text-amber-400', bar: 'bg-amber-500', glow: 'shadow-amber-500/30', accent: 'border-amber-500/40' };
  if (p <= 75) return { text: 'text-orange-400', bar: 'bg-orange-500', glow: 'shadow-orange-500/30', accent: 'border-orange-500/40' };
  return { text: 'text-red-400', bar: 'bg-red-500', glow: 'shadow-red-500/40', accent: 'border-red-500/40' };
}

const clampPct = (v) => Math.max(0, Math.min(100, Number(v) || 0));

export default function MaintenanceCategoryList({ aircraft, selectedCategory, onSelectCategory }) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const cats = normalizeMaintenanceCategoryMap(aircraft?.maintenance_categories);
  const fallback = clampPct(aircraft?.used_permanent_avg);
  const perm = resolvePermanentWearCategories(aircraft?.permanent_wear_categories, fallback);

  const totals = MAINTENANCE_CATEGORY_KEYS.reduce((acc, k) => {
    acc[k] = Math.min(100, clampPct(cats[k]) + clampPct(perm[k]));
    return acc;
  }, {});
  const overallWear = MAINTENANCE_CATEGORY_KEYS.reduce((s, k) => s + totals[k], 0) / MAINTENANCE_CATEGORY_KEYS.length;

  const insurance = resolveAircraftInsurance(aircraft);
  const insuranceCovPct = Math.max(0, Math.min(1, Number(insurance.maintenanceCoveragePct || 0)));
  const purchasePrice = Math.max(1, Number(aircraft?.purchase_price || aircraft?.current_value || 1));
  const valueSnapshot = resolveAircraftValueSnapshot(aircraft);
  const accumulated = Math.min(Math.max(0, Number(aircraft?.accumulated_maintenance_cost || 0)), purchasePrice);
  const modeledTotal = MAINTENANCE_CATEGORY_KEYS.reduce((sum, key) => sum + calculateCategoryRepairCost({ wearPct: clampPct(cats[key]), purchasePrice }), 0);
  const repairBaseTotal = valueSnapshot.activeMaintenanceCost > 0
    ? valueSnapshot.activeMaintenanceCost
    : (accumulated > 0 ? accumulated : modeledTotal);
  const grossTotal = Math.max(0, Math.round(repairBaseTotal));
  const insuredTotal = Math.round(grossTotal * insuranceCovPct);
  const payableTotal = Math.max(0, grossTotal - insuredTotal);

  const { data: companyForLimit } = useQuery({
    queryKey: ['company-maint-limit'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const cs = await base44.entities.Company.filter({ id: cid });
        if (cs[0]) return cs[0];
      }
      const cs = await base44.entities.Company.filter({ created_by: user.email });
      return cs[0] || null;
    },
    staleTime: 30000,
  });
  const overdraftBlocked = isAtOverdraftLimit(companyForLimit);

  const repairMutation = useMutation({
    mutationFn: async (categoryKey) => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      let company = null;
      if (cid) {
        const cs = await base44.entities.Company.filter({ id: cid });
        company = cs[0] || null;
      }
      if (!company && user?.email) {
        const cs = await base44.entities.Company.filter({ created_by: user.email });
        company = cs[0] || null;
      }
      if (!company) throw new Error('No company');

      const activeWear = clampPct(cats[categoryKey]);
      const totalDynamicWear = MAINTENANCE_CATEGORY_KEYS.reduce((s, k) => s + clampPct(cats[k]), 0);
      const wearShare = totalDynamicWear > 0 ? activeWear / totalDynamicWear : 0;
      const grossCost = Math.max(0, Math.round(repairBaseTotal * wearShare));
      if (grossCost <= 0) return;
      const insuredCost = Math.round(grossCost * insuranceCovPct);
      const payable = Math.max(0, grossCost - insuredCost);

      const valueReduction = grossCost * 0.10;
      const currentValue = valueSnapshot.storedCurrentValue;
      const newValue = Math.max(0, currentValue - valueReduction);
      const newCats = { ...cats, [categoryKey]: 0 };
      const newPerm = {
        ...perm,
        [categoryKey]: applyPermanentWearIncrease({
          currentPermanentWear: perm[categoryKey],
          repairedWearPct: activeWear,
          repairCost: grossCost,
          purchasePrice,
          maxPermanentWear: 45,
        }),
      };
      const newAccumulated = Math.max(0, accumulated - grossCost);
      const newLifetime = Math.max(0, Number(aircraft?.lifetime_maintenance_cost || 0)) + grossCost;
      await base44.entities.Aircraft.update(aircraft.id, {
        maintenance_categories: newCats,
        permanent_wear_categories: newPerm,
        current_value: newValue,
        accumulated_maintenance_cost: newAccumulated,
        lifetime_maintenance_cost: newLifetime,
      });
      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - payable });
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'maintenance',
        amount: payable,
        description: `${lang === 'de' ? 'Wartung' : 'Maintenance'} ${CATEGORY_LABELS[categoryKey][lang]}: ${aircraft.name}`,
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });

  const overallColor = getColor(overallWear);

  return (
    <div className="flex flex-col h-full text-slate-200 font-mono">
      {/* Header: Overall wear */}
      <div className="p-3 border-b border-cyan-900/40 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-md">
        <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-500 mb-1.5">{lang === 'de' ? 'Gesamtverschleiss' : 'Overall Wear'}</p>
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-3xl font-black ${overallColor.text}`}>{Math.round(overallWear)}</span>
          <span className={`text-base font-bold pb-1 ${overallColor.text}`}>%</span>
          {overallWear > 75 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-red-400 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {lang === 'de' ? 'KRITISCH' : 'CRITICAL'}
            </span>
          )}
        </div>
        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/50">
          <motion.div
            className={`h-full ${overallColor.bar} shadow-lg ${overallColor.glow}`}
            initial={{ width: 0 }}
            animate={{ width: `${overallWear}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>

      {/* Insurance summary */}
      <div className="px-3 py-2 border-b border-cyan-900/40 bg-slate-900/40 backdrop-blur-md text-[10px]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 uppercase tracking-wider text-[9px]">{lang === 'de' ? 'Neuwert' : 'New value'}</span>
          <span className="text-cyan-200 font-bold">${Math.round(valueSnapshot.newValue).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 uppercase tracking-wider text-[9px]">{lang === 'de' ? 'Aktueller Wert' : 'Current value'}</span>
          <span className="text-emerald-300 font-bold">${Math.round(valueSnapshot.effectiveCurrentValue).toLocaleString()}</span>
        </div>
        {valueSnapshot.activeMaintenanceCost > 0 && (
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-700/60">
            <span className="text-orange-300 uppercase tracking-wider text-[9px]">{lang === 'de' ? 'Wartung abgezogen' : 'Maintenance deducted'}</span>
            <span className="text-orange-300 font-bold">-${Math.round(valueSnapshot.activeMaintenanceCost).toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 uppercase tracking-wider text-[9px]">{lang === 'de' ? 'Reparatur Gesamt' : 'Total Repair'}</span>
          <span className="text-amber-300 font-bold">${grossTotal.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 uppercase tracking-wider text-[9px]">
            {lang === 'de' ? 'Versicherung' : 'Insurance'} ({Math.round(insuranceCovPct * 100)}%)
          </span>
          <span className="text-emerald-300 font-bold">-${insuredTotal.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
          <span className="text-cyan-300 uppercase tracking-wider text-[10px] font-bold">{lang === 'de' ? 'Du zahlst' : 'You pay'}</span>
          <span className="text-cyan-300 font-bold text-sm">${payableTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-500 px-1 pb-1">{lang === 'de' ? 'Kategorien' : 'Categories'}</p>
        {MAINTENANCE_CATEGORY_KEYS.map((key) => {
          const Icon = CATEGORY_ICONS[key];
          const wear = totals[key];
          const colors = getColor(wear);
          const active = clampPct(cats[key]);
          const permPct = clampPct(perm[key]);
          const isSelected = selectedCategory === key;

          const totalDynamicWear = MAINTENANCE_CATEGORY_KEYS.reduce((s, k) => s + clampPct(cats[k]), 0);
          const wearShare = totalDynamicWear > 0 ? active / totalDynamicWear : 0;
          const grossCost = Math.max(0, Math.round(repairBaseTotal * wearShare));
          const insuredCost = Math.round(grossCost * insuranceCovPct);
          const payable = Math.max(0, grossCost - insuredCost);
          const isRepairing = repairMutation.isPending && repairMutation.variables === key;

          return (
            <motion.button
              key={key}
              onClick={() => onSelectCategory(key)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full text-left rounded-lg border backdrop-blur-md transition-all ${
                isSelected
                  ? `${colors.accent} bg-slate-900/80 shadow-lg ${colors.glow}`
                  : 'border-slate-700/40 bg-slate-900/30 hover:bg-slate-900/60 hover:border-slate-600/60'
              }`}
            >
              <div className="px-2.5 py-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${isSelected ? colors.text : 'text-slate-300'}`}>
                    {CATEGORY_LABELS[key][lang]}
                  </span>
                  <span className={`ml-auto text-xs font-black ${colors.text}`}>
                    {Math.round(wear)}%
                  </span>
                </div>
                <div className="relative w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-slate-700/40">
                  <div className="absolute h-full bg-red-500/70" style={{ width: `${permPct}%` }} />
                  <div className={`absolute h-full ${colors.bar}`} style={{ left: `${permPct}%`, width: `${active}%` }} />
                </div>

                {isSelected && grossCost > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 pt-2 border-t border-slate-700/40 space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">{lang === 'de' ? 'Brutto' : 'Gross'}</span>
                        <span className="text-amber-300">${grossCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">{lang === 'de' ? 'Versich.' : 'Insured'}</span>
                        <span className="text-emerald-300">-${insuredCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-cyan-300">{lang === 'de' ? 'Du zahlst' : 'You pay'}</span>
                        <span className="text-cyan-300">${payable.toLocaleString()}</span>
                      </div>
                      {overdraftBlocked ? (
                        <div className="flex items-center gap-1 text-[10px] text-red-300 bg-red-950/40 border border-red-500/30 rounded px-1.5 py-1 mt-1">
                          <Skull className="w-3 h-3" />
                          {lang === 'de' ? 'Dispo gesperrt' : 'Overdraft blocked'}
                        </div>
                      ) : (
                        <Button
                          onClick={(e) => { e.stopPropagation(); repairMutation.mutate(key); }}
                          disabled={isRepairing}
                          size="sm"
                          className={`w-full h-7 mt-1 text-[10px] font-mono uppercase ${colors.bar.replace('bg-', 'bg-').replace('-500', '-600')} hover:opacity-90 text-white`}
                        >
                          <Wrench className="w-3 h-3 mr-1" />
                          {isRepairing ? '...' : (lang === 'de' ? 'Reparieren' : 'Repair')}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}

                {isSelected && grossCost <= 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700/40 text-[10px] text-emerald-400 text-center">
                    ✓ {lang === 'de' ? 'Keine Wartung notwendig' : 'No maintenance needed'}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
