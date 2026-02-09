import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
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
  DollarSign,
  Sparkles
} from "lucide-react";

import AircraftCard from "@/components/aircraft/AircraftCard";

const AIRCRAFT_MARKET_SPECS = [
  { name: "Cessna 172 Skyhawk", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 100, fuel_consumption_per_hour: 45, range_nm: 640, purchase_price: 425000, maintenance_cost_per_hour: 25, level_requirement: 1 },
  { name: "Piper PA-28 Cherokee", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 120, fuel_consumption_per_hour: 50, range_nm: 700, purchase_price: 650000, maintenance_cost_per_hour: 30, level_requirement: 1 },
  { name: "Piper PA-44 Seminole", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 150, fuel_consumption_per_hour: 55, range_nm: 750, purchase_price: 750000, maintenance_cost_per_hour: 35, level_requirement: 2 },
  { name: "Socata Tobago", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 140, fuel_consumption_per_hour: 52, range_nm: 720, purchase_price: 700000, maintenance_cost_per_hour: 32, level_requirement: 2 },
  { name: "Piper PA-46 Malibu", type: "turboprop", passenger_capacity: 6, cargo_capacity_kg: 300, fuel_consumption_per_hour: 150, range_nm: 1500, purchase_price: 1200000, maintenance_cost_per_hour: 85, level_requirement: 3 },
  { name: "Cessna Caravan", type: "turboprop", passenger_capacity: 14, cargo_capacity_kg: 1500, fuel_consumption_per_hour: 280, range_nm: 1200, purchase_price: 1900000, maintenance_cost_per_hour: 90, level_requirement: 4 },
  { name: "Beechcraft King Air 350", type: "turboprop", passenger_capacity: 8, cargo_capacity_kg: 350, fuel_consumption_per_hour: 350, range_nm: 1800, purchase_price: 18000000, maintenance_cost_per_hour: 120, level_requirement: 8 },
  { name: "ATR 72F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 6000, fuel_consumption_per_hour: 350, range_nm: 2400, purchase_price: 28000000, maintenance_cost_per_hour: 600, level_requirement: 10 },
  { name: "Bombardier Dash 8-100", type: "turboprop", passenger_capacity: 50, cargo_capacity_kg: 2000, fuel_consumption_per_hour: 600, range_nm: 1550, purchase_price: 25000000, maintenance_cost_per_hour: 200, level_requirement: 9 },
  { name: "Bombardier Q400", type: "turboprop", passenger_capacity: 78, cargo_capacity_kg: 2700, fuel_consumption_per_hour: 850, range_nm: 1700, purchase_price: 30000000, maintenance_cost_per_hour: 280, level_requirement: 10 },
  { name: "Bombardier CRJ-200", type: "regional_jet", passenger_capacity: 50, cargo_capacity_kg: 1500, fuel_consumption_per_hour: 1600, range_nm: 2000, purchase_price: 35000000, maintenance_cost_per_hour: 350, level_requirement: 11 },
  { name: "Embraer E170", type: "regional_jet", passenger_capacity: 70, cargo_capacity_kg: 1850, fuel_consumption_per_hour: 2200, range_nm: 2100, purchase_price: 45000000, maintenance_cost_per_hour: 420, level_requirement: 12 },
  { name: "Embraer E175", type: "regional_jet", passenger_capacity: 76, cargo_capacity_kg: 2000, fuel_consumption_per_hour: 2400, range_nm: 2200, purchase_price: 50000000, maintenance_cost_per_hour: 450, level_requirement: 13 },
  { name: "Airbus A220", type: "regional_jet", passenger_capacity: 130, cargo_capacity_kg: 3400, fuel_consumption_per_hour: 2800, range_nm: 2800, purchase_price: 65000000, maintenance_cost_per_hour: 650, level_requirement: 14 },
  { name: "Airbus A318", type: "narrow_body", passenger_capacity: 108, cargo_capacity_kg: 3200, fuel_consumption_per_hour: 2200, range_nm: 3100, purchase_price: 75000000, maintenance_cost_per_hour: 800, level_requirement: 15 },
  { name: "Boeing 737-700", type: "narrow_body", passenger_capacity: 155, cargo_capacity_kg: 4700, fuel_consumption_per_hour: 3000, range_nm: 3300, purchase_price: 95000000, maintenance_cost_per_hour: 1050, level_requirement: 16 },
  { name: "Airbus A319", type: "narrow_body", passenger_capacity: 140, cargo_capacity_kg: 3850, fuel_consumption_per_hour: 2600, range_nm: 3300, purchase_price: 85000000, maintenance_cost_per_hour: 950, level_requirement: 16 },
  { name: "Airbus A320neo", type: "narrow_body", passenger_capacity: 180, cargo_capacity_kg: 5000, fuel_consumption_per_hour: 3200, range_nm: 3500, purchase_price: 100000000, maintenance_cost_per_hour: 1200, level_requirement: 17 },
  { name: "Boeing 737 MAX 8", type: "narrow_body", passenger_capacity: 210, cargo_capacity_kg: 5300, fuel_consumption_per_hour: 3500, range_nm: 3500, purchase_price: 105000000, maintenance_cost_per_hour: 1350, level_requirement: 18 },
  { name: "Boeing 787-8", type: "narrow_body", passenger_capacity: 242, cargo_capacity_kg: 4500, fuel_consumption_per_hour: 3800, range_nm: 5000, purchase_price: 140000000, maintenance_cost_per_hour: 1600, level_requirement: 20 },
  { name: "Airbus A300", type: "wide_body", passenger_capacity: 266, cargo_capacity_kg: 11000, fuel_consumption_per_hour: 6500, range_nm: 4800, purchase_price: 150000000, maintenance_cost_per_hour: 2400, level_requirement: 21 },
  { name: "Airbus A330-200F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 70000, fuel_consumption_per_hour: 7000, range_nm: 5550, purchase_price: 185000000, maintenance_cost_per_hour: 2600, level_requirement: 22 },
  { name: "Airbus A330-200", type: "wide_body", passenger_capacity: 295, cargo_capacity_kg: 13600, fuel_consumption_per_hour: 7200, range_nm: 5650, purchase_price: 200000000, maintenance_cost_per_hour: 2800, level_requirement: 23 },
  { name: "Boeing 777-200ER", type: "wide_body", passenger_capacity: 350, cargo_capacity_kg: 20000, fuel_consumption_per_hour: 9200, range_nm: 7065, purchase_price: 260000000, maintenance_cost_per_hour: 3200, level_requirement: 25 },
  { name: "Boeing 777-300ER", type: "wide_body", passenger_capacity: 396, cargo_capacity_kg: 22000, fuel_consumption_per_hour: 10000, range_nm: 7370, purchase_price: 285000000, maintenance_cost_per_hour: 3500, level_requirement: 26 },
  { name: "Airbus A350-900", type: "wide_body", passenger_capacity: 325, cargo_capacity_kg: 16600, fuel_consumption_per_hour: 8200, range_nm: 8000, purchase_price: 300000000, maintenance_cost_per_hour: 3800, level_requirement: 27 },
  { name: "Boeing 777F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 102000, fuel_consumption_per_hour: 9500, range_nm: 4435, purchase_price: 330000000, maintenance_cost_per_hour: 3600, level_requirement: 28 },
  { name: "Boeing 747-8", type: "wide_body", passenger_capacity: 467, cargo_capacity_kg: 21870, fuel_consumption_per_hour: 11200, range_nm: 8000, purchase_price: 360000000, maintenance_cost_per_hour: 4200, level_requirement: 29 },
  { name: "Boeing 747-8F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 134000, fuel_consumption_per_hour: 14500, range_nm: 4120, purchase_price: 400000000, maintenance_cost_per_hour: 4500, level_requirement: 30 },
  { name: "Airbus A380", type: "wide_body", passenger_capacity: 555, cargo_capacity_kg: 18600, fuel_consumption_per_hour: 12500, range_nm: 8000, purchase_price: 440000000, maintenance_cost_per_hour: 5000, level_requirement: 31 }
];

export default function Fleet() {
  const { state } = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  const { data: templates = [] } = useQuery({
    queryKey: ['aircraftTemplates'],
    queryFn: async () => {
      return await base44.entities.AircraftTemplate.list();
    }
  });


  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
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
    enabled: !!currentUser
  });

  const { data: aircraft = [], isLoading } = useQuery({
    queryKey: ['aircraft', company?.id],
    queryFn: async () => {
      return await base44.entities.Aircraft.filter({ company_id: company.id }, '-created_date');
    },
    enabled: !!company?.id,
    refetchInterval: 3000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  const purchaseMutation = useMutation({
    mutationFn: async (aircraftData) => {
      const registration = `${company?.callsign?.slice(0, 2) || 'N'}${String(aircraft.length + 1).padStart(3, '0')}`;
      
      const specs = AIRCRAFT_MARKET_SPECS.find(a => a.name === aircraftData.name) || aircraftData;
      const template = templates.find(t => t.name === aircraftData.name);
      await base44.entities.Aircraft.create({
        ...specs,
        company_id: company.id,
        registration,
        status: 'available',
        total_flight_hours: 0,
        current_value: aircraftData.purchase_price,
        image_url: template?.image_url
      });

      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - aircraftData.purchase_price
        });
        await base44.entities.Transaction.create({
          company_id: company.id,
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

  // Fleet wird jetzt direkt von DB geladen mit refetchInterval, state wird nicht mehr benötigt
  const displayAircraft = aircraft;

  const filteredAircraft = displayAircraft.filter(ac => {
    if (ac.status === 'sold') return false;
    if (ac.status === 'total_loss') return true; // Show total loss so user can scrap
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
  const canPurchase = (ac) => {
    const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
    const hasBalance = canAfford(ac.purchase_price);
    return hasLevel && hasBalance;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Flotte</h1>
              <p className="text-slate-400">Verwalte und erweitere deine Flugzeugflotte</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Flugzeug suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64 bg-slate-800 text-white border-slate-700"
                />
              </div>
              <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30">
                    <Plus className="w-4 h-4 mr-2" />
                    Flugzeug kaufen
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-blue-500/30 shadow-2xl shadow-blue-500/10">
                   <DialogHeader className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 -mx-6 -mt-6 mb-6 px-6 py-4 rounded-t-lg border-b border-slate-700">
                     <div className="flex items-center gap-3">
                       <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg shadow-blue-500/30">
                         <Sparkles className="w-5 h-5 text-white" />
                       </div>
                       <div>
                         <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Flugzeugmarkt</DialogTitle>
                         <p className="text-xs text-slate-400 mt-1">Wähle dein nächstes Flugzeug aus unserer exklusiven Flotte</p>
                       </div>
                     </div>
                   </DialogHeader>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {company && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="col-span-full p-4 bg-gradient-to-r from-emerald-900/30 to-emerald-800/30 border border-emerald-700/50 rounded-lg flex items-center justify-between sticky top-0 z-10"
                      >
                        <span className="text-sm font-semibold text-emerald-300">💰 Verfügbares Budget:</span>
                        <span className="font-bold text-lg text-emerald-400">${company.balance?.toLocaleString()}</span>
                      </motion.div>
                    )}

                    {AIRCRAFT_MARKET_SPECS.map((ac, index) => {
                      // Find template with image
                      const template = templates.find(t => t.name === ac.name);
                      const displayData = { ...ac, image_url: template?.image_url };

                      const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
                      const hasBalance = canAfford(ac.purchase_price);
                      const isPurchasable = hasLevel && hasBalance;

                      return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card 
                          className={`overflow-hidden flex flex-col h-full transition-all border ${
                            isPurchasable 
                              ? 'border-slate-600 hover:border-slate-500 hover:shadow-lg hover:shadow-blue-500/20 cursor-pointer' 
                              : 'border-slate-700 opacity-60'
                          }`}
                        >
                          <div className="relative h-40 bg-gradient-to-br from-slate-700 to-slate-800 overflow-hidden flex-shrink-0">
                            {displayData.image_url && (
                               <motion.img 
                                 src={displayData.image_url}
                                 alt={displayData.name}
                                 className="w-full h-full object-cover"
                                 whileHover={{ scale: 1.05 }}
                                 onError={(e) => {
                                   e.target.style.display = 'none';
                                   const fallback = e.target.parentElement?.querySelector('[data-fallback]');
                                   if (fallback) fallback.style.display = 'flex';
                                 }}
                               />
                            )}
                            <div data-fallback className="absolute inset-0 flex items-center justify-center text-5xl bg-gradient-to-br from-slate-700 to-slate-800" style={{display: displayData.image_url ? 'none' : 'flex'}}>✈️</div>
                          </div>
                          <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 space-y-3 flex flex-col flex-grow">
                            <div>
                              <p className="font-bold text-sm text-white line-clamp-1">{ac.name}</p>
                              <p className="text-xs font-semibold text-blue-400">{typeLabels[ac.type]}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs font-medium flex-grow">
                              <div className="bg-slate-900/60 border border-slate-700 px-2 py-1.5 rounded">
                                <p className="text-slate-400 text-[9px] mb-0.5">Passagiere</p>
                                <p className="text-white text-sm">{ac.passenger_capacity}</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-700 px-2 py-1.5 rounded">
                                <p className="text-slate-400 text-[9px] mb-0.5">Fracht</p>
                                <p className="text-white text-xs">{(ac.cargo_capacity_kg / 1000).toFixed(1)}k</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-700 px-2 py-1.5 rounded">
                                <p className="text-slate-400 text-[9px] mb-0.5">Verbrauch</p>
                                <p className="text-white text-sm">{ac.fuel_consumption_per_hour}</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-700 px-2 py-1.5 rounded">
                                <p className="text-slate-400 text-[9px] mb-0.5">Reichweite</p>
                                <p className="text-white text-sm">{ac.range_nm} NM</p>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-700 space-y-2">
                              <div>
                                <p className="text-xs text-slate-400">Kaufpreis</p>
                                <p className={`text-lg font-bold ${isPurchasable ? 'text-emerald-400' : 'text-red-400'}`}>
                                  ${(ac.purchase_price / 1000000).toFixed(1)}M
                                </p>
                              </div>
                              {!hasLevel && (
                                <p className="text-xs font-semibold text-amber-400 text-center">Level {ac.level_requirement} benötigt</p>
                              )}
                              {hasLevel && !hasBalance && (
                                <p className="text-xs font-semibold text-red-400 text-center">Budget: ${(ac.purchase_price - (company?.balance || 0)).toLocaleString()}</p>
                              )}
                              <Button
                                onClick={() => {
                                  setSelectedAircraft(ac);
                                  purchaseMutation.mutate(ac);
                                }}
                                disabled={!isPurchasable || purchaseMutation.isPending}
                                size="sm"
                                className={`w-full ${isPurchasable ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600'}`}
                              >
                                {purchaseMutation.isPending && selectedAircraft?.name === ac.name ? 'Kaufe...' : 'Kaufen'}
                              </Button>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                    })}
                  </div>

                  <DialogFooter className="gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsPurchaseDialogOpen(false)}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Schließen
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