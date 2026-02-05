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
  DollarSign,
  Sparkles
} from "lucide-react";

import AircraftCard from "@/components/aircraft/AircraftCard";

const AIRCRAFT_MARKET = [
  {
    name: "Cessna 172 Skyhawk",
    type: "small_prop",
    passenger_capacity: 3,
    cargo_capacity_kg: 100,
    fuel_consumption_per_hour: 45,
    range_nm: 640,
    purchase_price: 150000,
    maintenance_cost_per_hour: 25,
    image_url: "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=400&h=300&fit=crop"
  },
  {
    name: "Piper PA-44 Seminole",
    type: "small_prop",
    passenger_capacity: 4,
    cargo_capacity_kg: 150,
    fuel_consumption_per_hour: 55,
    range_nm: 750,
    purchase_price: 200000,
    maintenance_cost_per_hour: 35,
    image_url: "https://images.unsplash.com/photo-1544794221-8b78a403e99e?w=400&h=300&fit=crop"
  },
  {
    name: "Beechcraft King Air 350",
    type: "turboprop",
    passenger_capacity: 8,
    cargo_capacity_kg: 350,
    fuel_consumption_per_hour: 350,
    range_nm: 1800,
    purchase_price: 750000,
    maintenance_cost_per_hour: 120,
    image_url: "https://images.unsplash.com/photo-1570720803582-6ea8a4f62da1?w=400&h=300&fit=crop"
  },
  {
    name: "Cessna Caravan",
    type: "turboprop",
    passenger_capacity: 14,
    cargo_capacity_kg: 1500,
    fuel_consumption_per_hour: 280,
    range_nm: 1200,
    purchase_price: 400000,
    maintenance_cost_per_hour: 90,
    image_url: "https://images.unsplash.com/photo-1562109280-4ff9ee6b2f56?w=400&h=300&fit=crop"
  },
  {
    name: "Bombardier Q400",
    type: "turboprop",
    passenger_capacity: 78,
    cargo_capacity_kg: 2700,
    fuel_consumption_per_hour: 850,
    range_nm: 1700,
    purchase_price: 1400000,
    maintenance_cost_per_hour: 280,
    image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop"
  },
  {
    name: "Embraer E175",
    type: "regional_jet",
    passenger_capacity: 76,
    cargo_capacity_kg: 2000,
    fuel_consumption_per_hour: 2400,
    range_nm: 2200,
    purchase_price: 2500000,
    maintenance_cost_per_hour: 450,
    image_url: "https://images.unsplash.com/photo-1552819125-81b7e8c1c98a?w=400&h=300&fit=crop"
  },
  {
    name: "Airbus A220",
    type: "regional_jet",
    passenger_capacity: 130,
    cargo_capacity_kg: 3400,
    fuel_consumption_per_hour: 2800,
    range_nm: 2800,
    purchase_price: 4200000,
    maintenance_cost_per_hour: 650,
    image_url: "https://images.unsplash.com/photo-1570718436944-bc21b3b01a71?w=400&h=300&fit=crop"
  },
  {
    name: "Airbus A320neo",
    type: "narrow_body",
    passenger_capacity: 180,
    cargo_capacity_kg: 5000,
    fuel_consumption_per_hour: 3200,
    range_nm: 3500,
    purchase_price: 12000000,
    maintenance_cost_per_hour: 1200,
    image_url: "https://images.unsplash.com/photo-1569015615565-1f8c7fb53d63?w=400&h=300&fit=crop"
  },
  {
    name: "Boeing 737 MAX 8",
    type: "narrow_body",
    passenger_capacity: 210,
    cargo_capacity_kg: 5300,
    fuel_consumption_per_hour: 3500,
    range_nm: 3500,
    purchase_price: 13500000,
    maintenance_cost_per_hour: 1350,
    image_url: "https://images.unsplash.com/photo-1567794348618-8d34755c16da?w=400&h=300&fit=crop"
  },
  {
    name: "Boeing 787-8",
    type: "narrow_body",
    passenger_capacity: 242,
    cargo_capacity_kg: 4500,
    fuel_consumption_per_hour: 3800,
    range_nm: 5000,
    purchase_price: 18000000,
    maintenance_cost_per_hour: 1600,
    image_url: "https://images.unsplash.com/photo-1564622246329-d0b3b9c7f7b8?w=400&h=300&fit=crop"
  },
  {
    name: "Airbus A330-200",
    type: "wide_body",
    passenger_capacity: 295,
    cargo_capacity_kg: 13600,
    fuel_consumption_per_hour: 7200,
    range_nm: 5650,
    purchase_price: 25000000,
    maintenance_cost_per_hour: 2800,
    image_url: "https://images.unsplash.com/photo-1608449662850-e08b0e0b6110?w=400&h=300&fit=crop"
  },
  {
    name: "Boeing 777-300ER",
    type: "wide_body",
    passenger_capacity: 396,
    cargo_capacity_kg: 22000,
    fuel_consumption_per_hour: 10000,
    range_nm: 7370,
    purchase_price: 35000000,
    maintenance_cost_per_hour: 3500,
    image_url: "https://images.unsplash.com/photo-1476519622667-75898657ea14?w=400&h=300&fit=crop"
  },
  {
    name: "Airbus A350-900",
    type: "wide_body",
    passenger_capacity: 325,
    cargo_capacity_kg: 16600,
    fuel_consumption_per_hour: 8200,
    range_nm: 8000,
    purchase_price: 38000000,
    maintenance_cost_per_hour: 3800,
    image_url: "https://images.unsplash.com/photo-1579783902614-e3fb5141b0cb?w=400&h=300&fit=crop"
  },
  {
    name: "Boeing 747-8",
    type: "wide_body",
    passenger_capacity: 467,
    cargo_capacity_kg: 21870,
    fuel_consumption_per_hour: 11200,
    range_nm: 8000,
    purchase_price: 45000000,
    maintenance_cost_per_hour: 4200,
    image_url: "https://images.unsplash.com/photo-1544794221-e9fdf7fc3c3b?w=400&h=300&fit=crop"
  },
  {
    name: "Airbus A380",
    type: "wide_body",
    passenger_capacity: 555,
    cargo_capacity_kg: 18600,
    fuel_consumption_per_hour: 12500,
    range_nm: 8000,
    purchase_price: 55000000,
    maintenance_cost_per_hour: 5000,
    image_url: "https://images.unsplash.com/photo-1571996477506-de9c812b3434?w=400&h=300&fit=crop"
  },
  {
    name: "Boeing 777F",
    type: "cargo",
    passenger_capacity: 0,
    cargo_capacity_kg: 102000,
    fuel_consumption_per_hour: 9500,
    range_nm: 4435,
    purchase_price: 38000000,
    maintenance_cost_per_hour: 3600,
    image_url: "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=400&h=300&fit=crop"
  },
  {
    name: "Boeing 747-8F",
    type: "cargo",
    passenger_capacity: 0,
    cargo_capacity_kg: 134000,
    fuel_consumption_per_hour: 14500,
    range_nm: 4120,
    purchase_price: 42000000,
    maintenance_cost_per_hour: 4500,
    image_url: "https://images.unsplash.com/photo-1568839419197-e5fa7eda60a8?w=400&h=300&fit=crop"
  },
  {
    name: "Airbus A330-200F",
    type: "cargo",
    passenger_capacity: 0,
    cargo_capacity_kg: 70000,
    fuel_consumption_per_hour: 7000,
    range_nm: 5550,
    purchase_price: 24000000,
    maintenance_cost_per_hour: 2600,
    image_url: "https://images.unsplash.com/photo-1493514789560-586cb221a7f7?w=400&h=300&fit=crop"
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
        total_flight_hours: 0,
        current_value: aircraftData.purchase_price
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
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30">
                    <Plus className="w-4 h-4 mr-2" />
                    Flugzeug kaufen
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700">
                  <DialogHeader>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-400" />
                      <DialogTitle className="text-2xl">Flugzeugmarkt</DialogTitle>
                    </div>
                  </DialogHeader>
                  
                  <div className="space-y-3">
                    {company && (
                      <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between sticky top-0">
                        <span className="text-sm text-slate-600">Verfügbares Budget:</span>
                        <span className="font-bold text-slate-900">${company.balance?.toLocaleString()}</span>
                      </div>
                    )}

                    {AIRCRAFT_MARKET.map((ac, index) => (
                      <motion.div
                        key={index}
                        whileHover={canAfford(ac.purchase_price) ? { scale: 1.02 } : {}}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      >
                        <Card 
                          className={`overflow-hidden cursor-pointer transition-all border-2 ${
                            selectedAircraft?.name === ac.name 
                              ? 'border-blue-500 bg-blue-900/20' 
                              : canAfford(ac.purchase_price) 
                                ? 'border-slate-600 hover:border-slate-500 hover:shadow-lg hover:shadow-blue-500/20' 
                                : 'border-slate-700 opacity-60'
                          }`}
                          onClick={() => canAfford(ac.purchase_price) && setSelectedAircraft(ac)}
                        >
                          <div className="relative h-48 bg-gradient-to-br from-slate-700 to-slate-800 overflow-hidden">
                            {ac.image_url ? (
                              <motion.img 
                                src={ac.image_url}
                                alt={ac.name}
                                className="w-full h-full object-cover"
                                whileHover={{ scale: 1.05 }}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-6xl">✈️</div>
                            )}
                            {selectedAircraft?.name === ac.name && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 bg-blue-500/30 border-2 border-blue-400"
                              />
                            )}
                          </div>
                          <div className="p-4 bg-slate-800">
                            <div className="mb-3">
                              <p className="font-bold text-lg text-white">{ac.name}</p>
                              <p className="text-sm text-slate-400">{typeLabels[ac.type]}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-slate-300">
                              <span className="bg-slate-900 px-2 py-1 rounded">🪑 {ac.passenger_capacity}</span>
                              <span className="bg-slate-900 px-2 py-1 rounded">📦 {ac.cargo_capacity_kg?.toLocaleString()}</span>
                              <span className="bg-slate-900 px-2 py-1 rounded">⛽ {ac.fuel_consumption_per_hour}L/h</span>
                              <span className="bg-slate-900 px-2 py-1 rounded">✈️ {ac.range_nm?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                              <p className={`text-lg font-bold ${canAfford(ac.purchase_price) ? 'text-emerald-400' : 'text-red-400'}`}>
                                ${ac.purchase_price?.toLocaleString()}
                              </p>
                              {!canAfford(ac.purchase_price) && (
                                <p className="text-xs text-red-400">Zu teuer</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
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