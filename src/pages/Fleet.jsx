import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
    level_requirement: 1,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Cessna_172_Skyhawk.jpg/1024px-Cessna_172_Skyhawk.jpg"
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
    level_requirement: 1,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Piper_PA-44-180_Seminole_N2445.jpg/1024px-Piper_PA-44-180_Seminole_N2445.jpg"
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
    level_requirement: 2,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Beechcraft_King_Air_B200_8.jpg/1024px-Beechcraft_King_Air_B200_8.jpg"
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
    level_requirement: 2,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Cessna_Caravan_206H_Rwd.jpg/1024px-Cessna_Caravan_206H_Rwd.jpg"
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
    level_requirement: 3,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Bombardier_Q400_taxiing.jpg/1024px-Bombardier_Q400_taxiing.jpg"
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
    level_requirement: 4,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Embraer_ERJ-175_5Y-CVK_SkyWest.jpg/1024px-Embraer_ERJ-175_5Y-CVK_SkyWest.jpg"
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
    level_requirement: 5,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Airbus_A220-300_LZQO.jpg/1024px-Airbus_A220-300_LZQO.jpg"
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
    level_requirement: 6,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Airbus_A320neo_Lufthansa_D-AINN_01.jpg/1024px-Airbus_A320neo_Lufthansa_D-AINN_01.jpg"
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
    level_requirement: 7,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/KBWI_-_Southwest_Airlines_N8646Q_-_Flickr_-_Photo_Encoding.jpg/1024px-KBWI_-_Southwest_Airlines_N8646Q_-_Flickr_-_Photo_Encoding.jpg"
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
    level_requirement: 8,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/ANA_B787-8_34A.jpg/1024px-ANA_B787-8_34A.jpg"
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
    level_requirement: 10,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Malaysia_Airlines_Airbus_A330-223_-_9M-MQB.jpg/1024px-Malaysia_Airlines_Airbus_A330-223_-_9M-MQB.jpg"
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
    level_requirement: 12,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/United_Airlines_N228UA_-_B777-322ER.jpg/1024px-United_Airlines_N228UA_-_B777-322ER.jpg"
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
    level_requirement: 13,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Airbus_A350-941_F-WXWB_2_Qatar_Airways_2019.jpg/1024px-Airbus_A350-941_F-WXWB_2_Qatar_Airways_2019.jpg"
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
    level_requirement: 15,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Lufthansa_Boeing_747-830_Liotard-1.jpg/1024px-Lufthansa_Boeing_747-830_Liotard-1.jpg"
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
    level_requirement: 20,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/A380_Singapore_Airlines_%289M-SKA%29_%284%29.jpg/1024px-A380_Singapore_Airlines_%289M-SKA%29_%284%29.jpg"
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
    level_requirement: 12,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/FedEx_Boeing_777F_N869FD_2.jpg/1024px-FedEx_Boeing_777F_N869FD_2.jpg"
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
    level_requirement: 15,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Cargo_Boeing_747-400F.jpg/1024px-Cargo_Boeing_747-400F.jpg"
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
    level_requirement: 10,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Airbus_A330-223F.jpg/1024px-Airbus_A330-223F.jpg"
  }
];

export default function Fleet() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  // Nutze AUSSCHLIESSLICH die Daten aus Navigation State von CompletedFlightDetails
  const aircraft = state?.updatedAircraft ? [state.updatedAircraft] : [];
  const isLoading = false;

  // Wenn kein State vorhanden, zeige Meldung
  if (!state?.updatedAircraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Card className="p-8 bg-slate-800 border-slate-700 text-center max-w-md">
          <Plane className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Keine Flugzeugdaten verfügbar</h2>
          <p className="text-slate-400 mb-6">Navigiere von einer abgeschlossenen Auftragsseite, um die aktualisierte Flotte zu sehen</p>
          <Button onClick={() => navigate(createPageUrl("CompletedFlightDetails"))} className="bg-blue-600 hover:bg-blue-700">
            Zu abgeschlossenen Aufträgen
          </Button>
        </Card>
      </div>
    );
  }

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
      (async () => {
        const aircraftList = await base44.entities.Aircraft.list('-created_date');
        setFleetAircraft(aircraftList);
      })();
      queryClient.invalidateQueries({ queryKey: ['company'] });
      setIsPurchaseDialogOpen(false);
      setSelectedAircraft(null);
    }
  });

  // Fleet wird jetzt direkt von DB geladen mit refetchInterval, state wird nicht mehr benötigt
  const displayAircraft = aircraft;

  const filteredAircraft = displayAircraft.filter(ac => {
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
  const canPurchase = (ac) => {
    const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
    const hasBalance = canAfford(ac.purchase_price);
    return hasLevel && hasBalance;
  };

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
                  
                  <div className="space-y-3">
                    {company && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-gradient-to-r from-emerald-900/30 to-emerald-800/30 border border-emerald-700/50 rounded-lg flex items-center justify-between sticky top-0 z-10"
                      >
                        <span className="text-sm font-semibold text-emerald-300">💰 Verfügbares Budget:</span>
                        <span className="font-bold text-lg text-emerald-400">${company.balance?.toLocaleString()}</span>
                      </motion.div>
                    )}

                    {AIRCRAFT_MARKET.map((ac, index) => {
                      const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
                      const hasBalance = canAfford(ac.purchase_price);
                      const isPurchasable = hasLevel && hasBalance;
                      
                      return (
                      <motion.div
                        key={index}
                        whileHover={isPurchasable ? { scale: 1.02 } : {}}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      >
                        <Card 
                          className={`overflow-hidden cursor-pointer transition-all border-2 ${
                            selectedAircraft?.name === ac.name 
                              ? 'border-blue-500 bg-blue-900/20' 
                              : isPurchasable 
                                ? 'border-slate-600 hover:border-slate-500 hover:shadow-lg hover:shadow-blue-500/20' 
                                : 'border-slate-700 opacity-60'
                          }`}
                          onClick={() => isPurchasable && setSelectedAircraft(ac)}
                        >
                          <div className="relative h-56 bg-gradient-to-br from-slate-700 to-slate-800 overflow-hidden">
                            {ac.image_url ? (
                              <motion.img 
                                src={ac.image_url}
                                alt={ac.name}
                                className="w-full h-full object-cover"
                                whileHover={{ scale: 1.05 }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const sibling = e.target.nextElementSibling;
                                  if (sibling) sibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center text-6xl bg-gradient-to-br from-slate-700 to-slate-800" style={{display: ac.image_url ? 'none' : 'flex'}}>✈️</div>
                            {selectedAircraft?.name === ac.name && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 bg-blue-500/30 border-2 border-blue-400"
                              />
                            )}
                          </div>
                          <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 space-y-4">
                            <div>
                              <p className="font-bold text-lg text-white">{ac.name}</p>
                              <p className="text-xs font-semibold text-blue-400 mt-1">{typeLabels[ac.type]}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                              <div className="bg-slate-900/60 border border-slate-700 px-3 py-2 rounded-lg">
                                <p className="text-slate-400 text-[10px] mb-1">PASSAGIERE</p>
                                <p className="text-white">{ac.passenger_capacity}</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-700 px-3 py-2 rounded-lg">
                                <p className="text-slate-400 text-[10px] mb-1">FRACHT</p>
                                <p className="text-white">{ac.cargo_capacity_kg?.toLocaleString()} kg</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-700 px-3 py-2 rounded-lg">
                                <p className="text-slate-400 text-[10px] mb-1">VERBRAUCH</p>
                                <p className="text-white">{ac.fuel_consumption_per_hour} L/h</p>
                              </div>
                              <div className="bg-slate-900/60 border border-slate-700 px-3 py-2 rounded-lg">
                                <p className="text-slate-400 text-[10px] mb-1">REICHWEITE</p>
                                <p className="text-white">{ac.range_nm?.toLocaleString()} NM</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                              <div>
                                <p className="text-xs text-slate-400 mb-1">KAUFPREIS</p>
                                <p className={`text-xl font-bold ${isPurchasable ? 'text-emerald-400' : 'text-red-400'}`}>
                                  ${ac.purchase_price?.toLocaleString()}
                                </p>
                                {ac.level_requirement && ac.level_requirement > 1 && (
                                  <p className="text-xs text-amber-400 mt-1">Level {ac.level_requirement} benötigt</p>
                                )}
                              </div>
                              {!hasLevel && (
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-amber-400">Level zu niedrig</p>
                                  <p className="text-[10px] text-slate-400 mt-1">Level {ac.level_requirement} benötigt</p>
                                </div>
                              )}
                              {hasLevel && !hasBalance && (
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-red-400">Zu teuer</p>
                                  <p className="text-[10px] text-slate-400 mt-1">${(ac.purchase_price - (company?.balance || 0)).toLocaleString()} mehr</p>
                                </div>
                              )}
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
                      Abbrechen
                    </Button>
                    <Button
                      onClick={() => purchaseMutation.mutate(selectedAircraft)}
                      disabled={!selectedAircraft || purchaseMutation.isPending}
                      className={`${selectedAircraft ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30' : 'bg-slate-600'}`}
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