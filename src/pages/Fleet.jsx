import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plane,
  Sparkles,
  Filter
} from "lucide-react";

import AircraftCard from "@/components/aircraft/AircraftCard";
import InsolvencyBanner from "@/components/InsolvencyBanner";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import { DEFAULT_INSURANCE_PLAN, getInsurancePlanConfig } from '@/lib/insurance';

const AIRCRAFT_MARKET_SPECS = [
  // === SMALL PROPS (Level 1) ===
  { name: "Icon A5", type: "small_prop", passenger_capacity: 1, cargo_capacity_kg: 60, fuel_consumption_per_hour: 23, range_nm: 300, purchase_price: 120000, maintenance_cost_per_hour: 20, level_requirement: 1 },
  { name: "Piper PA-18 Super Cub", type: "small_prop", passenger_capacity: 1, cargo_capacity_kg: 100, fuel_consumption_per_hour: 35, range_nm: 400, purchase_price: 180000, maintenance_cost_per_hour: 30, level_requirement: 1 },
  { name: "Robin DR400", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 120, fuel_consumption_per_hour: 38, range_nm: 550, purchase_price: 200000, maintenance_cost_per_hour: 25, level_requirement: 1 },
  { name: "Cessna 152", type: "small_prop", passenger_capacity: 1, cargo_capacity_kg: 55, fuel_consumption_per_hour: 25, range_nm: 415, purchase_price: 210000, maintenance_cost_per_hour: 20, level_requirement: 1 },
  { name: "Vans RV-10", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 180, fuel_consumption_per_hour: 48, range_nm: 900, purchase_price: 250000, maintenance_cost_per_hour: 35, level_requirement: 1 },
  { name: "Diamond DA40 NG", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 110, fuel_consumption_per_hour: 30, range_nm: 720, purchase_price: 300000, maintenance_cost_per_hour: 28, level_requirement: 1 },
  { name: "Cessna 172 Skyhawk", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 100, fuel_consumption_per_hour: 45, range_nm: 640, purchase_price: 425000, maintenance_cost_per_hour: 25, level_requirement: 1 },
  { name: "Beechcraft Bonanza G36", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 250, fuel_consumption_per_hour: 75, range_nm: 920, purchase_price: 430000, maintenance_cost_per_hour: 55, level_requirement: 1 },
  { name: "Beechcraft Baron 58", type: "small_prop", passenger_capacity: 4, cargo_capacity_kg: 340, fuel_consumption_per_hour: 130, range_nm: 1480, purchase_price: 450000, maintenance_cost_per_hour: 80, level_requirement: 1 },
  { name: "Diamond DA62", type: "small_prop", passenger_capacity: 6, cargo_capacity_kg: 280, fuel_consumption_per_hour: 55, range_nm: 1300, purchase_price: 550000, maintenance_cost_per_hour: 45, level_requirement: 1 },
  { name: "Cessna 208B Grand Caravan", type: "small_prop", passenger_capacity: 9, cargo_capacity_kg: 1100, fuel_consumption_per_hour: 180, range_nm: 900, purchase_price: 580000, maintenance_cost_per_hour: 60, level_requirement: 1 },
  { name: "Cirrus SR22", type: "small_prop", passenger_capacity: 3, cargo_capacity_kg: 180, fuel_consumption_per_hour: 60, range_nm: 1050, purchase_price: 650000, maintenance_cost_per_hour: 50, level_requirement: 1 },

  // === TURBOPROPS (Level 2-4) ===
  { name: "Daher Kodiak 100", type: "turboprop", passenger_capacity: 9, cargo_capacity_kg: 1400, fuel_consumption_per_hour: 200, range_nm: 1132, purchase_price: 750000, maintenance_cost_per_hour: 90, level_requirement: 2 },
  { name: "Lancair Evolution", type: "turboprop", passenger_capacity: 3, cargo_capacity_kg: 200, fuel_consumption_per_hour: 120, range_nm: 1400, purchase_price: 800000, maintenance_cost_per_hour: 100, level_requirement: 2 },
  { name: "Daher TBM 930", type: "turboprop", passenger_capacity: 5, cargo_capacity_kg: 300, fuel_consumption_per_hour: 190, range_nm: 1650, purchase_price: 1200000, maintenance_cost_per_hour: 150, level_requirement: 2 },
  { name: "Beechcraft King Air C90B", type: "turboprop", passenger_capacity: 7, cargo_capacity_kg: 600, fuel_consumption_per_hour: 250, range_nm: 1260, purchase_price: 1800000, maintenance_cost_per_hour: 250, level_requirement: 3 },
  { name: "Pilatus PC-12 NGX", type: "turboprop", passenger_capacity: 9, cargo_capacity_kg: 1100, fuel_consumption_per_hour: 280, range_nm: 1800, purchase_price: 2500000, maintenance_cost_per_hour: 200, level_requirement: 3 },
  { name: "Beechcraft King Air 350i", type: "turboprop", passenger_capacity: 11, cargo_capacity_kg: 800, fuel_consumption_per_hour: 310, range_nm: 1800, purchase_price: 3200000, maintenance_cost_per_hour: 320, level_requirement: 4 },

  // === LIGHT JETS (Level 2-6) ===
  { name: "Cirrus Vision SF50", type: "regional_jet", passenger_capacity: 4, cargo_capacity_kg: 225, fuel_consumption_per_hour: 200, range_nm: 1200, purchase_price: 2900000, maintenance_cost_per_hour: 300, level_requirement: 2 },
  { name: "Honda HA-420 HondaJet", type: "regional_jet", passenger_capacity: 5, cargo_capacity_kg: 280, fuel_consumption_per_hour: 280, range_nm: 1220, purchase_price: 3800000, maintenance_cost_per_hour: 350, level_requirement: 3 },
  { name: "Cessna Citation CJ4", type: "regional_jet", passenger_capacity: 7, cargo_capacity_kg: 350, fuel_consumption_per_hour: 550, range_nm: 2165, purchase_price: 6500000, maintenance_cost_per_hour: 550, level_requirement: 4 },
  { name: "Cessna Citation Longitude", type: "regional_jet", passenger_capacity: 8, cargo_capacity_kg: 500, fuel_consumption_per_hour: 700, range_nm: 3500, purchase_price: 9500000, maintenance_cost_per_hour: 750, level_requirement: 5 },
  { name: "Cessna Citation X", type: "regional_jet", passenger_capacity: 8, cargo_capacity_kg: 450, fuel_consumption_per_hour: 900, range_nm: 3070, purchase_price: 12000000, maintenance_cost_per_hour: 900, level_requirement: 6 },

  // === REGIONAL AIRLINERS (Level 7-14) ===
  { name: "Pilatus PC-24", type: "regional_jet", passenger_capacity: 8, cargo_capacity_kg: 600, fuel_consumption_per_hour: 750, range_nm: 2000, purchase_price: 15000000, maintenance_cost_per_hour: 600, level_requirement: 7 },
  { name: "Bombardier Dash 8-400", type: "turboprop", passenger_capacity: 78, cargo_capacity_kg: 2500, fuel_consumption_per_hour: 700, range_nm: 1550, purchase_price: 25000000, maintenance_cost_per_hour: 250, level_requirement: 9 },
  { name: "ATR 72F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 6000, fuel_consumption_per_hour: 350, range_nm: 2400, purchase_price: 28000000, maintenance_cost_per_hour: 600, level_requirement: 10 },
  { name: "Bombardier CRJ-200", type: "regional_jet", passenger_capacity: 50, cargo_capacity_kg: 1500, fuel_consumption_per_hour: 1600, range_nm: 2000, purchase_price: 35000000, maintenance_cost_per_hour: 350, level_requirement: 11 },
  { name: "Bombardier CRJ-700", type: "regional_jet", passenger_capacity: 66, cargo_capacity_kg: 1800, fuel_consumption_per_hour: 1900, range_nm: 2350, purchase_price: 42000000, maintenance_cost_per_hour: 400, level_requirement: 12 },
  { name: "Embraer E175", type: "regional_jet", passenger_capacity: 76, cargo_capacity_kg: 2000, fuel_consumption_per_hour: 2400, range_nm: 2200, purchase_price: 50000000, maintenance_cost_per_hour: 450, level_requirement: 13 },
  { name: "Airbus A220-300", type: "regional_jet", passenger_capacity: 145, cargo_capacity_kg: 3400, fuel_consumption_per_hour: 2800, range_nm: 3350, purchase_price: 65000000, maintenance_cost_per_hour: 650, level_requirement: 14 },
  { name: "McDonnell Douglas MD-82", type: "narrow_body", passenger_capacity: 155, cargo_capacity_kg: 4500, fuel_consumption_per_hour: 3000, range_nm: 2050, purchase_price: 55000000, maintenance_cost_per_hour: 950, level_requirement: 14 },

  // === NARROW BODY (Level 15-20) ===
  { name: "Airbus A310-300", type: "narrow_body", passenger_capacity: 220, cargo_capacity_kg: 6000, fuel_consumption_per_hour: 4500, range_nm: 4800, purchase_price: 70000000, maintenance_cost_per_hour: 1000, level_requirement: 15 },
  { name: "Airbus A318", type: "narrow_body", passenger_capacity: 108, cargo_capacity_kg: 3200, fuel_consumption_per_hour: 2200, range_nm: 3100, purchase_price: 75000000, maintenance_cost_per_hour: 800, level_requirement: 15 },
  { name: "Boeing 737-700", type: "narrow_body", passenger_capacity: 148, cargo_capacity_kg: 4200, fuel_consumption_per_hour: 2900, range_nm: 3250, purchase_price: 82000000, maintenance_cost_per_hour: 1000, level_requirement: 15 },
  { name: "Airbus A319", type: "narrow_body", passenger_capacity: 140, cargo_capacity_kg: 3850, fuel_consumption_per_hour: 2600, range_nm: 3300, purchase_price: 85000000, maintenance_cost_per_hour: 950, level_requirement: 16 },
  { name: "Boeing 737-800", type: "narrow_body", passenger_capacity: 189, cargo_capacity_kg: 5200, fuel_consumption_per_hour: 3200, range_nm: 3195, purchase_price: 98000000, maintenance_cost_per_hour: 1100, level_requirement: 16 },
  { name: "Airbus A320neo", type: "narrow_body", passenger_capacity: 180, cargo_capacity_kg: 5000, fuel_consumption_per_hour: 3200, range_nm: 3500, purchase_price: 100000000, maintenance_cost_per_hour: 1200, level_requirement: 17 },
  { name: "Boeing 737 MAX 8", type: "narrow_body", passenger_capacity: 210, cargo_capacity_kg: 5300, fuel_consumption_per_hour: 3500, range_nm: 3500, purchase_price: 105000000, maintenance_cost_per_hour: 1350, level_requirement: 18 },
  { name: "Boeing 757-200", type: "narrow_body", passenger_capacity: 228, cargo_capacity_kg: 5800, fuel_consumption_per_hour: 3800, range_nm: 3900, purchase_price: 115000000, maintenance_cost_per_hour: 1400, level_requirement: 18 },
  { name: "Airbus A321neo", type: "narrow_body", passenger_capacity: 220, cargo_capacity_kg: 5800, fuel_consumption_per_hour: 3600, range_nm: 4000, purchase_price: 120000000, maintenance_cost_per_hour: 1450, level_requirement: 19 },
  { name: "Boeing 787-8", type: "narrow_body", passenger_capacity: 242, cargo_capacity_kg: 4500, fuel_consumption_per_hour: 3800, range_nm: 5000, purchase_price: 140000000, maintenance_cost_per_hour: 1600, level_requirement: 20 },
  { name: "Boeing 787-10", type: "narrow_body", passenger_capacity: 330, cargo_capacity_kg: 5500, fuel_consumption_per_hour: 4200, range_nm: 6430, purchase_price: 155000000, maintenance_cost_per_hour: 1800, level_requirement: 20 },

  // === WIDE BODY (Level 21-31) ===
  { name: "Airbus A300", type: "wide_body", passenger_capacity: 266, cargo_capacity_kg: 11000, fuel_consumption_per_hour: 6500, range_nm: 4800, purchase_price: 150000000, maintenance_cost_per_hour: 2400, level_requirement: 21 },
  { name: "Boeing 767-300ER", type: "wide_body", passenger_capacity: 290, cargo_capacity_kg: 13000, fuel_consumption_per_hour: 7000, range_nm: 5990, purchase_price: 170000000, maintenance_cost_per_hour: 2500, level_requirement: 21 },
  { name: "Airbus A330-200F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 70000, fuel_consumption_per_hour: 7000, range_nm: 5550, purchase_price: 185000000, maintenance_cost_per_hour: 2600, level_requirement: 22 },
  { name: "Airbus A330-900neo", type: "wide_body", passenger_capacity: 440, cargo_capacity_kg: 15500, fuel_consumption_per_hour: 7200, range_nm: 6550, purchase_price: 210000000, maintenance_cost_per_hour: 2800, level_requirement: 22 },
  { name: "Airbus A330-300", type: "wide_body", passenger_capacity: 440, cargo_capacity_kg: 15200, fuel_consumption_per_hour: 7500, range_nm: 6350, purchase_price: 220000000, maintenance_cost_per_hour: 3000, level_requirement: 23 },
  { name: "Boeing 747-400", type: "wide_body", passenger_capacity: 416, cargo_capacity_kg: 20000, fuel_consumption_per_hour: 11000, range_nm: 7260, purchase_price: 240000000, maintenance_cost_per_hour: 3800, level_requirement: 24 },
  { name: "Boeing 777-200ER", type: "wide_body", passenger_capacity: 350, cargo_capacity_kg: 20000, fuel_consumption_per_hour: 9200, range_nm: 7065, purchase_price: 260000000, maintenance_cost_per_hour: 3200, level_requirement: 25 },
  { name: "Boeing 777-300ER", type: "wide_body", passenger_capacity: 396, cargo_capacity_kg: 22000, fuel_consumption_per_hour: 10000, range_nm: 7370, purchase_price: 285000000, maintenance_cost_per_hour: 3500, level_requirement: 26 },
  { name: "Airbus A350-900", type: "wide_body", passenger_capacity: 325, cargo_capacity_kg: 16600, fuel_consumption_per_hour: 8200, range_nm: 8000, purchase_price: 300000000, maintenance_cost_per_hour: 3800, level_requirement: 27 },
  { name: "Boeing 777F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 102000, fuel_consumption_per_hour: 9500, range_nm: 4435, purchase_price: 330000000, maintenance_cost_per_hour: 3600, level_requirement: 28 },
  { name: "Boeing 747-8", type: "wide_body", passenger_capacity: 467, cargo_capacity_kg: 21870, fuel_consumption_per_hour: 11200, range_nm: 8000, purchase_price: 360000000, maintenance_cost_per_hour: 4200, level_requirement: 29 },
  { name: "Boeing 747-8F", type: "cargo", passenger_capacity: 0, cargo_capacity_kg: 134000, fuel_consumption_per_hour: 14500, range_nm: 4120, purchase_price: 400000000, maintenance_cost_per_hour: 4500, level_requirement: 30 },
  { name: "Airbus A380", type: "wide_body", passenger_capacity: 555, cargo_capacity_kg: 18600, fuel_consumption_per_hour: 12500, range_nm: 8000, purchase_price: 440000000, maintenance_cost_per_hour: 5000, level_requirement: 31 },
];

export default function Fleet() {
  const { state } = useLocation();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [marketSearch, setMarketSearch] = useState('');
  const [marketType, setMarketType] = useState('all');

  const { data: templates = [] } = useQuery({
    queryKey: ['aircraftTemplates'],
    queryFn: async () => {
      return await base44.entities.AircraftTemplate.list();
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });


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

  const { data: aircraft = [], isLoading } = useQuery({
    queryKey: ['aircraft', company?.id],
    queryFn: async () => {
      return await base44.entities.Aircraft.filter({ company_id: company.id }, '-created_date');
    },
    enabled: !!company?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (aircraftData) => {
      const callsignPrefix = company?.callsign || 'N';
      const aircraftCount = aircraft.filter(a => a.status !== 'sold').length;
      const registration = `${callsignPrefix}-${String(aircraftCount + 1).padStart(3, '0')}`;
      
      const specs = AIRCRAFT_MARKET_SPECS.find(a => a.name === aircraftData.name) || aircraftData;
      const template = templates.find(t => t.name === aircraftData.name);
      const defaultInsurance = getInsurancePlanConfig(DEFAULT_INSURANCE_PLAN);
      await base44.entities.Aircraft.create({
        ...specs,
        company_id: company.id,
        registration,
        status: 'available',
        total_flight_hours: 0,
        current_value: aircraftData.purchase_price,
        image_url: template?.image_url,
        insurance_plan: defaultInsurance.key,
        insurance_hourly_rate_pct: defaultInsurance.hourlyRatePctOfNewValue,
        insurance_maintenance_coverage_pct: defaultInsurance.maintenanceCoveragePct,
        insurance_score_bonus_pct: defaultInsurance.scoreBonusPct
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
          description: `${lang === 'de' ? 'Kauf' : 'Purchase'}: ${aircraftData.name}`,
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
    small_prop: t('propeller', lang),
    turboprop: t('turboprop', lang),
    regional_jet: t('regional', lang),
    narrow_body: t('narrow_body', lang),
    wide_body: t('wide_body', lang),
    cargo: t('cargo_type', lang)
  };

  const canAfford = (price) => (company?.balance || 0) >= price;
  const canPurchase = (ac) => {
    const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
    const hasBalance = canAfford(ac.purchase_price);
    return hasLevel && hasBalance;
  };

  const marketAircraft = useMemo(() => {
    return AIRCRAFT_MARKET_SPECS.filter((ac) => {
      const matchesType = marketType === 'all' ? true : ac.type === marketType;
      const q = marketSearch.trim().toLowerCase();
      const matchesSearch = !q
        ? true
        : ac.name.toLowerCase().includes(q) || String(ac.level_requirement || 1).includes(q);
      return matchesType && matchesSearch;
    });
  }, [marketSearch, marketType]);

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Zibo Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-slate-900/90 to-cyan-950/40 border border-cyan-700/30 p-2 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.1)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/30">
            <Plane className="w-4 h-4 text-cyan-300" />
          </span>
          <div className="text-lg font-mono font-bold text-cyan-300 uppercase tracking-widest px-1">{t('fleet', lang)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cyan-600" />
            <Input
              placeholder={t('search_aircraft', lang).toUpperCase()}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-[10px] font-mono w-32 sm:w-48 bg-slate-950 border-cyan-900/50 text-cyan-100 placeholder:text-cyan-900"
            />
          </div>
          <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 text-[10px] font-mono uppercase bg-gradient-to-r from-emerald-800/70 to-cyan-800/70 text-emerald-100 border border-emerald-400/40 hover:from-emerald-700/80 hover:to-cyan-700/80">
                <Sparkles className="w-3 h-3 mr-1" />
                {t('buy_aircraft', lang)}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-cyan-800 shadow-2xl">
               <DialogHeader>
                 <DialogTitle className="text-xl font-mono text-cyan-300 uppercase flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {t('aircraft_market', lang)}
                 </DialogTitle>
                 <p className="text-[10px] font-mono text-cyan-500/80 uppercase">{t('choose_next_aircraft', lang)}</p>
               </DialogHeader>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {company && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="col-span-full p-2 bg-emerald-950/40 border border-emerald-900/50 rounded flex items-center justify-between sticky top-0 z-10 font-mono"
                  >
                    <span className="text-[10px] text-emerald-600 uppercase">{t('available_budget', lang)}:</span>
                    <span className="font-bold text-sm text-emerald-400">${company.balance?.toLocaleString()}</span>
                  </motion.div>
                )}

                <div className="col-span-full sticky top-10 z-10 p-2 rounded border border-cyan-900/40 bg-slate-950/90 backdrop-blur-sm">
                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cyan-700" />
                      <Input
                        placeholder={lang === 'de' ? 'Markt durchsuchen...' : 'Search market...'}
                        value={marketSearch}
                        onChange={(e) => setMarketSearch(e.target.value)}
                        className="pl-7 h-8 text-xs font-mono bg-slate-900 border-cyan-900/50 text-cyan-100"
                      />
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto">
                      <span className="text-[10px] text-cyan-600 uppercase font-mono flex items-center gap-1"><Filter className="w-3 h-3" />TYPE</span>
                      {['all', ...Object.keys(typeLabels)].map((type) => (
                        <Button
                          key={type}
                          size="sm"
                          variant="outline"
                          onClick={() => setMarketType(type)}
                          className={`h-7 text-[10px] font-mono uppercase border ${marketType === type ? 'border-cyan-500 bg-cyan-900/30 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-400'}`}
                        >
                          {type === 'all' ? 'ALL' : typeLabels[type]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {marketAircraft.map((ac, index) => {
                  const template = templates.find(t => t.name === ac.name);
                  const displayData = { ...ac, image_url: template?.image_url };
                  const hasLevel = (company?.level || 1) >= (ac.level_requirement || 1);
                  const hasBalance = canAfford(ac.purchase_price);
                  const isPurchasable = hasLevel && hasBalance;

                  return (
                  <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Card className={`overflow-hidden flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 border ${isPurchasable ? 'border-cyan-800/60 hover:border-cyan-400/60 cursor-pointer' : 'border-slate-800 opacity-60'} transition-all duration-200 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)]`}>
                      {displayData.image_url && (
                        <div className="h-24 w-full overflow-hidden border-b border-cyan-900/30">
                          <img src={displayData.image_url} alt={ac.name} className="h-full w-full object-cover opacity-85 hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                      <div className="p-3 flex flex-col flex-grow">
                        <div className="mb-2 border-b border-cyan-900/30 pb-2">
                          <p className="font-bold text-xs text-white uppercase truncate">{ac.name}</p>
                          <p className="text-[10px] text-cyan-600">{typeLabels[ac.type]?.toUpperCase()}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-mono mb-3">
                          <div className="flex justify-between"><span className="text-slate-500">PAX</span><span className="text-cyan-100">{ac.passenger_capacity}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">CGO</span><span className="text-cyan-100">{ac.cargo_capacity_kg}kg</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">BURN</span><span className="text-cyan-100">{ac.fuel_consumption_per_hour}L/h</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">RNG</span><span className="text-cyan-100">{ac.range_nm}NM</span></div>
                          <div className="flex justify-between col-span-2"><span className="text-slate-500">MIN LVL</span><span className={hasLevel ? 'text-emerald-400' : 'text-amber-400'}>{ac.level_requirement || 1}</span></div>
                        </div>
                        <div className="mt-auto space-y-2">
                          <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                            <span className="text-[10px] text-slate-500">PRICE</span>
                            <span className={`text-sm font-bold ${isPurchasable ? 'text-emerald-400' : 'text-red-400'}`}>${(ac.purchase_price / 1000000).toFixed(1)}M</span>
                          </div>
                          {!hasLevel && <p className="text-[9px] text-amber-500 text-center">{t('level_required', lang).replace('{0}', ac.level_requirement)}</p>}
                          <Button
                            onClick={() => { setSelectedAircraft(ac); purchaseMutation.mutate(ac); }}
                            disabled={!isPurchasable || purchaseMutation.isPending}
                            size="sm"
                            className={`w-full h-7 text-[10px] font-mono uppercase ${isPurchasable ? 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}
                          >
                            {purchaseMutation.isPending && selectedAircraft?.name === ac.name ? t('buying', lang) : t('buy', lang)}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                  );
                })}
                {marketAircraft.length === 0 && (
                  <div className="col-span-full p-6 border border-slate-800 rounded text-center text-slate-400 text-xs font-mono">
                    {lang === 'de' ? 'Keine Flugzeuge für diesen Filter gefunden.' : 'No aircraft found for this filter.'}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setIsPurchaseDialogOpen(false)} className="bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono h-8">
                  {t('close', lang).toUpperCase()}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <InsolvencyBanner />

      <div className="flex-1 overflow-y-auto min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-2">
          <TabsList className="bg-slate-900/80 border border-cyan-900/30 flex-wrap h-auto p-0.5 rounded-lg w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1">ALL</TabsTrigger>
            {Object.entries(typeLabels).map(([type, label]) => (
              <TabsTrigger key={type} value={type} className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1">{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Aircraft Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {[1, 2, 3, 4].map((i) => <Card key={i} className="h-32 animate-pulse bg-slate-900 border-cyan-900/30" />)}
          </div>
        ) : filteredAircraft.length > 0 ? (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2" layout>
            <AnimatePresence>
              {filteredAircraft.map((ac) => (
                <AircraftCard key={ac.id} aircraft={ac} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Card className="p-8 text-center bg-slate-900/80 border border-cyan-900/30 flex flex-col items-center">
            <Plane className="w-10 h-10 text-cyan-900 mx-auto mb-2" />
            <h3 className="text-sm font-mono text-cyan-600 mb-1">{t('no_aircraft', lang).toUpperCase()}</h3>
          </Card>
        )}
      </div>
    </div>
  );
}
