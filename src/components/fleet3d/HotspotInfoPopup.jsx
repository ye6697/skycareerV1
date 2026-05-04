import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Wrench, X, AlertTriangle, Cog, Gauge, CircuitBoard, Shield, Plane, Zap, Wind, Skull } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { MAINTENANCE_CATEGORY_KEYS, normalizeMaintenanceCategoryMap, resolvePermanentWearCategories, applyPermanentWearIncrease } from '@/lib/maintenance';
import { resolveAircraftInsurance } from '@/lib/insurance';
import { isAtOverdraftLimit } from '@/components/InsolvencyBanner';

const CATEGORY_ICONS = {
  engine: Cog, hydraulics: Gauge, avionics: CircuitBoard, airframe: Shield,
  landing_gear: Plane, electrical: Zap, flight_controls: Wind, pressurization: Shield,
};

const CATEGORY_LABELS = {
  engine: { en: 'Engines', de: 'Triebwerke' },
  hydraulics: { en: 'Hydraulics', de: 'Hydraulik' },
  avionics: { en: 'Avionics / Cockpit', de: 'Avionik / Cockpit' },
  airframe: { en: 'Airframe', de: 'Zelle / Struktur' },
  landing_gear: { en: 'Landing Gear', de: 'Fahrwerk' },
  electrical: { en: 'Electrical', de: 'Elektrik' },
  flight_controls: { en: 'Flight Controls', de: 'Flugsteuerung' },
  pressurization: { en: 'Pressurization', de: 'Druckkabine' },
};

const CATEGORY_FAILURES = {
  engine: { en: 'Thrust loss, rough running, engine failure', de: 'Leistungsverlust, unruhiger Lauf, Triebwerksausfall' },
  hydraulics: { en: 'Pressure loss, sluggish controls, brake issues', de: 'Druckverlust, traege Ruder, Bremsprobleme' },
  avionics: { en: 'Display dropouts, NAV/COM issues, AP failure', de: 'Display-Ausfall, NAV/COM-Probleme, AP-Ausfall' },
  airframe: { en: 'Structural damage, heavy vibration', de: 'Strukturschaeden, starke Vibrationen' },
  landing_gear: { en: 'Gear jam, brake wear, gear failure', de: 'Gear jam, Bremsverschleiss, Fahrwerksversagen' },
  electrical: { en: 'Generator/battery issues, electrical failure', de: 'Generator-/Batterieprobleme, Elektrik-Ausfall' },
  flight_controls: { en: 'Sluggish controls, trim/flap issues', de: 'Traege Ruder, Trim-/Flap-Probleme' },
  pressurization: { en: 'Cabin pressure warning, pressure loss', de: 'Cabin pressure warning, Druckverlust' },
};

function getColor(p) {
  if (p <= 20) return { text: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', bar: 'bg-emerald-500' };
  if (p <= 50) return { text: 'text-amber-400', bg: 'bg-amber-950/60', border: 'border-amber-500/40', bar: 'bg-amber-500' };
  if (p <= 75) return { text: 'text-orange-400', bg: 'bg-orange-950/60', border: 'border-orange-500/40', bar: 'bg-orange-500' };
  return { text: 'text-red-400', bg: 'bg-red-950/60', border: 'border-red-500/40', bar: 'bg-red-500' };
}

const clampPct = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const roundMoney = (v) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
const formatMoney = (v) => roundMoney(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HotspotInfoPopup({ aircraft, categoryKey, onClose, screenPos }) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const Icon = CATEGORY_ICONS[categoryKey] || Wrench;

  const cats = normalizeMaintenanceCategoryMap(aircraft?.maintenance_categories);
  const fallback = clampPct(aircraft?.used_permanent_avg);
  const perm = resolvePermanentWearCategories(aircraft?.permanent_wear_categories, fallback);
  const activeWear = clampPct(cats[categoryKey]);
  const permanentWear = clampPct(perm[categoryKey]);
  const totalWear = Math.min(100, activeWear + permanentWear);
  const colors = getColor(totalWear);

  const { data: companyForLimit } = useQuery({
    queryKey: ['company-hotspot-limit'],
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

  const insurance = resolveAircraftInsurance(aircraft);
  const insuranceCovPct = Math.max(0, Math.min(1, Number(insurance.maintenanceCoveragePct || 0)));
  const purchasePrice = Math.max(1, Number(aircraft?.purchase_price || aircraft?.current_value || 1));
  const accumulated = Math.min(Math.max(0, Number(aircraft?.accumulated_maintenance_cost || 0)), purchasePrice);
  const totalDynamicWear = MAINTENANCE_CATEGORY_KEYS.reduce((s, k) => s + clampPct(cats[k]), 0);
  const wearShare = totalDynamicWear > 0 ? activeWear / totalDynamicWear : 0;
  const grossCost = roundMoney(accumulated * wearShare);
  const insuredCost = roundMoney(grossCost * insuranceCovPct);
  const payable = roundMoney(grossCost - insuredCost);

  const repairMutation = useMutation({
    mutationFn: async () => {
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
      if (grossCost <= 0) return;

      const valueReduction = grossCost * 0.10;
      const currentValue = Math.max(0, Number(aircraft?.current_value || purchasePrice));
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
      onClose?.();
    },
  });

  // Position popup near the click but clamp inside the viewer bounds so it
  // never overflows offscreen. We read the parent container's size via ref.
  const popupRef = React.useRef(null);
  const [style, setStyle] = React.useState({ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' });
  React.useLayoutEffect(() => {
    if (!screenPos || !popupRef.current) return;
    const parent = popupRef.current.offsetParent;
    if (!parent) return;
    const pW = parent.clientWidth;
    const pH = parent.clientHeight;
    const w = popupRef.current.offsetWidth || 280;
    const h = popupRef.current.offsetHeight || 260;
    const margin = 8;
    // Prefer to the right of the click; if it would overflow, place it left.
    let left = screenPos.x + 24;
    if (left + w > pW - margin) left = screenPos.x - w - 24;
    left = Math.max(margin, Math.min(pW - w - margin, left));
    let top = screenPos.y - h / 2;
    top = Math.max(margin, Math.min(pH - h - margin, top));
    setStyle({ left: `${left}px`, top: `${top}px` });
  }, [screenPos, categoryKey]);

  return (
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`absolute z-50 w-[280px] max-w-[calc(100%-16px)] rounded-lg border ${colors.border} bg-slate-950/95 backdrop-blur-md shadow-2xl`}
      style={style}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${colors.border} ${colors.bg}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colors.text}`} />
          <span className={`font-mono text-xs font-bold uppercase ${colors.text}`}>
            {CATEGORY_LABELS[categoryKey][lang] || CATEGORY_LABELS[categoryKey].en}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2.5 font-mono">
        {/* Wear bars */}
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400 uppercase">{lang === 'de' ? 'Verschleiss' : 'Wear'}</span>
            <span className={`font-bold ${colors.text}`}>{Math.round(totalWear)}%</span>
          </div>
          <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="absolute h-full bg-red-500/90" style={{ width: `${permanentWear}%` }} />
            <div className={`absolute h-full ${colors.bar}`} style={{ left: `${permanentWear}%`, width: `${activeWear}%` }} />
          </div>
          <div className="flex justify-between text-[9px] mt-1">
            <span className="text-orange-300">{lang === 'de' ? 'Aktiv' : 'Active'}: {activeWear.toFixed(1)}%</span>
            <span className="text-red-400">{lang === 'de' ? 'Permanent' : 'Permanent'}: {permanentWear.toFixed(1)}%</span>
          </div>
        </div>

        {/* Status */}
        {totalWear > 75 && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-950/40 border border-red-500/30 rounded px-2 py-1">
            <AlertTriangle className="w-3 h-3 animate-pulse" />
            {lang === 'de' ? 'Wartung dringend!' : 'Maintenance urgent!'}
          </div>
        )}

        {/* Possible failures */}
        <div className="text-[10px] text-slate-400 bg-slate-900/60 rounded p-2 border border-slate-800">
          <div className="text-slate-500 uppercase text-[9px] mb-0.5">{lang === 'de' ? 'Moegliche Ausfaelle' : 'Possible failures'}</div>
          <div className="text-slate-300">{CATEGORY_FAILURES[categoryKey]?.[lang] || CATEGORY_FAILURES[categoryKey]?.en}</div>
        </div>

        {/* Cost breakdown */}
        {grossCost > 0 ? (
          <div className="space-y-1 text-[10px] bg-slate-900/60 rounded p-2 border border-slate-800">
            <div className="flex justify-between"><span className="text-slate-500">{lang === 'de' ? 'Brutto' : 'Gross'}</span><span className="text-amber-300">${formatMoney(grossCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{lang === 'de' ? 'Versicherung' : 'Insurance'}</span><span className="text-emerald-300">-${formatMoney(insuredCost)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 font-bold"><span className="text-slate-300">{lang === 'de' ? 'Du zahlst' : 'You pay'}</span><span className="text-cyan-300">${formatMoney(payable)}</span></div>
          </div>
        ) : (
          <div className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded p-2 text-center">
            {lang === 'de' ? '✓ Keine Wartung notwendig' : '✓ No maintenance needed'}
          </div>
        )}

        {/* Insolvency block */}
        {grossCost > 0 && overdraftBlocked && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-300 bg-red-950/60 border border-red-500/40 rounded px-2 py-1.5">
            <Skull className="w-3 h-3 shrink-0" />
            {lang === 'de' ? 'Dispo-Limit erreicht – Wartung gesperrt!' : 'Overdraft limit – maintenance blocked!'}
          </div>
        )}

        {/* Repair button */}
        {grossCost > 0 && (
          <Button
            onClick={() => repairMutation.mutate()}
            disabled={repairMutation.isPending || overdraftBlocked}
            className={`w-full h-8 text-[11px] font-mono uppercase ${colors.text.replace('text-', 'bg-').replace('-400', '-600')} hover:opacity-90 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Wrench className="w-3 h-3 mr-1.5" />
            {repairMutation.isPending
              ? (lang === 'de' ? 'Reparatur laeuft...' : 'Repairing...')
              : (lang === 'de' ? `Reparieren $${formatMoney(payable)}` : `Repair $${formatMoney(payable)}`)}
          </Button>
        )}
      </div>
    </motion.div>
  );
}