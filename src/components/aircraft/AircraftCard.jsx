import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Plane, 
  Users, 
  Package, 
  Fuel,
  Clock,
  Wrench,
  DollarSign,
  AlertTriangle,
  Hammer,
  Trash2,
  Shield
} from "lucide-react";
import MaintenanceCategories from "./MaintenanceCategories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import { calculateInsuranceForFlight, DEFAULT_INSURANCE_PLAN, getInsurancePlanConfig, INSURANCE_PACKAGES, resolveAircraftInsurance } from '@/lib/insurance';

export default function AircraftCard({ aircraft, onSelect, onMaintenance, onView }) {
  const [isRepairDialogOpen, setIsRepairDialogOpen] = React.useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = React.useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = React.useState(false);
  const [isInsuranceDialogOpen, setIsInsuranceDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const [selectedInsurancePlan, setSelectedInsurancePlan] = useState(aircraft.insurance_plan || DEFAULT_INSURANCE_PLAN);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: company } = useQuery({
    queryKey: ['company', currentUser?.company_id],
    queryFn: async () => {
      if (currentUser?.company_id) {
        const companies = await base44.entities.Company.filter({ id: currentUser.company_id });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: currentUser.email });
      return companies[0];
    },
    enabled: !!currentUser,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  const typeConfig = {
    small_prop: { label: t('small_prop_label', lang), icon: "🛩️" },
    turboprop: { label: t('turboprop_label', lang), icon: "✈️" },
    regional_jet: { label: t('regional_jet_label', lang), icon: "🛫" },
    narrow_body: { label: t('narrow_body_label', lang), icon: "✈️" },
    wide_body: { label: t('wide_body_label', lang), icon: "🛬" },
    cargo: { label: t('cargo_label', lang), icon: "📦" }
  };

  const statusConfig = {
    available: { label: t('available', lang), color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    in_flight: { label: t('in_flight', lang), color: "bg-blue-100 text-blue-700 border-blue-200" },
    maintenance: { label: t('maintenance', lang), color: "bg-amber-100 text-amber-700 border-amber-200" },
    damaged: { label: t('damaged', lang), color: "bg-red-100 text-red-700 border-red-200" },
    total_loss: { label: t('total_loss', lang), color: "bg-red-200 text-red-800 border-red-300" },
    sold: { label: t('sold', lang), color: "bg-slate-100 text-slate-600 border-slate-200" }
  };

  const repairCost = aircraft.accumulated_maintenance_cost || 0;
  const scrapValue = (aircraft.current_value || aircraft.purchase_price || 0) * 0.10;
  const rawCurrentValue = aircraft.current_value || aircraft.purchase_price || 0;
  const accumulatedMaintCost = aircraft.accumulated_maintenance_cost || 0;
  // Temporär Wartungskosten vom Wert abziehen (bis gewartet)
  const currentValue = Math.max(0, rawCurrentValue - accumulatedMaintCost);
  
  // New category-based maintenance check
  const cats = aircraft.maintenance_categories || {};
  const permanentCats = aircraft.permanent_wear_categories || {};
  const catValues = [
    (cats.engine || 0) + (permanentCats.engine || 0), (cats.hydraulics || 0) + (permanentCats.hydraulics || 0), (cats.avionics || 0) + (permanentCats.avionics || 0),
    (cats.airframe || 0) + (permanentCats.airframe || 0), (cats.landing_gear || 0) + (permanentCats.landing_gear || 0), (cats.electrical || 0) + (permanentCats.electrical || 0),
    (cats.flight_controls || 0) + (permanentCats.flight_controls || 0), (cats.pressurization || 0) + (permanentCats.pressurization || 0)
  ];
  const avgWear = catValues.reduce((a, b) => a + b, 0) / catValues.length;
  const maxWear = Math.max(...catValues);
  const maxPermanentWear = Math.max(
    permanentCats.engine || 0,
    permanentCats.hydraulics || 0,
    permanentCats.avionics || 0,
    permanentCats.airframe || 0,
    permanentCats.landing_gear || 0,
    permanentCats.electrical || 0,
    permanentCats.flight_controls || 0,
    permanentCats.pressurization || 0
  );
  const needsMaintenance = maxWear > 75 || avgWear > 50;

  const repairMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      const company = companies[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      const repairPrice = accumulatedMaintCost;
      if (repairPrice <= 0) return;
      
      // 10% permanent value reduction of paid repair amount
      const valueReduction = repairPrice * 0.10;
      const newValue = Math.max(0, rawCurrentValue - valueReduction);
      
      const newStatus = newValue <= 0 ? 'total_loss' : 'available';
      const newLifetimeMaintCost = Math.max(0, Number(aircraft.lifetime_maintenance_cost || 0)) + repairPrice;
      const permanentWearValue = Math.max(0, Math.min(100, 100 / Math.max(1, newLifetimeMaintCost)));
      
      // Reset all maintenance categories
      const newCats = {};
      const newPermanentCats = {};
      ['engine','hydraulics','avionics','airframe','landing_gear','electrical','flight_controls','pressurization'].forEach(c => { newCats[c] = 0; });
      ['engine','hydraulics','avionics','airframe','landing_gear','electrical','flight_controls','pressurization'].forEach(c => { newPermanentCats[c] = permanentWearValue; });
      
      await base44.entities.Aircraft.update(aircraft.id, { 
        status: newStatus,
        accumulated_maintenance_cost: 0,
        maintenance_categories: newCats,
        permanent_wear_categories: newPermanentCats,
        lifetime_maintenance_cost: newLifetimeMaintCost,
        current_value: newValue
      });
      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - repairPrice });
      
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'maintenance',
        amount: repairPrice,
        description: `Reparatur: ${aircraft.name} (10% Wertminderung: -$${Math.round(valueReduction).toLocaleString()})`,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setIsRepairDialogOpen(false);
    }
  });

  const scrapMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      const company = companies[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      await base44.entities.Aircraft.update(aircraft.id, { status: 'sold' });
      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) + scrapValue });
      
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'income',
        category: 'aircraft_sale',
        amount: scrapValue,
        description: `Verschrottung: ${aircraft.name}`,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setIsRepairDialogOpen(false);
    }
  });

  const sellPrice = (aircraft.current_value || aircraft.purchase_price || 0) * 0.85;

  const sellMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      const company = companies[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      await base44.entities.Aircraft.update(aircraft.id, { status: 'sold' });
      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) + sellPrice });
      
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'income',
        category: 'aircraft_sale',
        amount: sellPrice,
        description: `Verkauf: ${aircraft.name}`,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setIsSellDialogOpen(false);
    }
  });

  const insuranceMutation = useMutation({
    mutationFn: async (planKey) => {
      const config = getInsurancePlanConfig(planKey);
      await base44.entities.Aircraft.update(aircraft.id, {
        insurance_plan: config.key,
        insurance_hourly_rate_pct: config.hourlyRatePctOfNewValue,
        insurance_maintenance_coverage_pct: config.maintenanceCoveragePct,
        insurance_score_bonus_pct: config.scoreBonusPct,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      setIsInsuranceDialogOpen(false);
    }
  });

  // Legacy performMaintenanceMutation removed - now handled by MaintenanceCategories component

  const type = typeConfig[aircraft.type] || typeConfig.small_prop;
  const activeInsurance = resolveAircraftInsurance(aircraft);
  const insurancePreview = calculateInsuranceForFlight({
    aircraft,
    flightHours: 1,
    maintenanceCost: accumulatedMaintCost,
    companyReputation: company?.reputation || 50,
    baseScore: 100,
  });
  const displayStatus = (aircraft.status === 'available' && needsMaintenance) 
    ? { label: t('maintenance_required', lang), color: "bg-orange-100 text-orange-700 border-orange-200" }
    : (statusConfig[aircraft.status] || statusConfig.available);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
      <Card className="bg-slate-900/90 border-cyan-900/40 flex flex-col text-xs font-mono overflow-hidden hover:border-cyan-500/60 transition-colors shadow-lg">
        {/* Header bar */}
        <div className="flex items-center justify-between p-1.5 border-b border-cyan-900/30 bg-slate-950/60">
          <div className="flex flex-col">
            <span className="text-cyan-400 font-bold text-sm tracking-wide">{aircraft.registration}</span>
            <span className="text-cyan-700/80 text-[9px] uppercase truncate max-w-[100px] leading-tight">{aircraft.name}</span>
          </div>
          <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${displayStatus.color}`}>
            {displayStatus.label}
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="p-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9px] text-slate-400 bg-gradient-to-b from-transparent to-slate-950/30">
          <div className="flex justify-between items-center bg-slate-950/50 px-1 rounded">
            <span className="text-slate-600">PAX</span>
            <span className="text-cyan-100">{aircraft.passenger_capacity || 0}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-950/50 px-1 rounded">
            <span className="text-slate-600">CGO</span>
            <span className="text-cyan-100">{(aircraft.cargo_capacity_kg/1000).toFixed(1)}t</span>
          </div>
          <div className="flex justify-between items-center bg-slate-950/50 px-1 rounded">
            <span className="text-slate-600">HRS</span>
            <span className="text-amber-100">{aircraft.total_flight_hours?.toLocaleString() || 0}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-950/50 px-1 rounded">
            <span className="text-slate-600">VAL</span>
            <span className={currentValue < (aircraft.purchase_price || 0) * 0.5 ? 'text-red-400' : 'text-emerald-400'}>
              ${(currentValue/1000000).toFixed(1)}M
            </span>
          </div>
        </div>

        {/* Maintenance Bar */}
        <div className="px-2 pb-2">
          <div className="flex justify-between text-[8px] mb-0.5">
            <span className="text-slate-600">WEAR MAX</span>
            <span className={needsMaintenance ? 'text-red-400 font-bold' : 'text-emerald-500'}>{Math.round(maxWear)}%</span>
          </div>
          <div className="relative w-full bg-slate-950 rounded-full h-1 border border-slate-800 overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-red-500/90" style={{ width: `${Math.min(100, maxPermanentWear)}%` }} />
            <div
              className={`absolute top-0 h-full ${needsMaintenance ? 'bg-orange-400 shadow-[0_0_5px_#fb923c]' : 'bg-emerald-500'}`}
              style={{
                left: `${Math.min(100, maxPermanentWear)}%`,
                width: `${Math.min(100 - Math.min(100, maxPermanentWear), Math.max(0, maxWear - maxPermanentWear))}%`
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex p-1 gap-1 border-t border-cyan-900/30 bg-slate-950/80 mt-auto">
           {aircraft.status === "total_loss" ? (
               <Button size="sm" className="h-6 flex-1 text-[9px] bg-red-900/40 text-red-400 hover:bg-red-800 border border-red-900/50" onClick={() => scrapMutation.mutate()} disabled={scrapMutation.isPending}>
                 {t('scrap', lang).toUpperCase()}
               </Button>
           ) : aircraft.status === "damaged" ? (
               <>
                 <Button size="sm" className="h-6 flex-1 text-[9px] bg-amber-900/40 text-amber-400 hover:bg-amber-800 border border-amber-900/50" onClick={() => setIsRepairDialogOpen(true)}>
                   {t('repair', lang).toUpperCase()}
                 </Button>
                 <Button size="sm" className="h-6 flex-1 text-[9px] bg-red-900/40 text-red-400 hover:bg-red-800 border border-red-900/50" onClick={() => scrapMutation.mutate()} disabled={scrapMutation.isPending}>
                   {t('dispose', lang).toUpperCase()}
                 </Button>
               </>
           ) : (aircraft.status === "available" || aircraft.status === "maintenance") ? (
               <>
                 <Button size="sm" className="h-6 flex-1 text-[9px] bg-amber-900/40 text-amber-400 hover:bg-amber-800 border border-amber-900/50" onClick={() => setIsMaintenanceDialogOpen(true)}>
                   {t('maintenance', lang).toUpperCase()}
                 </Button>
                 <Button size="sm" className="h-6 flex-1 text-[9px] bg-cyan-900/40 text-cyan-300 hover:bg-cyan-800 border border-cyan-900/50" onClick={() => setIsInsuranceDialogOpen(true)}>
                   {lang === 'de' ? 'VERSICHERUNG' : 'INSURANCE'}
                 </Button>
                 <Button size="sm" className="h-6 flex-1 text-[9px] bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700" onClick={() => setIsSellDialogOpen(true)}>
                   {t('sell', lang).toUpperCase()}
                 </Button>
               </>
           ) : (
               <div className="h-6 flex-1 flex items-center justify-center text-[9px] text-cyan-600 uppercase">
                 {displayStatus.label}
               </div>
           )}
        </div>

        {/* Dialogs */}
        <Dialog open={isRepairDialogOpen} onOpenChange={setIsRepairDialogOpen}>
          <DialogContent className="bg-slate-900 border-cyan-900/50 text-slate-300 font-mono text-xs max-w-sm">
            <DialogHeader><DialogTitle className="text-amber-400 uppercase">{t('repair_or_dispose', lang)}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded">
                <div className="flex justify-between mb-1"><span className="text-slate-500">REPAIR COST</span><span className="text-amber-400">${Math.round(repairCost).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">SCRAP VALUE</span><span className="text-emerald-400">${Math.round(scrapValue).toLocaleString()}</span></div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button onClick={() => repairMutation.mutate()} disabled={repairMutation.isPending} className="h-8 text-[10px] bg-amber-900/50 text-amber-400 hover:bg-amber-800 border border-amber-900">{t('repair', lang).toUpperCase()}</Button>
              <Button onClick={() => scrapMutation.mutate()} disabled={scrapMutation.isPending} className="h-8 text-[10px] bg-red-900/50 text-red-400 hover:bg-red-800 border border-red-900">{t('dispose', lang).toUpperCase()}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
          <DialogContent className="bg-slate-900 border-cyan-900/50 text-slate-300 font-mono text-xs max-w-sm">
            <DialogHeader><DialogTitle className="text-emerald-400 uppercase">{t('sell_aircraft', lang)}</DialogTitle></DialogHeader>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded mb-2">
              <div className="flex justify-between"><span className="text-slate-500">PRICE</span><span className="text-emerald-400 font-bold">${Math.round(sellPrice).toLocaleString()}</span></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSellDialogOpen(false)} className="h-8 text-[10px] border-slate-700 text-slate-400">CANCEL</Button>
              <Button onClick={() => sellMutation.mutate()} disabled={sellMutation.isPending} className="h-8 text-[10px] bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800 border border-emerald-900">{t('sell', lang).toUpperCase()}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
          <DialogContent className="bg-slate-900 border-cyan-900/50 text-slate-300 max-w-md">
            <DialogHeader><DialogTitle className="text-amber-400 uppercase">{t('maintenance', lang)} - {aircraft.registration}</DialogTitle></DialogHeader>
            <MaintenanceCategories aircraft={aircraft} />
          </DialogContent>
        </Dialog>

        <Dialog open={isInsuranceDialogOpen} onOpenChange={setIsInsuranceDialogOpen}>
          <DialogContent className="bg-slate-900 border-cyan-900/50 text-slate-300 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-cyan-300 uppercase flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {lang === 'de' ? 'Flugzeug-Versicherung' : 'Aircraft Insurance'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded border border-cyan-900/40 bg-slate-950/70 text-xs">
                <p className="text-slate-200 mb-2">
                  {lang === 'de'
                    ? 'Die Versicherungsgebuehren werden pro Flugstunde berechnet und basieren auf dem Neuwert des Flugzeugs. Eine niedrige Unternehmens-Reputation macht die Gebuehren deutlich teurer. Das gilt auch nach Abschluss dynamisch bei jeder Reputationsaenderung.'
                    : 'Insurance fees are charged per flight hour and based on aircraft new value. Lower company reputation makes fees much more expensive, and this updates dynamically after purchase whenever reputation changes.'}
                </p>
                <p className="text-cyan-300">
                  {lang === 'de' ? 'Aktueller Faktor durch Reputation' : 'Current reputation factor'}:{' '}
                  <strong>{insurancePreview.reputationFactor.toFixed(2)}x</strong> ({lang === 'de' ? 'Reputation' : 'Reputation'}: {Math.round(company?.reputation || 50)})
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.values(INSURANCE_PACKAGES).map((pkg) => {
                  const selected = selectedInsurancePlan === pkg.key;
                  const estimatedHourly = (aircraft.purchase_price || 0) * pkg.hourlyRatePctOfNewValue * insurancePreview.reputationFactor;
                  return (
                    <button
                      key={pkg.key}
                      type="button"
                      onClick={() => setSelectedInsurancePlan(pkg.key)}
                      className={`text-left p-3 rounded border transition ${selected ? 'border-cyan-400 bg-cyan-950/30' : 'border-slate-700 bg-slate-950/50 hover:border-cyan-800'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-100">{pkg.name[lang] || pkg.name.en}</span>
                        {activeInsurance.planKey === pkg.key && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300">
                            {lang === 'de' ? 'Aktiv' : 'Active'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2">{pkg.description[lang] || pkg.description.en}</p>
                      <div className="space-y-1 text-[11px]">
                        <div>{lang === 'de' ? 'Gebuehren pro Flugstunde' : 'Fees per flight hour'}: <span className="text-cyan-300 font-semibold">${Math.round(estimatedHourly).toLocaleString()}</span></div>
                        <div>{lang === 'de' ? 'Wartungsschaden gedeckt' : 'Maintenance damage covered'}: <span className="text-emerald-300 font-semibold">{Math.round(pkg.maintenanceCoveragePct * 100)}%</span></div>
                        <div>{lang === 'de' ? 'Score-Bonus pro Flug' : 'Score bonus per flight'}: <span className="text-amber-300 font-semibold">+{Math.round(pkg.scoreBonusPct * 100)}%</span></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInsuranceDialogOpen(false)} className="h-8 text-[10px] border-slate-700 text-slate-300">
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </Button>
              <Button
                onClick={() => insuranceMutation.mutate(selectedInsurancePlan)}
                disabled={insuranceMutation.isPending}
                className="h-8 text-[10px] bg-cyan-900/50 text-cyan-200 hover:bg-cyan-800 border border-cyan-800"
              >
                {insuranceMutation.isPending
                  ? (lang === 'de' ? 'Speichern...' : 'Saving...')
                  : (lang === 'de' ? 'Paket speichern' : 'Save package')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </motion.div>
  );
}
