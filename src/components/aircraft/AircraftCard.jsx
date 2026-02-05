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
    sold: { label: "Verkauft", color: "bg-slate-100 text-slate-600 border-slate-200" }
  };

  const repairCost = (aircraft.purchase_price || 0) * 0.35;
  const scrapValue = (aircraft.purchase_price || 0) * 0.1;

  const repairMutation = useMutation({
    mutationFn: async () => {
      const company = (await base44.entities.Company.list())[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      await base44.entities.Aircraft.update(aircraft.id, { status: 'available' });
      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) - repairCost });
      await base44.entities.Transaction.create({
        type: 'expense',
        category: 'maintenance',
        amount: repairCost,
        description: `Reparatur: ${aircraft.name}`,
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
      const company = (await base44.entities.Company.list())[0];
      if (!company) throw new Error('Unternehmen nicht gefunden');

      await base44.entities.Aircraft.update(aircraft.id, { status: 'sold' });
      await base44.entities.Company.update(company.id, { balance: (company.balance || 0) + scrapValue });
      await base44.entities.Transaction.create({
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

  const type = typeConfig[aircraft.type] || typeConfig.small_prop;
  const status = statusConfig[aircraft.status] || statusConfig.available;

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
          <Badge className={`absolute top-3 right-3 ${status.color} border`}>
            {status.label}
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

          <div className="flex items-center justify-between text-sm mb-4">
            <div className="flex items-center gap-1 text-slate-400">
              <Wrench className="w-4 h-4" />
              <span>Wartung/h:</span>
            </div>
            <span className="font-medium text-slate-300">
              ${aircraft.maintenance_cost_per_hour?.toLocaleString()}
            </span>
          </div>

          {/* Current & Depreciation Value */}
          <div className="p-3 bg-slate-900 rounded-lg mb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Aktueller Wert:</span>
              <span className="font-semibold text-emerald-400">
                ${(aircraft.current_value || aircraft.purchase_price || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Neuwert:</span>
              <span className="font-semibold text-slate-300">
                ${(aircraft.purchase_price || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {aircraft.status === "damaged" ? (
              <>
                <Dialog open={isRepairDialogOpen} onOpenChange={setIsRepairDialogOpen}>
                  <Button 
                    size="sm" 
                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                    onClick={() => setIsRepairDialogOpen(true)}
                  >
                    <Hammer className="w-4 h-4 mr-1" />
                    Reparieren
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Flugzeug reparieren</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-100 rounded-lg">
                        <p className="text-sm text-slate-600 mb-2">Reparaturkosten (35% des Neuwertes):</p>
                        <p className="text-2xl font-bold text-amber-700">${repairCost.toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-slate-600">
                        Das Flugzeug wird nach der Reparatur wieder einsatzfähig.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsRepairDialogOpen(false)}>
                        Abbrechen
                      </Button>
                      <Button 
                        onClick={() => repairMutation.mutate()}
                        disabled={repairMutation.isPending}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {repairMutation.isPending ? 'Repariere...' : 'Reparieren'}
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
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onView?.(aircraft)}>
                  Details
                </Button>
                {aircraft.status === "available" && (
                  <Button 
                    size="sm" 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={() => onSelect?.(aircraft)}
                  >
                    Auswählen
                  </Button>
                )}
              </>
            )}
          </div>
          </div>
          </Card>
          </motion.div>
          );
          }