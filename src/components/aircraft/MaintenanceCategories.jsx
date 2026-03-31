import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wrench, Cog, Gauge, CircuitBoard, Shield, Plane, Zap, Wind, AlertTriangle, Info, Skull } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { isAtOverdraftLimit } from "@/components/InsolvencyBanner";
import { useLanguage } from "@/components/LanguageContext";
import { t as tl } from "@/components/i18n/translations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function getCategories(lang) {
  const tFn = (k) => tl(k, lang);
  return [
    { key: "engine", label: tFn('engine'), icon: Cog, description: lang === 'de' ? "Motor, Turbine, Kraftstoffsystem" : "Motor, Turbine, Fuel system" },
    { key: "hydraulics", label: tFn('hydraulics'), icon: Gauge, description: lang === 'de' ? "Hydraulikpumpen, Leitungen, Ventile" : "Hydraulic pumps, lines, valves" },
    { key: "avionics", label: tFn('avionics'), icon: CircuitBoard, description: lang === 'de' ? "Instrumente, Autopilot, Navigation" : "Instruments, Autopilot, Navigation" },
    { key: "airframe", label: tFn('airframe'), icon: Shield, description: lang === 'de' ? "Rumpf, Tragflächen, Leitwerk" : "Fuselage, Wings, Empennage" },
    { key: "landing_gear", label: tFn('landing_gear'), icon: Plane, description: lang === 'de' ? "Räder, Bremsen, Fahrwerk-Mechanik" : "Wheels, Brakes, Gear mechanics" },
    { key: "electrical", label: tFn('electrical'), icon: Zap, description: lang === 'de' ? "Generatoren, Batterien, Beleuchtung" : "Generators, Batteries, Lighting" },
    { key: "flight_controls", label: tFn('flight_controls'), icon: Wind, description: lang === 'de' ? "Querruder, Seitenruder, Höhenruder" : "Ailerons, Rudder, Elevator" },
    { key: "pressurization", label: tFn('pressurization'), icon: Shield, description: lang === 'de' ? "Druckregelung, Klimaanlage" : "Pressure control, Air conditioning" },
  ];
}

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

export default function MaintenanceCategories({ aircraft }) {
  const [showInfo, setShowInfo] = useState(false);
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const categories = getCategories(lang);

  const { data: companyForLimit } = useQuery({
    queryKey: ['company-maint-limit'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const companies = await base44.entities.Company.filter({ id: cid });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0] || null;
    },
    staleTime: 30000,
  });
  const overdraftBlocked = isAtOverdraftLimit(companyForLimit);
  const cats = aircraft.maintenance_categories || {};
  const purchasePrice = aircraft.purchase_price || 100000;
  const currentValue = aircraft.current_value || purchasePrice;

  // Calculate overall wear
  const catValues = categories.map(c => cats[c.key] || 0);
  const avgWear = catValues.reduce((a, b) => a + b, 0) / catValues.length;
  const maxWear = Math.max(...catValues);
  const needsMaintenance = maxWear > 75 || avgWear > 50;

  // Cost = accumulated_maintenance_cost split proportionally by wear per category
  // This ensures total displayed cost == accumulated_maintenance_cost exactly
  const accumulatedCost = aircraft.accumulated_maintenance_cost || 0;
  const totalWear = categories.reduce((sum, c) => sum + (cats[c.key] || 0), 0);

  const getCategoryCost = (key) => {
    const wear = cats[key] || 0;
    if (wear <= 0 || totalWear <= 0 || accumulatedCost <= 0) return 0;
    return Math.round(accumulatedCost * (wear / totalWear));
  };

  const getTotalCost = () => {
    if (totalWear <= 0) return 0;
    return Math.round(accumulatedCost);
  };

  const getCategoryCostExplanation = (catKey) => {
    const wear = cats[catKey] || 0;
    const categoryCost = getCategoryCost(catKey);
    const wearShare = totalWear > 0 ? (wear / totalWear) * 100 : 0;
    const basePoolText = lang === 'de'
      ? `Wartungskosten-Pool: $${Math.round(accumulatedCost).toLocaleString()}`
      : `Maintenance cost pool: $${Math.round(accumulatedCost).toLocaleString()}`;
    const splitFormulaText = lang === 'de'
      ? 'Kostenanteil = Gesamtpool x (Kategorie-Verschleiss / Summe aller Kategorie-Verschleisswerte)'
      : 'Cost split = total pool x (category wear / sum of all category wear values)';

    const byCategory = {
      engine: {
        details: lang === 'de'
          ? 'Engine: Bei >=99% Last steigt Verschleiss nach 10 Minuten jede weitere Minute um +1%.'
          : 'Engine: At >=99% load, wear rises by +1% per minute after the first 10 minutes.',
        formula: lang === 'de'
          ? 'Extra = floor(max(0, HighLoadSek - 600) / 60) x 1%'
          : 'Extra = floor(max(0, highLoadSec - 600) / 60) x 1%',
        trigger: lang === 'de' ? 'Ausloeser: Dauerhaft hohe Triebwerkslast' : 'Trigger: sustained high engine load',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: Leistungsverlust, unruhiger Lauf, Triebwerksausfall/Feuer'
          : 'Possible failures: thrust loss, rough running, engine failure/fire',
      },
      hydraulics: {
        details: lang === 'de'
          ? 'Hydraulik reagiert auf Landing-Impact und harte/haeufige Steuerinputs.'
          : 'Hydraulics react to landing impact and aggressive/frequent control input.',
        formula: lang === 'de'
          ? 'LandingImpact x 0.35 + ControlInput x 6 x 0.35'
          : 'LandingImpact x 0.35 + controlInput x 6 x 0.35',
        trigger: lang === 'de' ? 'Ausloeser: harte Landungen, aggressive Steuerung' : 'Trigger: hard landings, aggressive controls',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: Druckverlust, traege Ruder, Brems-/Gear-Hydraulikprobleme'
          : 'Possible failures: pressure loss, sluggish controls, brake/gear hydraulic issues',
      },
      avionics: {
        details: lang === 'de'
          ? 'Avionik verschleisst durch hohe G-Werte, harte Landungen und Overspeed.'
          : 'Avionics wear from high G loads, hard landings, and overspeed.',
        formula: lang === 'de'
          ? 'max(0, MaxG-1.4)x2.8 + max(0, LandingG-1.3)x2.2 + Overspeed'
          : 'max(0, maxG-1.4)x2.8 + max(0, landingG-1.3)x2.2 + overspeed',
        trigger: lang === 'de' ? 'Ausloeser: hohe G-Last, harte Touchdowns, Overspeed' : 'Trigger: high G load, hard touchdowns, overspeed',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: Display-Ausfall, NAV/COM-Probleme, Autopilot-Ausfall'
          : 'Possible failures: display dropouts, NAV/COM issues, autopilot failure',
      },
      airframe: {
        details: lang === 'de'
          ? 'Strukturverschleiss steigt bei hohen G-Lasten, Overstress und Overspeed.'
          : 'Airframe wear rises with high G loads, overstress, and overspeed.',
        formula: lang === 'de'
          ? 'max(0, MaxG-1.35)x2.2 + High-G-Event +3 + Overstress +6 + Overspeed +6'
          : 'max(0, maxG-1.35)x2.2 + high-G event +3 + overstress +6 + overspeed +6',
        trigger: lang === 'de' ? 'Ausloeser: hohe G-Werte in der Luft, Overstress, Overspeed' : 'Trigger: high in-air G, overstress, overspeed',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: strukturelle Beschaedigung, starke Vibrationen, Airframe-Failure'
          : 'Possible failures: structural damage, heavy vibration, airframe failure',
      },
      landing_gear: {
        details: lang === 'de'
          ? 'Fahrwerk verschleisst nach Landung exponentiell mit der Landungs-G-Kraft.'
          : 'Landing gear wear grows exponentially with touchdown G force.',
        formula: lang === 'de'
          ? 'Impact = max(0, exp((G - 1) x 1.25) - 1) x 5'
          : 'Impact = max(0, exp((G - 1) x 1.25) - 1) x 5',
        trigger: lang === 'de' ? 'Ausloeser: hohe Landing-G beim Touchdown' : 'Trigger: high touchdown G',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: Gear jam, Bremsprobleme, Fahrwerksversagen'
          : 'Possible failures: gear jam, brake issues, landing gear failure',
      },
      electrical: {
        details: lang === 'de'
          ? 'Elektrik steigt bei langer hoher Engine-Last, hoher Steuerlast und Overspeed.'
          : 'Electrical wear rises with prolonged high engine load, high control load, and overspeed.',
        formula: lang === 'de'
          ? '(HighLoadSek/3600)x0.6 + ControlInputx0.15 + Overspeed-Spikes'
          : '(highLoadSec/3600)x0.6 + controlInputx0.15 + overspeed spikes',
        trigger: lang === 'de' ? 'Ausloeser: Dauerlast, Stromspitzen, Overspeed' : 'Trigger: sustained load, electrical spikes, overspeed',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: Generator-/Batterieprobleme, Elektrik-Ausfall, Avionik-Blackouts'
          : 'Possible failures: generator/battery issues, electrical failure, avionics blackouts',
      },
      flight_controls: {
        details: lang === 'de'
          ? 'Steuerflaechen verschleissen durch aggressive Inputs und Flaps-Overspeed.'
          : 'Flight controls wear due to aggressive input and flaps overspeed.',
        formula: lang === 'de'
          ? 'ControlInput x 6 (+ Event-Spikes)'
          : 'controlInput x 6 (+ event spikes)',
        trigger: lang === 'de'
          ? 'Ausloeser: aggressive Inputs, Flaps-Overspeed, Strukturausfall kann Flaps/Speedbrake blockieren'
          : 'Trigger: aggressive input, flaps overspeed, airframe failure can block flaps/speedbrake',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: trage/uebersensitive Ruder, Flap-/Trim-Probleme'
          : 'Possible failures: sluggish/oversensitive controls, flap/trim issues',
      },
      pressurization: {
        details: lang === 'de'
          ? 'Drucksystem verschleisst mit Hoehenzeit und hoher Druckdifferenz.'
          : 'Pressurization wears with high-altitude exposure and pressure cycles.',
        formula: lang === 'de'
          ? '(HighAltSek/3600) x 0.7'
          : '(highAltSec/3600) x 0.7',
        trigger: lang === 'de' ? 'Ausloeser: lange Zeit in hoeheren Flughoehen' : 'Trigger: prolonged time at higher altitude',
        failures: lang === 'de'
          ? 'Moegliche Ausfaelle: Cabin-Pressure-Warnung, Druckverlust, Dekompressionsrisiko'
          : 'Possible failures: cabin pressure warnings, pressure loss, decompression risk',
      },
    };

    const categoryInfo = byCategory[catKey] || {
      details: lang === 'de'
        ? 'Wartungskosten steigen mit Verschleiss und flugbedingten Triggern.'
        : 'Maintenance costs increase with wear and flight-related triggers.',
      formula: lang === 'de' ? 'Neupreis x 2% x (Verschleiss/100)' : 'Purchase price x 2% x (wear/100)',
      trigger: lang === 'de' ? 'Ausloeser: allgemeiner Systemverschleiss' : 'Trigger: general system wear',
      failures: lang === 'de' ? 'Moegliche Ausfaelle: allgemeine Systemdegradation' : 'Possible failures: general system degradation',
    };

    if (categoryCost <= 0 || totalWear <= 0 || wear <= 0) {
      return {
        title: lang === 'de' ? 'Live-Kosten und Trigger' : 'Live cost and triggers',
        details: categoryInfo.details,
        formula: categoryInfo.formula,
        trigger: categoryInfo.trigger,
        possibleFailures: categoryInfo.failures,
        breakdown: `${basePoolText} | ${splitFormulaText}`,
      };
    }

    return {
      title: lang === 'de' ? 'Live-Kosten und Trigger' : 'Live cost and triggers',
      details: categoryInfo.details,
      formula: `${categoryInfo.formula} | ${splitFormulaText}`,
      trigger: `${categoryInfo.trigger} | ${lang === 'de' ? 'Aktueller Verschleiss' : 'Current wear'}: ${wear.toFixed(1)}%`,
      possibleFailures: categoryInfo.failures,
      breakdown: lang === 'de'
        ? `${basePoolText} -> $${Math.round(accumulatedCost).toLocaleString()} x ${wear.toFixed(1)} / ${totalWear.toFixed(1)} = $${categoryCost.toLocaleString()} (${wearShare.toFixed(1)}%)`
        : `${basePoolText} -> $${Math.round(accumulatedCost).toLocaleString()} x ${wear.toFixed(1)} / ${totalWear.toFixed(1)} = $${categoryCost.toLocaleString()} (${wearShare.toFixed(1)}%)`,
    };
  };

  const repairCategoryMutation = useMutation({
    mutationFn: async (categoryKey) => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      const company = companies[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      const cost = getCategoryCost(categoryKey);
      if (cost <= 0) return;

      const valueReduction = cost * 0.10;
      const newValue = Math.max(0, currentValue - valueReduction);

      const newCats = { ...(aircraft.maintenance_categories || {}) };
      newCats[categoryKey] = 0;

      // Subtract this category's cost from accumulated total
      const newAccum = Math.max(0, accumulatedCost - cost);

      const newMaxWear = Math.max(...categories.map(c => newCats[c.key] || 0));
      const newAvgWear = categories.map(c => newCats[c.key] || 0).reduce((a, b) => a + b, 0) / categories.length;
      const stillNeedsMaint = newMaxWear > 75 || newAvgWear > 50;
      const newStatus = newValue <= 0
        ? 'total_loss'
        : (aircraft.status === 'damaged' ? 'damaged' : (stillNeedsMaint ? 'maintenance' : 'available'));

      await base44.entities.Aircraft.update(aircraft.id, {
        maintenance_categories: newCats,
        current_value: newValue,
        accumulated_maintenance_cost: newAccum,
        status: newStatus
      });

      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - cost });
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'maintenance',
        amount: cost,
        description: `Wartung ${categories.find(c => c.key === categoryKey)?.label}: ${aircraft.name}`,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  const repairAllMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      const company = companies[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      const totalCost = getTotalCost();
      if (totalCost <= 0) return;

      const valueReduction = totalCost * 0.10;
      const newValue = Math.max(0, currentValue - valueReduction);
      const newCats = {};
      categories.forEach(c => { newCats[c.key] = 0; });
      
      const newStatus = newValue <= 0 ? 'total_loss' : (aircraft.status === 'damaged' ? 'damaged' : 'available');

      await base44.entities.Aircraft.update(aircraft.id, {
        maintenance_categories: newCats,
        current_value: newValue,
        accumulated_maintenance_cost: 0,
        status: newStatus
      });

      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - totalCost });
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'maintenance',
        amount: totalCost,
        description: `Komplettwartung: ${aircraft.name} (Wertminderung: -$${Math.round(valueReduction).toLocaleString()})`,
        date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  const totalCost = getTotalCost();

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
          {needsMaintenance && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {tl('maint_needed', lang)}
            </Badge>
          )}
        </div>
      </div>

      {/* Overall wear indicator */}
      <div className="p-2 bg-slate-900 rounded-lg">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">{tl('overall_wear', lang)}</span>
          <span className={getWearColor(avgWear)}>{avgWear.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${getProgressColor(avgWear)}`}
            style={{ width: `${Math.min(100, avgWear)}%` }} />
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-1.5">
        {categories.map(cat => {
          const wear = cats[cat.key] || 0;
          const cost = getCategoryCost(cat.key);
          const Icon = cat.icon;
          
          return (
            <div key={cat.key} className="flex items-center gap-2 p-1.5 bg-slate-900/50 rounded">
              <Icon className={`w-3.5 h-3.5 shrink-0 ${getWearColor(wear)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 truncate flex items-center gap-1">
                    <span>{cat.label}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/70 transition-colors"
                          aria-label={lang === 'de' ? `Kostenformel für ${cat.label}` : `Cost formula for ${cat.label}`}
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 bg-slate-900 border-slate-700 text-slate-200 p-3" align="start">
                        {(() => {
                          const info = getCategoryCostExplanation(cat.key);
                          return (
                            <div className="space-y-1.5 text-xs">
                              <p className="font-semibold text-white">{info.title}</p>
                              <p className="text-slate-300">{info.details}</p>
                              <p className="text-slate-400">{info.formula}</p>
                              <p className="text-slate-300">{info.trigger}</p>
                              <p className="text-rose-300">{info.possibleFailures}</p>
                              <p className="text-amber-300 font-mono">{info.breakdown}</p>
                            </div>
                          );
                        })()}
                      </PopoverContent>
                    </Popover>
                  </span>
                  <span className={`font-mono ${getWearColor(wear)}`}>{wear.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1 mt-0.5">
                  <div className={`h-1 rounded-full transition-all ${getProgressColor(wear)}`}
                    style={{ width: `${Math.min(100, wear)}%` }} />
                </div>
              </div>
              {cost > 0 && (
                <Button 
                  size="sm" 
                  className="h-6 px-2 text-xs bg-amber-600 hover:bg-amber-700 shrink-0"
                  onClick={() => repairCategoryMutation.mutate(cat.key)}
                  disabled={repairCategoryMutation.isPending || overdraftBlocked}
                >
                  ${cost.toLocaleString()}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Overdraft block warning */}
      {overdraftBlocked && totalCost > 0 && (
        <div className="p-2 bg-red-950/50 border border-red-700/50 rounded flex items-center gap-2">
          <Skull className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">
            {lang === 'de' ? 'Dispo-Limit erreicht – Wartung nicht möglich!' : 'Overdraft limit reached – maintenance blocked!'}
          </p>
        </div>
      )}

      {/* Repair All button */}
      {totalCost > 0 && (
        <Button 
          className={`w-full ${needsMaintenance ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          size="sm"
          onClick={() => repairAllMutation.mutate()}
          disabled={repairAllMutation.isPending || overdraftBlocked}
        >
          <Wrench className="w-4 h-4 mr-1" />
          {repairAllMutation.isPending ? tl('waiting', lang) : `${tl('repair_all', lang)} ($${totalCost.toLocaleString()})`}
          {needsMaintenance && ` - ${tl('required_excl', lang)}`}
        </Button>
      )}

      {/* Info Dialog */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{tl('maint_system_title', lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <h5 className="font-semibold text-white mb-1">{lang === 'de' ? 'Verschleiß-Kategorien' : 'Wear Categories'}</h5>
              <p>{tl('maint_cat_desc', lang)}</p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">{tl('maint_failures', lang)}</h5>
              <p>{tl('maint_failures_desc', lang)}</p>
              <ul className="list-disc ml-4 mt-1 space-y-1 text-slate-400">
                {lang === 'de' ? (
                  <>
                    <li><span className="text-emerald-400">0-20%</span>: Kaum Ausfälle</li>
                    <li><span className="text-amber-400">20-50%</span>: Gelegentlich leichte Ausfälle (Lichter, Instrumente)</li>
                    <li><span className="text-orange-400">50-75%</span>: Häufiger, auch mittelschwere (Generator, Hydraulik, Autopilot)</li>
                    <li><span className="text-red-400">75-100%</span>: Häufig und schwere Ausfälle (Triebwerksausfall, Feuer, Dekompression)</li>
                  </>
                ) : (
                  <>
                    <li><span className="text-emerald-400">0-20%</span>: Rare failures</li>
                    <li><span className="text-amber-400">20-50%</span>: Occasional minor failures (lights, instruments)</li>
                    <li><span className="text-orange-400">50-75%</span>: More frequent, also moderate (generator, hydraulics, autopilot)</li>
                    <li><span className="text-red-400">75-100%</span>: Frequent and severe failures (engine failure, fire, decompression)</li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">{lang === 'de' ? 'Wertverlust' : 'Depreciation'}</h5>
              <p>{lang === 'de' ? 'Je stärker der Flugzeugwert vom Neupreis abweicht, desto anfälliger ist es für Ausfälle. Ein Flugzeug mit 50% Wertverlust hat deutlich mehr Probleme.' : 'The more the aircraft value deviates from the purchase price, the more prone it is to failures. An aircraft with 50% depreciation has significantly more issues.'}</p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">{lang === 'de' ? 'Wartung' : 'Maintenance'}</h5>
              <p>{lang === 'de' ? 'Jede Kategorie kann einzeln oder komplett gewartet werden. Wartungskosten basieren auf dem Verschleiß (2% des Neupreises pro 100% Verschleiß). Jede Wartung verursacht 10% permanenten Wertverlust der gezahlten Wartungssumme.' : 'Each category can be repaired individually or all at once. Maintenance costs are based on wear (2% of purchase price per 100% wear). Every maintenance action permanently depreciates aircraft value by 10% of the paid maintenance amount.'}</p>
            </div>
            <div>
              <h5 className="font-semibold text-amber-400 mb-1">⚠️ {tl('maint_mandatory', lang)}</h5>
              <p>{tl('maint_mandatory_desc', lang)}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
