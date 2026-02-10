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
  Trash2
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
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function AircraftCard({ aircraft, onSelect, onMaintenance, onView }) {
  const [isRepairDialogOpen, setIsRepairDialogOpen] = React.useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const typeConfig = {
    small_prop: { label: "Propeller (Klein)", icon: "🛩️" },
    turboprop: { label: "Turboprop", icon: "✈️" },
    regional_jet: { label: "Regionaljet", icon: "🛫" },
    narrow_body: { label: "Narrow-Body", icon: "✈️" },
    wide_body: { label: "Wide-Body", icon: "🛬" },
    cargo: { label: "Fracht", icon: "📦" }
  };

  const statusConfig = {
    available: { label: "Verfügbar", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    in_flight: { label: "Im Flug", color: "bg-blue-100 text-blue-700 border-blue-200" },
    maintenance: { label: "Wartung", color: "bg-amber-100 text-amber-700 border-amber-200" },
    damaged: { label: "Beschädigt", color: "bg-red-100 text-red-700 border-red-200" },
    total_loss: { label: "Totalschaden", color: "bg-red-200 text-red-800 border-red-300" },
    sold: { label: "Verkauft", color: "bg-slate-100 text-slate-600 border-slate-200" }
  };

  const repairCost = (aircraft.purchase_price || 0) * 0.30;
  const scrapValue = (aircraft.current_value || aircraft.purchase_price || 0) * 0.10;
  const currentValue = aircraft.current_value || aircraft.purchase_price || 0;
  
  // New category-based maintenance check
  const cats = aircraft.maintenance_categories || {};
  const catValues = [
    cats.engine || 0, cats.hydraulics || 0, cats.avionics || 0,
    cats.airframe || 0, cats.landing_gear || 0, cats.electrical || 0,
    cats.flight_controls || 0, cats.pressurization || 0
  ];
  const avgWear = catValues.reduce((a, b) => a + b, 0) / catValues.length;
  const maxWear = Math.max(...catValues);
  const needsMaintenance = maxWear > 75 || avgWear > 50;

  const repairMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      const company = companies[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      // Repair cost is 30% of original purchase price
      const repairPrice = (aircraft.purchase_price || 0) * 0.30;
      // After repair, reduce the current value by 10% of repair cost permanently
      const valueReduction = repairPrice * 0.10;
      const newValue = Math.max(0, currentValue - valueReduction);
      
      // If value reaches 0, it's a total loss
      const newStatus = newValue <= 0 ? 'total_loss' : 'available';
      
      await base44.entities.Aircraft.update(aircraft.id, { 
        status: newStatus,
        accumulated_maintenance_cost: 0,
        current_value: newValue
      });
      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - repairPrice });
      
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'maintenance',
        amount: repairPrice,
        description: `Reparatur: ${aircraft.name} (Wertminderung: -$${Math.round(valueReduction).toLocaleString()})`,
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

  // Legacy performMaintenanceMutation removed - now handled by MaintenanceCategories component

  const type = typeConfig[aircraft.type] || typeConfig.small_prop;
  // Override status display if maintenance is needed but status is still "available"
  const displayStatus = (aircraft.status === 'available' && needsMaintenance) 
    ? { label: "Wartung erforderlich", color: "bg-orange-100 text-orange-700 border-orange-200" }
    : (statusConfig[aircraft.status] || statusConfig.available);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden bg-slate-800 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-300">
        <div className="relative h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          {aircraft.image_url ? (
            <img 
              src={aircraft.image_url} 
              alt={aircraft.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-5xl">{type.icon}</span>
          )}
          <Badge className={`absolute top-3 right-3 ${displayStatus.color} border`}>
            {displayStatus.label}
          </Badge>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-lg text-white">{aircraft.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {aircraft.registration}
              </span>
              <span className="text-sm text-slate-400">{type.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-slate-400" />
              <span>{aircraft.passenger_capacity || 0} Sitze</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Package className="w-4 h-4 text-slate-400" />
              <span>{aircraft.cargo_capacity_kg?.toLocaleString() || 0} kg</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Fuel className="w-4 h-4 text-slate-400" />
              <span>{aircraft.fuel_consumption_per_hour} L/h</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Plane className="w-4 h-4 text-slate-400" />
              <span>{aircraft.range_nm?.toLocaleString()} NM</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Flugstunden</span>
            </div>
            <span className="font-semibold text-white">
              {aircraft.total_flight_hours?.toLocaleString() || 0}h
            </span>
          </div>

          {/* Detailed Maintenance Categories */}
          <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg mb-4">
            <MaintenanceCategories aircraft={aircraft} />
          </div>

          {/* Current & Depreciation Value */}
          <div className="p-3 bg-slate-900 rounded-lg mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Aktueller Wert:</span>
              <span className={`font-semibold ${currentValue < (aircraft.purchase_price || 0) * 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                ${Math.round(currentValue).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Neuwert:</span>
              <span className="font-semibold text-slate-300">
                ${(aircraft.purchase_price || 0).toLocaleString()}
              </span>
            </div>
            {currentValue < (aircraft.purchase_price || 0) && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Wertverlust:</span>
                <span className="text-red-400">
                  -${Math.round((aircraft.purchase_price || 0) - currentValue).toLocaleString()} ({(((aircraft.purchase_price || 0) - currentValue) / (aircraft.purchase_price || 1) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          {aircraft.status === "total_loss" ? (
            <div className="w-full p-3 bg-red-200 border border-red-400 rounded-lg mb-3">
              <p className="text-sm text-red-900 font-semibold mb-3">Totalschaden - Flugzeug ist wertlos</p>
              <Button 
                size="sm" 
                className="w-full"
                onClick={() => scrapMutation.mutate()}
                disabled={scrapMutation.isPending}
                variant="destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {scrapMutation.isPending ? 'Entsorge...' : 'Verschrotten'}
              </Button>
            </div>
          ) : aircraft.status === "damaged" ? (
            <div className="w-full p-3 bg-red-100 border border-red-300 rounded-lg mb-3">
              <p className="text-sm text-red-800 font-semibold mb-3">Flugzeug beschädigt</p>
              <Dialog open={isRepairDialogOpen} onOpenChange={setIsRepairDialogOpen}>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                    onClick={() => setIsRepairDialogOpen(true)}
                  >
                    <Hammer className="w-4 h-4 mr-1" />
                    Reparieren
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setIsRepairDialogOpen(true)}
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Entsorgen
                  </Button>
                </div>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Flugzeug reparieren oder entsorgen</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-800 rounded-lg space-y-3">
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Reparaturkosten (30% des Neuwertes):</p>
                        <p className="text-2xl font-bold text-amber-400">${repairCost.toLocaleString()}</p>
                      </div>
                      <div className="border-t border-slate-700 pt-3">
                        <p className="text-sm text-slate-400 mb-2">Verschrottungswert (10% des aktuellen Wertes):</p>
                        <p className="text-xl font-bold text-slate-300">${scrapValue.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">
                      Das Flugzeug wird nach der Reparatur wieder einsatzfähig oder du kannst es verschrotten.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRepairDialogOpen(false)} className="border-slate-600 text-slate-300">
                      Abbrechen
                    </Button>
                    <Button 
                      onClick={() => repairMutation.mutate()}
                      disabled={repairMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {repairMutation.isPending ? 'Repariere...' : `Reparieren ($${repairCost.toLocaleString()})`}
                    </Button>
                    <Button 
                      onClick={() => scrapMutation.mutate()}
                      disabled={scrapMutation.isPending}
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      {scrapMutation.isPending ? 'Entsorge...' : `Entsorgen (+$${scrapValue.toLocaleString()})`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (aircraft.status === "available" || aircraft.status === "maintenance") ? (
            <div className="space-y-2">
              {aircraft.status === "available" && (
                <>
                  <Button 
                    size="sm" 
                    className="w-full bg-slate-600 hover:bg-slate-700"
                    onClick={() => setIsSellDialogOpen(true)}
                  >
                    <DollarSign className="w-4 h-4 mr-1" />
                    Verkaufen
                  </Button>
                  <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
                    <DialogContent className="bg-slate-900 border-slate-700">
                      <DialogHeader>
                        <DialogTitle className="text-white">Flugzeug verkaufen</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-800 rounded-lg">
                          <p className="text-sm text-slate-400 mb-2">Verkaufspreis (85% des aktuellen Wertes):</p>
                          <p className="text-2xl font-bold text-emerald-400">${sellPrice.toLocaleString()}</p>
                        </div>
                        <p className="text-sm text-slate-400">
                          Das Flugzeug wird aus deiner Flotte entfernt.
                        </p>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSellDialogOpen(false)} className="border-slate-600 text-slate-300">
                          Abbrechen
                        </Button>
                        <Button 
                          onClick={() => sellMutation.mutate()}
                          disabled={sellMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {sellMutation.isPending ? 'Verkaufe...' : 'Verkaufen'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          ) : null}
          </div>
          </Card>
          </motion.div>
          );
          }