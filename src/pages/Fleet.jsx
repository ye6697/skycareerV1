import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Plane,
  DollarSign
} from "lucide-react";

import AircraftCard from "@/components/aircraft/AircraftCard";

const AIRCRAFT_MARKET = [
  {
    name: "Cessna 172 Skyhawk",
    type: "small_prop",
    passenger_capacity: 3,
    cargo_capacity_kg: 100,
    fuel_consumption_per_hour: 35,
    range_nm: 640,
    purchase_price: 150000,
    maintenance_cost_per_hour: 25
  },
  {
    name: "Beechcraft King Air 350",
    type: "turboprop",
    passenger_capacity: 8,
    cargo_capacity_kg: 350,
    fuel_consumption_per_hour: 220,
    range_nm: 1800,
    purchase_price: 750000,
    maintenance_cost_per_hour: 120
  },
  {
    name: "Embraer E175",
    type: "regional_jet",
    passenger_capacity: 76,
    cargo_capacity_kg: 2000,
    fuel_consumption_per_hour: 1800,
    range_nm: 2200,
    purchase_price: 2500000,
    maintenance_cost_per_hour: 450
  },
  {
    name: "Airbus A320neo",
    type: "narrow_body",
    passenger_capacity: 180,
    cargo_capacity_kg: 5000,
    fuel_consumption_per_hour: 2500,
    range_nm: 3500,
    purchase_price: 12000000,
    maintenance_cost_per_hour: 1200
  },
  {
    name: "Boeing 777-300ER",
    type: "wide_body",
    passenger_capacity: 396,
    cargo_capacity_kg: 22000,
    fuel_consumption_per_hour: 7500,
    range_nm: 7370,
    purchase_price: 35000000,
    maintenance_cost_per_hour: 3500
  },
  {
    name: "Boeing 747-8F",
    type: "cargo",
    passenger_capacity: 0,
    cargo_capacity_kg: 134000,
    fuel_consumption_per_hour: 11000,
    range_nm: 4120,
    purchase_price: 42000000,
    maintenance_cost_per_hour: 4500
  }
];

export default function Fleet() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  const { data: aircraft = [], isLoading } = useQuery({
    queryKey: ['aircraft'],
    queryFn: () => base44.entities.Aircraft.list('-created_date')
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const companies = await base44.entities.Company.list();
      return companies[0];
    }
  });

  const purchaseMutation = useMutation({
    mutationFn: async (aircraftData) => {
      const registration = `${company?.callsign?.slice(0, 2) || 'N'}${String(aircraft.length + 1).padStart(3, '0')}`;
      
      await base44.entities.Aircraft.create({
        ...aircraftData,
        registration,
        status: 'available',
        total_flight_hours: 0
      });

      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - aircraftData.purchase_price
        });
        await base44.entities.Transaction.create({
          type: 'expense',
          category: 'aircraft_purchase',
          amount: aircraftData.purchase_price,
          description: `Kauf: ${aircraftData.name}`,
          date: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setIsPurchaseDialogOpen(false);
      setSelectedAircraft(null);
    }
  });

  const filteredAircraft = aircraft.filter(ac => {
    if (ac.status === 'sold') return false;
    const matchesSearch = ac.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ac.registration?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && ac.type === activeTab;
  });

  const typeLabels = {
    small_prop: 'Propeller',
    turboprop: 'Turboprop',
    regional_jet: 'Regional',
    narrow_body: 'Narrow-Body',
    wide_body: 'Wide-Body',
    cargo: 'Fracht'
  };

  const canAfford = (price) => (company?.balance || 0) >= price;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Flotte</h1>
              <p className="text-slate-400">Verwalte und erweitere deine Flugzeugflotte</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Flugzeug suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-slate-800 text-white border-slate-700"
                />
              </div>
              <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Flugzeug kaufen
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Flugzeugmarkt</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-3">
                    {company && (
                      <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between sticky top-0">
                        <span className="text-sm text-slate-600">Verfügbares Budget:</span>
                        <span className="font-bold text-slate-900">${company.balance?.toLocaleString()}</span>
                      </div>
                    )}

                    {AIRCRAFT_MARKET.map((ac, index) => (
                      <Card 
                        key={index}
                        className={`p-4 cursor-pointer transition-all ${
                          selectedAircraft?.name === ac.name 
                            ? 'border-blue-500 bg-blue-50' 
                            : canAfford(ac.purchase_price) 
                              ? 'hover:border-slate-300' 
                              : 'opacity-50'
                        }`}
                        onClick={() => canAfford(ac.purchase_price) && setSelectedAircraft(ac)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-lg">{ac.name}</p>
                            <p className="text-sm text-slate-500">{typeLabels[ac.type]}</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm text-slate-600">
                              <span>🪑 {ac.passenger_capacity} Sitze</span>
                              <span>📦 {ac.cargo_capacity_kg?.toLocaleString()} kg</span>
                              <span>⛽ {ac.fuel_consumption_per_hour} L/h</span>
                              <span>✈️ {ac.range_nm?.toLocaleString()} NM</span>
                              <span>🔧 ${ac.maintenance_cost_per_hour}/h</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-bold ${canAfford(ac.purchase_price) ? 'text-emerald-600' : 'text-red-500'}`}>
                              ${ac.purchase_price?.toLocaleString()}
                            </p>
                            {!canAfford(ac.purchase_price) && (
                              <p className="text-xs text-red-500">Nicht genug Budget</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
                      Abbrechen
                    </Button>
                    <Button
                      onClick={() => purchaseMutation.mutate(selectedAircraft)}
                      disabled={!selectedAircraft || purchaseMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {purchaseMutation.isPending ? 'Kaufe...' : `Für $${selectedAircraft?.purchase_price?.toLocaleString() || 0} kaufen`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-slate-800 border border-slate-700 flex-wrap h-auto p-1">
            <TabsTrigger value="all">Alle</TabsTrigger>
            {Object.entries(typeLabels).map(([type, label]) => (
              <TabsTrigger key={type} value={type}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Aircraft Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-80 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : filteredAircraft.length > 0 ? (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" layout>
            <AnimatePresence>
              {filteredAircraft.map((ac) => (
                <AircraftCard key={ac.id} aircraft={ac} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Keine Flugzeuge</h3>
            <p className="text-slate-400 mb-4">Kaufe dein erstes Flugzeug, um loszulegen</p>
            <Button onClick={() => setIsPurchaseDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Flugzeug kaufen
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}