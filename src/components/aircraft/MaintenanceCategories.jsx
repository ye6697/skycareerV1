import React, { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Cog, Gauge, CircuitBoard, Shield, Plane, Zap, Wind, AlertTriangle, Info, Skull } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { isAtOverdraftLimit } from "@/components/InsolvencyBanner";
import { useLanguage } from "@/components/LanguageContext";
import { t as tl } from "@/components/i18n/translations";
import { resolveAircraftInsurance } from "@/lib/insurance";
import { MAINTENANCE_CATEGORY_KEYS, applyPermanentWearIncrease, normalizeMaintenanceCategoryMap, resolvePermanentWearCategories } from "@/lib/maintenance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CATEGORY_META = [
  { key: "engine", icon: Cog, de: "Motor, Turbine, Kraftstoffsystem", en: "Motor, Turbine, Fuel system" },
  { key: "hydraulics", icon: Gauge, de: "Hydraulikpumpen, Leitungen, Ventile", en: "Hydraulic pumps, lines, valves" },
  { key: "avionics", icon: CircuitBoard, de: "Instrumente, Autopilot, Navigation", en: "Instruments, Autopilot, Navigation" },
  { key: "airframe", icon: Shield, de: "Rumpf, Tragflaechen, Leitwerk", en: "Fuselage, Wings, Empennage" },
  { key: "landing_gear", icon: Plane, de: "Raeder, Bremsen, Fahrwerk-Mechanik", en: "Wheels, Brakes, Gear mechanics" },
  { key: "electrical", icon: Zap, de: "Generatoren, Batterien, Beleuchtung", en: "Generators, Batteries, Lighting" },
  { key: "flight_controls", icon: Wind, de: "Querruder, Seitenruder, Hoehenruder", en: "Ailerons, Rudder, Elevator" },
  { key: "pressurization", icon: Shield, de: "Druckregelung, Klimaanlage", en: "Pressure control, Air conditioning" },
];

const CATEGORY_FAILURES = {
  engine: { de: "Leistungsverlust, unruhiger Lauf, Triebwerksausfall", en: "Thrust loss, rough running, engine failure" },
  hydraulics: { de: "Druckverlust, traege Ruder, Bremsprobleme", en: "Pressure loss, sluggish controls, brake issues" },
  avionics: { de: "Display-Ausfall, NAV/COM-Probleme, AP-Ausfall", en: "Display dropouts, NAV/COM issues, AP failure" },
  airframe: { de: "Strukturschaeden, starke Vibrationen", en: "Structural damage, heavy vibration" },
  landing_gear: { de: "Gear jam, Bremsverschleiss, Fahrwerksversagen", en: "Gear jam, brake wear, gear failure" },
  electrical: { de: "Generator-/Batterieprobleme, Elektrik-Ausfall", en: "Generator/battery issues, electrical failure" },
  flight_controls: { de: "Traege Ruder, Trim-/Flap-Probleme", en: "Sluggish controls, trim/flap issues" },
  pressurization: { de: "Cabin pressure warning, Druckverlust", en: "Cabin pressure warning, pressure loss" },
};

function getWearColor(percent) {
  if (percent <= 20) return "text-emerald-400";
  if (percent <= 50) return "text-amber-400";
  if (percent <= 75) return "text-orange-400";
  return "text-red-400";
}

function getProgressColor(percent) {
  if (percent <= 20) return "bg-emerald-500";
  if (percent <= 50) return "bg-amber-500";
  if (percent <= 75) return "bg-orange-500";
  return "bg-red-500";
}

const clampPct = (value) => Math.max(0, Math.min(100, Number(value) || 0));
const FAILURE_TOGGLE_UI_VERSION = 'ft-2026-04-07-e';

export default function MaintenanceCategories({ aircraft }) {
  const [showInfo, setShowInfo] = useState(false);
  const [failureToggleError, setFailureToggleError] = useState('');
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const resolveUserCompanyId = React.useCallback((user) => (
    user?.company_id
    || user?.data?.company_id
    || user?.company?.id
    || user?.data?.company?.id
    || null
  ), []);

  const categories = useMemo(
    () => CATEGORY_META.map((meta) => ({
      ...meta,
      label: tl(meta.key, lang),
      description: lang === 'de' ? meta.de : meta.en,
    })),
    [lang]
  );

  const { data: companyForLimit } = useQuery({
    queryKey: ['company-maint-limit'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = resolveUserCompanyId(user);
      if (cid) {
        const companies = await base44.entities.Company.filter({ id: cid });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0] || null;
    },
    staleTime: 30000,
  });

  const failureTriggerStateKey = useMemo(
    () => ['failure-trigger-state', aircraft?.company_id || companyForLimit?.id || 'unknown'],
    [aircraft?.company_id, companyForLimit?.id]
  );

  const { data: failureTriggerState } = useQuery({
    queryKey: failureTriggerStateKey,
    queryFn: async () => {
      const company = companyForLimit || await loadCurrentCompany();
      const response = await base44.functions.invoke('toggleFailureTriggers', {
        companyId: company?.id || aircraft?.company_id || null,
      });
      if (typeof response?.data?.enabled === 'boolean') return response.data.enabled;
      return null;
    },
    enabled: !!aircraft?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const loadCurrentCompany = async () => {
    if (aircraft?.company_id) {
      const byAircraftCompany = await base44.entities.Company.filter({ id: aircraft.company_id });
      if (byAircraftCompany[0]) return byAircraftCompany[0];
    }
    const user = await base44.auth.me();
    const cid = resolveUserCompanyId(user);
    if (cid) {
      const companies = await base44.entities.Company.filter({ id: cid });
      if (companies[0]) return companies[0];
    }
    if (user?.email) {
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (companies[0]) return companies[0];
    }
    return null;
  };

  const failureTriggersEnabled = (typeof failureTriggerState === 'boolean')
    ? failureTriggerState
    : true;
  const effectiveFailureEnabled = failureTriggersEnabled;

  const toggleFailureTriggersMutation = useMutation({
    onMutate: async (_enabled) => {
      const previous = queryClient.getQueryData(failureTriggerStateKey);
      return { previous };
    },
    mutationFn: async (enabled) => {
      setFailureToggleError('');
      const company = companyForLimit || await loadCurrentCompany();
      const targetEnabled = !!enabled;
      const targetCompanyId = company?.id || aircraft?.company_id || null;

      const response = await Promise.race([
        base44.functions.invoke('toggleFailureTriggers', {
          enabled: targetEnabled,
          companyId: targetCompanyId,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('toggle_timeout')), 12000)),
      ]);
      const invokeError = response?.error || response?.data?.error;
      if (invokeError) {
        throw new Error(
          typeof invokeError === 'string'
            ? invokeError
            : (invokeError?.message || 'toggle_invoke_failed')
        );
      }

      if (typeof response?.data?.enabled === 'boolean') return response.data.enabled;

      const verify = await base44.functions.invoke('toggleFailureTriggers', {
        companyId: targetCompanyId,
      });
      if (typeof verify?.data?.enabled === 'boolean') return verify.data.enabled;
      throw new Error('toggle_unconfirmed');
    },
    onSuccess: (resolvedEnabled) => {
      const enabled = !!resolvedEnabled;
      queryClient.setQueryData(failureTriggerStateKey, enabled);
      queryClient.setQueryData(['company-maint-limit'], (prev) => (
        prev ? { ...prev, failure_triggers_enabled: enabled } : prev
      ));
      queryClient.setQueryData(['company'], (prev) => (
        prev ? { ...prev, failure_triggers_enabled: enabled } : prev
      ));
      queryClient.invalidateQueries({ queryKey: ['company-maint-limit'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: failureTriggerStateKey });
    },
    onError: (_error, _enabled, context) => {
      if (context && Object.prototype.hasOwnProperty.call(context, 'previous')) {
        queryClient.setQueryData(failureTriggerStateKey, context.previous);
      }
      setFailureToggleError(
        lang === 'de'
          ? 'Konnte den Failure-Trigger nicht umschalten. Bitte erneut versuchen.'
          : 'Could not toggle failure trigger. Please try again.'
      );
      queryClient.invalidateQueries({ queryKey: failureTriggerStateKey });
    },
  });

  const overdraftBlocked = isAtOverdraftLimit(companyForLimit);
  const cats = normalizeMaintenanceCategoryMap(aircraft?.maintenance_categories);
  const fallbackPermanentWear = Math.max(0, Math.min(100, Number(aircraft?.used_permanent_avg || 0)));
  const currentPermanentCats = normalizeMaintenanceCategoryMap(aircraft?.permanent_wear_categories, 0);
  const listingPermanentCats = normalizeMaintenanceCategoryMap(aircraft?.used_listing_permanent_wear_categories, 0);
  const hasCurrentPermanentCats = MAINTENANCE_CATEGORY_KEYS.some((key) => Number(currentPermanentCats?.[key] || 0) > 0);
  const hasListingPermanentCats = MAINTENANCE_CATEGORY_KEYS.some((key) => Number(listingPermanentCats?.[key] || 0) > 0);
  const permanentCats = hasCurrentPermanentCats
    ? currentPermanentCats
    : (hasListingPermanentCats
      ? listingPermanentCats
      : resolvePermanentWearCategories(aircraft?.permanent_wear_categories, fallbackPermanentWear));
  const activeInsurance = resolveAircraftInsurance(aircraft);
  const insuranceCoveragePct = Math.max(0, Math.min(1, Number(activeInsurance.maintenanceCoveragePct || 0)));
  const purchasePrice = Math.max(1, Number(aircraft?.purchase_price || aircraft?.current_value || 1));
  const currentValue = Math.max(0, Number(aircraft?.current_value || purchasePrice));
  const rawAccumulatedCost = Math.max(0, Number(aircraft?.accumulated_maintenance_cost || 0));
  // Never let the maintenance backlog exceed aircraft new value.
  const accumulatedCost = Math.min(rawAccumulatedCost, purchasePrice);
  const totalDynamicWear = categories.reduce((sum, c) => sum + clampPct(cats[c.key]), 0);

  const getCategoryCost = (key) => {
    const wear = clampPct(cats[key]);
    if (wear <= 0 || totalDynamicWear <= 0 || accumulatedCost <= 0) return 0;
    const wearShare = wear / totalDynamicWear;
    const grossRaw = accumulatedCost * wearShare;
    const categoryCap = purchasePrice * wearShare;
    return Math.round(Math.min(grossRaw, categoryCap));
  };

  const getCategoryCostSummary = (key) => {
    const gross = Math.max(0, getCategoryCost(key));
    const insuranceCovered = Math.round(gross * insuranceCoveragePct);
    const payable = Math.max(0, gross - insuranceCovered);
    return { gross, insuranceCovered, payable };
  };

  const totalCostSummary = (() => {
    const grossByCategory = categories.reduce((sum, cat) => sum + getCategoryCost(cat.key), 0);
    const gross = Math.max(0, Math.min(Math.round(accumulatedCost), grossByCategory));
    const insuranceCovered = Math.round(gross * insuranceCoveragePct);
    const payable = Math.max(0, gross - insuranceCovered);
    return { gross, insuranceCovered, payable };
  })();

  const getWearSnapshot = (dynamicMap, permanentMap) => {
    const combined = categories.map((cat) => clampPct(dynamicMap[cat.key]) + clampPct(permanentMap[cat.key]));
    const avg = combined.reduce((sum, value) => sum + value, 0) / Math.max(1, combined.length);
    const max = combined.length > 0 ? Math.max(...combined) : 0;
    return { avg, max, needsMaintenance: max > 75 || avg > 50 };
  };

  const wearSnapshot = getWearSnapshot(cats, permanentCats);

  const getCategoryCostExplanation = (category) => {
    const wear = clampPct(cats[category.key]);
    const permanent = clampPct(permanentCats[category.key]);
    const costs = getCategoryCostSummary(category.key);
    const failures = CATEGORY_FAILURES[category.key];
    const wearShare = totalDynamicWear > 0 ? (wear / totalDynamicWear) * 100 : 0;
    const baseText = lang === 'de'
      ? `Pool $${Math.round(accumulatedCost).toLocaleString()} x Anteil ${wearShare.toFixed(1)}%`
      : `Pool $${Math.round(accumulatedCost).toLocaleString()} x share ${wearShare.toFixed(1)}%`;

    return {
      title: lang === 'de' ? 'Live-Kosten und Trigger' : 'Live cost and triggers',
      details: lang === 'de'
        ? `Kategorie: ${category.description}. Aktiver Verschleiss ${wear.toFixed(1)}%, permanenter Verschleiss ${permanent.toFixed(2)}%.`
        : `Category: ${category.description}. Active wear ${wear.toFixed(1)}%, permanent wear ${permanent.toFixed(2)}%.`,
      formula: lang === 'de'
        ? 'Kosten = Wartungspool x (Kategorie-Verschleiss / Summe aktiver Verschleisswerte)'
        : 'Cost = maintenance pool x (category wear / sum of active wear)',
      possibleFailures: `${lang === 'de' ? 'Moegliche Ausfaelle' : 'Possible failures'}: ${lang === 'de' ? failures.de : failures.en}`,
      breakdown: lang === 'de'
        ? `${baseText} | Brutto $${costs.gross.toLocaleString()} | Versicherung -$${costs.insuranceCovered.toLocaleString()} | Du zahlst $${costs.payable.toLocaleString()}`
        : `${baseText} | Gross $${costs.gross.toLocaleString()} | Insurance -$${costs.insuranceCovered.toLocaleString()} | You pay $${costs.payable.toLocaleString()}`,
    };
  };

  const repairCategoryMutation = useMutation({
    mutationFn: async (categoryKey) => {
      const company = await loadCurrentCompany();
      if (!company) throw new Error('Unternehmen nicht gefunden');

      const costSummary = getCategoryCostSummary(categoryKey);
      if (costSummary.gross <= 0) return;

      const valueReduction = costSummary.gross * 0.10;
      const newValue = Math.max(0, currentValue - valueReduction);
      const newCats = { ...cats, [categoryKey]: 0 };
      const repairedWear = clampPct(cats[categoryKey]);
      const newPermanentCats = {
        ...permanentCats,
        [categoryKey]: applyPermanentWearIncrease({
          currentPermanentWear: permanentCats[categoryKey],
          repairedWearPct: repairedWear,
          repairCost: costSummary.gross,
          purchasePrice,
          maxPermanentWear: 45,
        }),
      };
      const newLifetimeMaintCost = Math.max(0, Number(aircraft?.lifetime_maintenance_cost || 0)) + costSummary.gross;
      const newAccumulated = Math.max(0, accumulatedCost - costSummary.gross);
      const nextWearSnapshot = getWearSnapshot(newCats, newPermanentCats);
      const newStatus = newValue <= 0
        ? 'total_loss'
        : (aircraft?.status === 'damaged' ? 'damaged' : (nextWearSnapshot.needsMaintenance ? 'maintenance' : 'available'));

      await base44.entities.Aircraft.update(aircraft.id, {
        maintenance_categories: newCats,
        permanent_wear_categories: newPermanentCats,
        current_value: newValue,
        accumulated_maintenance_cost: newAccumulated,
        lifetime_maintenance_cost: newLifetimeMaintCost,
        status: newStatus,
      });

      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - costSummary.payable });
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'maintenance',
        amount: costSummary.payable,
        description: `Wartung ${categories.find((c) => c.key === categoryKey)?.label || categoryKey}: ${aircraft.name} (Versicherung: -$${Math.round(costSummary.insuranceCovered).toLocaleString()})`,
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  const repairAllMutation = useMutation({
    mutationFn: async () => {
      const company = await loadCurrentCompany();
      if (!company) throw new Error('Unternehmen nicht gefunden');
      if (totalCostSummary.gross <= 0) return;

      const valueReduction = totalCostSummary.gross * 0.10;
      const newValue = Math.max(0, currentValue - valueReduction);
      const newCats = { ...cats };
      const newPermanentCats = { ...permanentCats };
      const fallbackCategoryCost = totalCostSummary.gross / Math.max(1, MAINTENANCE_CATEGORY_KEYS.length);

      MAINTENANCE_CATEGORY_KEYS.forEach((key) => {
        const repairedWear = clampPct(cats[key]);
        const categoryCost = totalDynamicWear > 0
          ? totalCostSummary.gross * (repairedWear / totalDynamicWear)
          : fallbackCategoryCost;
        newCats[key] = 0;
        newPermanentCats[key] = applyPermanentWearIncrease({
          currentPermanentWear: permanentCats[key],
          repairedWearPct: repairedWear,
          repairCost: categoryCost,
          purchasePrice,
          maxPermanentWear: 45,
        });
      });

      const newLifetimeMaintCost = Math.max(0, Number(aircraft?.lifetime_maintenance_cost || 0)) + totalCostSummary.gross;
      const nextWearSnapshot = getWearSnapshot(newCats, newPermanentCats);
      const newStatus = newValue <= 0
        ? 'total_loss'
        : (aircraft?.status === 'damaged' ? 'damaged' : (nextWearSnapshot.needsMaintenance ? 'maintenance' : 'available'));

      await base44.entities.Aircraft.update(aircraft.id, {
        maintenance_categories: newCats,
        permanent_wear_categories: newPermanentCats,
        current_value: newValue,
        accumulated_maintenance_cost: 0,
        lifetime_maintenance_cost: newLifetimeMaintCost,
        status: newStatus,
      });

      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - totalCostSummary.payable });
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'maintenance',
        amount: totalCostSummary.payable,
        description: `Komplettwartung: ${aircraft.name} (Versicherung: -$${Math.round(totalCostSummary.insuranceCovered).toLocaleString()}, Wertminderung: -$${Math.round(valueReduction).toLocaleString()})`,
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-400" />
          {tl('maintenance_status', lang)}
        </h4>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowInfo(true)}>
            <Info className="w-3.5 h-3.5 text-slate-400" />
          </Button>
          {wearSnapshot.needsMaintenance && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {tl('maint_needed', lang)}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-200">
            {lang === 'de' ? 'Failure Trigger (Bridge)' : 'Failure trigger (bridge)'}
          </div>
          <div className="text-[10px] text-cyan-300">Version {FAILURE_TOGGLE_UI_VERSION}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {effectiveFailureEnabled
              ? (lang === 'de' ? 'Aktiv: Bridge kann Ausfaelle ausloesen.' : 'On: bridge may trigger failures.')
              : (lang === 'de' ? 'Aus: Bridge loest keine neuen Ausfaelle aus.' : 'Off: bridge will not trigger new failures.')}
          </div>
        </div>
        <Button
          type="button"
          onClick={() => toggleFailureTriggersMutation.mutate(!effectiveFailureEnabled)}
          disabled={toggleFailureTriggersMutation.isPending}
          className={`h-9 w-full text-[11px] font-semibold touch-manipulation pointer-events-auto ${
            effectiveFailureEnabled
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-emerald-600 text-white hover:bg-emerald-500'
          }`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {toggleFailureTriggersMutation.isPending
            ? (lang === 'de' ? 'Speichere...' : 'Saving...')
            : (effectiveFailureEnabled
              ? (lang === 'de' ? 'FAILURE TRIGGER: EIN - TIPPE ZUM AUSSCHALTEN' : 'FAILURE TRIGGER: ON - TAP TO TURN OFF')
              : (lang === 'de' ? 'FAILURE TRIGGER: AUS - TIPPE ZUM EINSCHALTEN' : 'FAILURE TRIGGER: OFF - TAP TO TURN ON'))}
        </Button>
        {failureToggleError && (
          <div className="text-[11px] text-red-300">{failureToggleError}</div>
        )}
      </div>

      <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">{tl('overall_wear', lang)}</span>
          <span className={getWearColor(wearSnapshot.avg)}>{wearSnapshot.avg.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${getProgressColor(wearSnapshot.avg)}`} style={{ width: `${Math.min(100, wearSnapshot.avg)}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{lang === 'de' ? 'Wartung brutto' : 'Maintenance gross'}</span>
          <span className="text-red-300 font-mono">${Math.round(totalCostSummary.gross).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{lang === 'de' ? 'Versicherung uebernimmt' : 'Insurance covers'}</span>
          <span className="text-emerald-300 font-mono">-${Math.round(totalCostSummary.insuranceCovered).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">{lang === 'de' ? 'Du zahlst' : 'You pay'}</span>
          <span className="text-cyan-300 font-mono">${Math.round(totalCostSummary.payable).toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const activeWear = clampPct(cats[cat.key]);
          const permanentWear = clampPct(permanentCats[cat.key]);
          const totalWear = Math.min(100, activeWear + permanentWear);
          const costSummary = getCategoryCostSummary(cat.key);
          const maintenanceShare = totalCostSummary.gross > 0 ? (costSummary.gross / totalCostSummary.gross) * 100 : 0;
          const permanentWidth = permanentWear > 0 ? Math.max(1, Math.min(100, permanentWear)) : 0;
          const dynamicWidth = activeWear > 0 ? Math.max(1, Math.min(100 - permanentWidth, activeWear)) : 0;
          const info = getCategoryCostExplanation(cat);

          return (
            <div key={cat.key} className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${getWearColor(totalWear)}`} />
                  <span className="text-sm text-slate-200 truncate flex items-center gap-1">
                    <span>{cat.label}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/70 transition-colors"
                          aria-label={lang === 'de' ? `Kostenformel fuer ${cat.label}` : `Cost formula for ${cat.label}`}
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 bg-slate-900 border-slate-700 text-slate-200 p-3" align="start">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-semibold text-white">{info.title}</p>
                          <p className="text-slate-300">{info.details}</p>
                          <p className="text-slate-400">{info.formula}</p>
                          <p className="text-rose-300">{info.possibleFailures}</p>
                          <p className="text-amber-300 font-mono">{info.breakdown}</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-mono ${getWearColor(totalWear)}`}>{totalWear.toFixed(1)}%</div>
                  <div className="text-[11px] text-orange-300 font-mono">
                    {lang === 'de' ? 'Aktiv' : 'Active'} {activeWear.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-red-400 font-mono">
                    {lang === 'de' ? 'Permanent' : 'Permanent'} {permanentWear.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">
                    ${Math.round(costSummary.payable).toLocaleString()}
                    <span className="text-emerald-300"> (-${Math.round(costSummary.insuranceCovered).toLocaleString()})</span>
                    <span className="text-amber-300"> | {maintenanceShare.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="relative w-full bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="absolute left-0 top-0 h-1.5 bg-red-500 transition-all" style={{ width: `${permanentWidth}%` }} />
                <div className={`absolute top-0 h-1.5 transition-all ${getProgressColor(activeWear)}`} style={{ left: `${permanentWidth}%`, width: `${dynamicWidth}%` }} />
              </div>
              {permanentWear > 0 && (
                <div className="mt-1 text-[10px] text-red-400">
                  {lang === 'de' ? 'Permanenter Verschleiss bleibt nach Wartung bestehen.' : 'Permanent wear remains after maintenance.'}
                </div>
              )}
              {costSummary.gross > 0 && (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs bg-amber-600 hover:bg-amber-700 shrink-0"
                    onClick={() => repairCategoryMutation.mutate(cat.key)}
                    disabled={repairCategoryMutation.isPending || overdraftBlocked}
                  >
                    ${costSummary.payable.toLocaleString()}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {overdraftBlocked && totalCostSummary.payable > 0 && (
        <div className="p-2 bg-red-950/50 border border-red-700/50 rounded flex items-center gap-2">
          <Skull className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">
            {lang === 'de' ? 'Dispo-Limit erreicht - Wartung nicht moeglich!' : 'Overdraft limit reached - maintenance blocked!'}
          </p>
        </div>
      )}

      {totalCostSummary.gross > 0 && (
        <Button
          className={`w-full ${wearSnapshot.needsMaintenance ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          size="sm"
          onClick={() => repairAllMutation.mutate()}
          disabled={repairAllMutation.isPending || overdraftBlocked}
        >
          <Wrench className="w-4 h-4 mr-1" />
          {repairAllMutation.isPending ? tl('waiting', lang) : `${tl('repair_all', lang)} ($${totalCostSummary.payable.toLocaleString()})`}
          {wearSnapshot.needsMaintenance && ` - ${tl('required_excl', lang)}`}
        </Button>
      )}

      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-white">{tl('maint_system_title', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-300 px-4 pb-4 max-h-[70dvh] overflow-y-auto overscroll-contain touch-pan-y">
            <div>
              <h5 className="font-semibold text-white mb-1">{lang === 'de' ? 'Verschleiss-Kategorien' : 'Wear categories'}</h5>
              <p>{tl('maint_cat_desc', lang)}</p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">{tl('maint_failures', lang)}</h5>
              <p>{tl('maint_failures_desc', lang)}</p>
              <ul className="list-disc ml-4 mt-1 space-y-1 text-slate-400">
                {lang === 'de' ? (
                  <>
                    <li><span className="text-emerald-400">0-20%</span>: Kaum Ausfaelle</li>
                    <li><span className="text-amber-400">20-50%</span>: Gelegentlich leichte Ausfaelle</li>
                    <li><span className="text-orange-400">50-75%</span>: Haeufigere Ausfaelle, auch mittelstark</li>
                    <li><span className="text-red-400">75-100%</span>: Haeufige schwere Ausfaelle</li>
                  </>
                ) : (
                  <>
                    <li><span className="text-emerald-400">0-20%</span>: Rare failures</li>
                    <li><span className="text-amber-400">20-50%</span>: Occasional minor failures</li>
                    <li><span className="text-orange-400">50-75%</span>: More frequent, moderate failures</li>
                    <li><span className="text-red-400">75-100%</span>: Frequent severe failures</li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">{lang === 'de' ? 'Wertverlust' : 'Depreciation'}</h5>
              <p>
                {lang === 'de'
                  ? 'Wartung reduziert kurzfristigen Verschleiss, aber hinterlaesst permanenten Verschleiss. Dauerhafte Reparaturen druecken langfristig auch den Flugzeugwert.'
                  : 'Maintenance reduces active wear, but leaves permanent wear. Repeated repairs also reduce long-term aircraft value.'}
              </p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">{lang === 'de' ? 'Versicherung bei Wartung' : 'Insurance in maintenance'}</h5>
              <p>
                {lang === 'de'
                  ? 'Die Tabelle zeigt fuer jede Kategorie Bruttokosten, Versicherungsanteil und deinen Eigenanteil. Abgerechnet wird nur der Eigenanteil.'
                  : 'The table shows gross cost, insurance share, and your payable share for each category. Only your payable share is charged.'}
              </p>
            </div>
            <div>
              <h5 className="font-semibold text-amber-400 mb-1">! {tl('maint_mandatory', lang)}</h5>
              <p>{tl('maint_mandatory_desc', lang)}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
