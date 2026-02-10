import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wrench, Cog, Gauge, CircuitBoard, Shield, Plane, Zap, Wind, AlertTriangle, Info } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const categories = [
  { key: "engine", label: "Triebwerk", icon: Cog, description: "Motor, Turbine, Kraftstoffsystem" },
  { key: "hydraulics", label: "Hydraulik", icon: Gauge, description: "Hydraulikpumpen, Leitungen, Ventile" },
  { key: "avionics", label: "Avionik", icon: CircuitBoard, description: "Instrumente, Autopilot, Navigation" },
  { key: "airframe", label: "Zelle/Struktur", icon: Shield, description: "Rumpf, Tragflächen, Leitwerk" },
  { key: "landing_gear", label: "Fahrwerk", icon: Plane, description: "Räder, Bremsen, Fahrwerk-Mechanik" },
  { key: "electrical", label: "Elektrik", icon: Zap, description: "Generatoren, Batterien, Beleuchtung" },
  { key: "flight_controls", label: "Flugsteuerung", icon: Wind, description: "Querruder, Seitenruder, Höhenruder" },
  { key: "pressurization", label: "Druckkabine", icon: Shield, description: "Druckregelung, Klimaanlage" },
];

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

  const repairCategoryMutation = useMutation({
    mutationFn: async (categoryKey) => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      const company = companies[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      const cost = getCategoryCost(categoryKey);
      if (cost <= 0) return;

      const valueReduction = cost * 0.05; // 5% of repair cost as permanent value loss
      const newValue = Math.max(0, currentValue - valueReduction);

      const newCats = { ...(aircraft.maintenance_categories || {}) };
      newCats[categoryKey] = 0;

      // Recalculate accumulated_maintenance_cost from remaining categories
      const remaining = categories.reduce((sum, c) => sum + (newCats[c.key] || 0), 0);
      const newAccum = remaining > 0 ? (purchasePrice * (remaining / 800) * 0.02) : 0;

      // Determine new status
      const newMaxWear = Math.max(...categories.map(c => newCats[c.key] || 0));
      const newAvgWear = categories.map(c => newCats[c.key] || 0).reduce((a, b) => a + b, 0) / categories.length;
      const stillNeedsMaint = newMaxWear > 75 || newAvgWear > 50;
      const newStatus = aircraft.status === 'damaged' ? 'damaged' : (stillNeedsMaint ? 'maintenance' : 'available');

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

      const valueReduction = totalCost * 0.05;
      const newValue = Math.max(0, currentValue - valueReduction);
      const newCats = {};
      categories.forEach(c => { newCats[c.key] = 0; });
      
      const newStatus = aircraft.status === 'damaged' ? 'damaged' : 'available';

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
          Wartungsstatus
        </h4>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowInfo(true)}>
            <Info className="w-3.5 h-3.5 text-slate-400" />
          </Button>
          {needsMaintenance && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Wartung nötig
            </Badge>
          )}
        </div>
      </div>

      {/* Overall wear indicator */}
      <div className="p-2 bg-slate-900 rounded-lg">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Gesamt-Verschleiß</span>
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
                  <span className="text-slate-300 truncate">{cat.label}</span>
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
                  disabled={repairCategoryMutation.isPending}
                >
                  ${cost.toLocaleString()}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Repair All button */}
      {totalCost > 0 && (
        <Button 
          className={`w-full ${needsMaintenance ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          size="sm"
          onClick={() => repairAllMutation.mutate()}
          disabled={repairAllMutation.isPending}
        >
          <Wrench className="w-4 h-4 mr-1" />
          {repairAllMutation.isPending ? 'Warte...' : `Alles warten ($${totalCost.toLocaleString()})`}
          {needsMaintenance && ' - Erforderlich!'}
        </Button>
      )}

      {/* Info Dialog */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Wartungssystem - So funktioniert's</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <h5 className="font-semibold text-white mb-1">Verschleiß-Kategorien</h5>
              <p>Jede Kategorie hat einen eigenen Verschleiß von 0-100%. Verschleiß entsteht durch Flugvorfälle wie harte Landungen, Überlastung oder technische Probleme.</p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">Ausfälle im Flug</h5>
              <p>Je höher der Verschleiß, desto häufiger treten zufällige Ausfälle im X-Plane auf. Der Verschleiß UND der Wertverlust des Flugzeugs bestimmen die Häufigkeit:</p>
              <ul className="list-disc ml-4 mt-1 space-y-1 text-slate-400">
                <li><span className="text-emerald-400">0-20%</span>: Kaum Ausfälle</li>
                <li><span className="text-amber-400">20-50%</span>: Gelegentlich leichte Ausfälle (Lichter, Instrumente)</li>
                <li><span className="text-orange-400">50-75%</span>: Häufiger, auch mittelschwere (Generator, Hydraulik, Autopilot)</li>
                <li><span className="text-red-400">75-100%</span>: Häufig und schwere Ausfälle (Triebwerksausfall, Feuer, Dekompression)</li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">Wertverlust</h5>
              <p>Je stärker der Flugzeugwert vom Neupreis abweicht, desto anfälliger ist es für Ausfälle. Ein Flugzeug mit 50% Wertverlust hat deutlich mehr Probleme.</p>
            </div>
            <div>
              <h5 className="font-semibold text-white mb-1">Wartung</h5>
              <p>Jede Kategorie kann einzeln oder komplett gewartet werden. Wartungskosten basieren auf dem Verschleiß (2% des Neupreises pro 100% Verschleiß). Jede Wartung verursacht 5% permanenten Wertverlust.</p>
            </div>
            <div>
              <h5 className="font-semibold text-amber-400 mb-1">⚠️ Pflicht-Wartung</h5>
              <p>Ab 75% Verschleiß in einer Kategorie oder 50% Durchschnitt muss gewartet werden, bevor das Flugzeug erneut fliegen darf.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}