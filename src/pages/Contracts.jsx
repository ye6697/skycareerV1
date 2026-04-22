import React, { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search,
  Users,
  Package,
  Star,
  Clock,
  Plane,
  RefreshCw
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import ContractCard from "@/components/contracts/ContractCard";
import HangarWorldGlobe3D from "@/components/contracts/HangarWorldGlobe3D";
import { AlertCircle, Loader2, Wrench } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import { getAirportCoords } from "@/utils/airportCoordinates";

const HANGAR_MARKET = [
  { airport_icao: 'EDDF', label: 'Frankfurt' },
  { airport_icao: 'EGLL', label: 'London Heathrow' },
  { airport_icao: 'LFPG', label: 'Paris CDG' },
  { airport_icao: 'LEMD', label: 'Madrid' },
  { airport_icao: 'LIRF', label: 'Rome Fiumicino' },
  { airport_icao: 'KJFK', label: 'New York JFK' },
  { airport_icao: 'KLAX', label: 'Los Angeles' },
  { airport_icao: 'KORD', label: 'Chicago O’Hare' },
  { airport_icao: 'KATL', label: 'Atlanta' },
  { airport_icao: 'CYYZ', label: 'Toronto' },
  { airport_icao: 'MMMX', label: 'Mexico City' },
  { airport_icao: 'SBGR', label: 'São Paulo' },
  { airport_icao: 'OMDB', label: 'Dubai' },
  { airport_icao: 'OTHH', label: 'Doha' },
  { airport_icao: 'FAOR', label: 'Johannesburg' },
  { airport_icao: 'HECA', label: 'Cairo' },
  { airport_icao: 'VTBS', label: 'Bangkok' },
  { airport_icao: 'WSSS', label: 'Singapore' },
  { airport_icao: 'RJTT', label: 'Tokyo Haneda' },
  { airport_icao: 'RKSI', label: 'Seoul Incheon' },
  { airport_icao: 'ZSPD', label: 'Shanghai Pudong' },
  { airport_icao: 'YSSY', label: 'Sydney' },
  { airport_icao: 'YMML', label: 'Melbourne' },
  { airport_icao: 'NZAA', label: 'Auckland' }
];

const HANGAR_SIZES = [
  { key: 'small', slots: 2, allowedTypes: ['small_prop', 'turboprop'], price: 3500000 },
  { key: 'medium', slots: 4, allowedTypes: ['small_prop', 'turboprop', 'regional_jet'], price: 12000000 },
  { key: 'large', slots: 6, allowedTypes: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'cargo'], price: 48000000 },
  { key: 'mega', slots: 10, allowedTypes: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'wide_body', 'cargo'], price: 125000000 }
];

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAircraftId, setSelectedAircraftId] = useState('all');
  const [selectedHangarAirport, setSelectedHangarAirport] = useState('all');
  const [selectedHangarId, setSelectedHangarId] = useState(null);
  const [hangarPurchase, setHangarPurchase] = useState({ airport_icao: HANGAR_MARKET[0].airport_icao, size: 'small' });
  const [minNm, setMinNm] = useState('');
  const [maxNm, setMaxNm] = useState('');
  const autoGenerationGuardRef = useRef('');

  // Single backend call that fetches everything with service role
  const { data: pageData, isLoading } = useQuery({
    queryKey: ['contractsPageData'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getContractsPageData', {});
      return res.data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const company = pageData?.company || null;
  const ownedHangars = Array.isArray(company?.hangars) ? company.hangars : [];
  const ownedAircraft = pageData?.aircraft || [];
  const allContracts = (pageData?.contracts || [])
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const params = {};
      if (minNm) params.minNm = parseInt(minNm);
      if (maxNm) params.maxNm = parseInt(maxNm);
      // Pass active type filter (passenger, cargo, charter) to backend
      if (activeTab && activeTab !== 'all' && activeTab !== 'accepted') {
        params.contractType = activeTab;
      }
      // Pass selected aircraft ID so backend generates contracts for that aircraft type
      if (selectedAircraftId && selectedAircraftId !== 'all') {
        params.aircraftId = selectedAircraftId;
      }
      const res = await base44.functions.invoke('generateContracts', params);
      return res.data;
    },
    onSuccess: () => {
      // Refetch page data immediately
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    }
  });

  const buyHangarMutation = useMutation({
    mutationFn: async () => {
      const sizeSpec = HANGAR_SIZES.find((entry) => entry.key === hangarPurchase.size);
      if (!sizeSpec) return;
      if ((company?.balance || 0) < sizeSpec.price) {
        throw new Error(lang === 'de' ? 'Nicht genug Guthaben für diesen Hangar.' : 'Insufficient balance for this hangar.');
      }
      const nextHangars = [
        ...ownedHangars,
        {
          id: crypto.randomUUID(),
          airport_icao: hangarPurchase.airport_icao,
          size: sizeSpec.key,
          purchase_price: sizeSpec.price,
          slots: sizeSpec.slots,
          allowed_types: sizeSpec.allowedTypes,
          purchased_at: new Date().toISOString()
        }
      ];
      await base44.entities.Company.update(company.id, {
        hangars: nextHangars,
        balance: (company.balance || 0) - sizeSpec.price
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  // Auto-generate on first load if no contracts exist
  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const isNewDay = company?.last_contract_generation_date !== today;
    const alreadyTriggeredForToday = autoGenerationGuardRef.current === today;
    if (!isLoading && pageData && isNewDay && !generateMutation.isPending && !alreadyTriggeredForToday) {
      autoGenerationGuardRef.current = today;
      generateMutation.mutate();
    }
  }, [isLoading, pageData, company?.last_contract_generation_date]);

  // Filter available aircraft (not in flight, not sold, not damaged)
  const availableAircraft = ownedAircraft.filter(ac => ac.status === 'available');

  // Get selected aircraft for filtering
  const selectedAircraft = selectedAircraftId !== 'all' 
    ? availableAircraft.find(a => a.id === selectedAircraftId) 
    : null;

  // Separate contracts into compatible and incompatible based on selected aircraft or all available
  const aircraftToCheck = selectedAircraft ? [selectedAircraft] : availableAircraft;

  const selectedHangarAircraft = selectedHangarId
    ? availableAircraft.filter((plane) => plane.hangar_id === selectedHangarId)
    : aircraftToCheck;

  const compatibleContracts = allContracts.filter(contract => {
    return aircraftToCheck.some(plane => {
      const typeMatch = !contract.required_aircraft_type || 
                       contract.required_aircraft_type.length === 0 || 
                       contract.required_aircraft_type.includes(plane.type);
      const cargoMatch = !contract.cargo_weight_kg || 
                        (plane.cargo_capacity_kg && plane.cargo_capacity_kg >= contract.cargo_weight_kg);
      const rangeMatch = !contract.distance_nm || 
                        (plane.range_nm && plane.range_nm >= contract.distance_nm);
      return typeMatch && cargoMatch && rangeMatch;
    });
  });
  
  const incompatibleContracts = allContracts.filter(contract => {
    return !aircraftToCheck.some(plane => {
      const typeMatch = !contract.required_aircraft_type || 
                       contract.required_aircraft_type.length === 0 || 
                       contract.required_aircraft_type.includes(plane.type);
      const cargoMatch = !contract.cargo_weight_kg || 
                        (plane.cargo_capacity_kg && plane.cargo_capacity_kg >= contract.cargo_weight_kg);
      const rangeMatch = !contract.distance_nm || 
                        (plane.range_nm && plane.range_nm >= contract.distance_nm);
      return typeMatch && cargoMatch && rangeMatch;
    });
  });

  const contracts = compatibleContracts;
  const incompatibleShow = incompatibleContracts;

  const acceptContractMutation = useMutation({
    mutationFn: async (contract) => {
      await base44.functions.invoke('acceptContract', { 
        contractId: contract.id 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      navigate(createPageUrl("ActiveFlights"));
    }
  });

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.departure_airport?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.arrival_airport?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesHangar = selectedHangarAirport === 'all' || contract.departure_airport === selectedHangarAirport;
    const matchesSelectedHangarAircraft = !selectedHangarId || selectedHangarAircraft.some((plane) => {
      const typeMatch = !contract.required_aircraft_type ||
        contract.required_aircraft_type.length === 0 ||
        contract.required_aircraft_type.includes(plane.type);
      const cargoMatch = !contract.cargo_weight_kg ||
        (plane.cargo_capacity_kg && plane.cargo_capacity_kg >= contract.cargo_weight_kg);
      const rangeMatch = !contract.distance_nm ||
        (plane.range_nm && plane.range_nm >= contract.distance_nm);
      return typeMatch && cargoMatch && rangeMatch;
    });

    if (activeTab === 'all') return matchesSearch && matchesHangar && matchesSelectedHangarAircraft && contract.status === 'available';
    if (activeTab === 'accepted') return matchesSearch && matchesHangar && matchesSelectedHangarAircraft && contract.status === 'accepted';
    if (activeTab === 'passenger') return matchesSearch && matchesHangar && matchesSelectedHangarAircraft && contract.type === 'passenger' && contract.status === 'available';
    if (activeTab === 'cargo') return matchesSearch && matchesHangar && matchesSelectedHangarAircraft && contract.type === 'cargo' && contract.status === 'available';
    if (activeTab === 'charter') return matchesSearch && matchesHangar && matchesSelectedHangarAircraft && contract.type === 'charter' && contract.status === 'available';
    return matchesSearch;
  });

  const hangarContractsMap = useMemo(() => {
    const result = {};
    ownedHangars.forEach((hangar) => {
      const stationed = availableAircraft.filter((plane) => plane.hangar_id === hangar.id);
      const list = filteredContracts.filter((contract) => {
        if (contract.departure_airport !== hangar.airport_icao) return false;
        return stationed.some((plane) => {
          const typeMatch = !contract.required_aircraft_type || contract.required_aircraft_type.includes(plane.type);
          const cargoMatch = !contract.cargo_weight_kg || (plane.cargo_capacity_kg && plane.cargo_capacity_kg >= contract.cargo_weight_kg);
          const rangeMatch = !contract.distance_nm || (plane.range_nm && plane.range_nm >= contract.distance_nm);
          return typeMatch && cargoMatch && rangeMatch;
        });
      });
      result[hangar.id] = list;
    });
    return result;
  }, [ownedHangars, availableAircraft, filteredContracts]);

  const globeHangars = ownedHangars
    .map((hangar) => {
      const coords = getAirportCoords(hangar.airport_icao);
      if (!coords) return null;
      return {
        ...hangar,
        ...coords,
        stationedAircraft: availableAircraft.filter((plane) => plane.hangar_id === hangar.id)
      };
    })
    .filter(Boolean);

  const globeContracts = filteredContracts.slice(0, 25).map((contract) => ({
    ...contract,
    arrival: getAirportCoords(contract.arrival_airport)
  }));

  const handleAccept = (contract) => {
    acceptContractMutation.mutate(contract);
  };

  const handleView = (contract) => {
    navigate(createPageUrl(`ContractDetails?id=${contract.id}`));
  };

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Zibo Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest px-2">{t('contracts', lang)}</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-cyan-900/50">
            <span className="text-[9px] font-mono text-cyan-600 uppercase">DIST:</span>
            <Input type="number" placeholder="0" value={minNm} onChange={(e) => setMinNm(e.target.value)} className="w-10 h-5 text-[10px] font-mono bg-transparent border-none p-0 text-cyan-100 text-center focus-visible:ring-0" />
            <span className="text-[9px] font-mono text-cyan-600">-</span>
            <Input type="number" placeholder="∞" value={maxNm} onChange={(e) => setMaxNm(e.target.value)} className="w-10 h-5 text-[10px] font-mono bg-transparent border-none p-0 text-cyan-100 text-center focus-visible:ring-0" />
            <span className="text-[9px] font-mono text-cyan-600">NM</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cyan-600" />
            <Input
              placeholder={t('search_route_airport', lang).toUpperCase()}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-[10px] font-mono w-32 sm:w-48 bg-slate-950 border-cyan-900/50 text-cyan-100 placeholder:text-cyan-900"
            />
          </div>
          <Button 
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            size="sm"
            className="h-7 text-[10px] font-mono uppercase bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-800/60"
          >
            {generateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            <span className="hidden sm:inline">{t('generate_contracts', lang)}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <Card className="mb-2 p-3 bg-slate-900/70 border-cyan-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-mono text-cyan-300">
              {lang === 'de'
                ? '3D Hangar-Markt und 3D Welt findest du in der Flotte.'
                : 'You can find the 3D hangar market and 3D world in Fleet.'}
            </div>
            <Button size="sm" onClick={() => navigate(createPageUrl('Fleet'))}>
              {lang === 'de' ? 'Zur Flotte (3D)' : 'Go to Fleet (3D)'}
            </Button>
          </div>
        </Card>

        <Card className="mb-2 p-3 bg-slate-900/70 border-cyan-900/40">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <div className="text-[10px] font-mono text-cyan-500 uppercase">{lang === 'de' ? 'Flughafen' : 'Airport'}</div>
              <select
                value={hangarPurchase.airport_icao}
                onChange={(e) => setHangarPurchase((prev) => ({ ...prev, airport_icao: e.target.value }))}
                className="h-8 rounded bg-slate-950 border border-cyan-900/50 text-cyan-100 px-2 text-xs"
              >
                {HANGAR_MARKET.map((airport) => (
                  <option key={airport.airport_icao} value={airport.airport_icao}>{airport.airport_icao} · {airport.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-500 uppercase">{lang === 'de' ? 'Hangargröße' : 'Hangar size'}</div>
              <select
                value={hangarPurchase.size}
                onChange={(e) => setHangarPurchase((prev) => ({ ...prev, size: e.target.value }))}
                className="h-8 rounded bg-slate-950 border border-cyan-900/50 text-cyan-100 px-2 text-xs"
              >
                {HANGAR_SIZES.map((size) => (
                  <option key={size.key} value={size.key}>{size.key.toUpperCase()} · {size.slots} slots</option>
                ))}
              </select>
            </div>
            <Button size="sm" onClick={() => buyHangarMutation.mutate()} disabled={buyHangarMutation.isPending}>
              {lang === 'de' ? 'Hangar kaufen' : 'Buy hangar'}
            </Button>
            <div className="text-[10px] font-mono text-cyan-400">
              {lang === 'de' ? 'Eigene Hangars' : 'Owned hangars'}: {ownedHangars.length}
            </div>
          </div>
        </Card>

        {ownedHangars.length > 0 && (
          <Card className="mb-2 p-3 bg-slate-900/70 border-cyan-900/40">
            <div className="text-[10px] font-mono text-cyan-500 uppercase mb-2">{lang === 'de' ? 'Aufträge pro Hangar' : 'Contracts by hangar'}</div>
            <div className="flex flex-wrap gap-1 mb-2">
              <button onClick={() => { setSelectedHangarAirport('all'); setSelectedHangarId(null); }} className={`px-2 py-1 text-[10px] rounded ${selectedHangarAirport === 'all' ? 'bg-cyan-800 text-white' : 'bg-slate-800 text-slate-300'}`}>All</button>
              {ownedHangars.map((hangar) => (
                <button
                  key={hangar.id}
                  onClick={() => {
                    setSelectedHangarAirport(hangar.airport_icao);
                    setSelectedHangarId(hangar.id);
                  }}
                  className={`px-2 py-1 text-[10px] rounded ${selectedHangarAirport === hangar.airport_icao ? 'bg-cyan-800 text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  {hangar.airport_icao} · {hangar.size}
                </button>
              ))}
            </div>
            <HangarWorldGlobe3D
              hangars={globeHangars}
              contracts={globeContracts}
              contractsByHangar={hangarContractsMap}
              onSelectHangar={(hangar) => {
                setSelectedHangarAirport(hangar.airport_icao);
                setSelectedHangarId(hangar.id);
              }}
            />
          </Card>
        )}

        {/* Aircraft Selector */}
        {availableAircraft.length > 0 && (
          <div className="mb-2">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedAircraftId('all')}
                className={`px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors ${
                  selectedAircraftId === 'all'
                    ? 'bg-cyan-900/60 text-cyan-400 border border-cyan-700'
                    : 'bg-slate-900 text-slate-500 hover:text-cyan-400 border border-slate-800'
                }`}
              >
                {t('all_aircraft', lang)}
              </button>
              {availableAircraft.map(ac => (
                <button
                  key={ac.id}
                  onClick={() => setSelectedAircraftId(ac.id)}
                  className={`px-2 py-1 rounded text-[10px] font-mono uppercase transition-colors flex items-center gap-1 ${
                    selectedAircraftId === ac.id
                      ? 'bg-cyan-900/60 text-cyan-400 border border-cyan-700'
                      : 'bg-slate-900 text-slate-500 hover:text-cyan-400 border border-slate-800'
                  }`}
                >
                  <span>{ac.name}</span>
                  <span className="text-[9px] opacity-60">{ac.registration}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info Alert */}
         <div className="mb-2 p-2 bg-cyan-950/30 border border-cyan-900/50 rounded flex items-center gap-2">
          <AlertCircle className="w-3 h-3 text-cyan-500 flex-shrink-0" />
          <p className="text-[10px] font-mono text-cyan-200"><span className="font-bold text-cyan-400">{t('important', lang)}:</span> {t('important_msg', lang)}</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-2">
          <TabsList className="bg-slate-900/80 border border-cyan-900/30 flex-wrap h-auto p-0.5 rounded-lg w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1 flex items-center gap-1">
              <Plane className="w-3 h-3" /> {t('all', lang)} ({compatibleContracts.filter(c => c.status === 'available').length})
            </TabsTrigger>
            <TabsTrigger value="accepted" className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {t('accepted', lang)} ({contracts.filter(c => c.status === 'accepted').length})
            </TabsTrigger>
            <TabsTrigger value="passenger" className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1 flex items-center gap-1">
              <Users className="w-3 h-3" /> {t('passenger', lang)}
            </TabsTrigger>
            <TabsTrigger value="cargo" className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1 flex items-center gap-1">
              <Package className="w-3 h-3" /> {t('cargo', lang)}
            </TabsTrigger>
            <TabsTrigger value="charter" className="text-[10px] font-mono uppercase data-[state=active]:bg-cyan-900/40 data-[state=active]:text-cyan-400 data-[state=active]:shadow-none rounded px-3 py-1 flex items-center gap-1">
              <Star className="w-3 h-3" /> {t('charter', lang)}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Contract Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-64 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : availableAircraft.length === 0 && ownedAircraft.length > 0 ? (
          <Card className="p-8 sm:p-12 bg-slate-800 border border-slate-700">
            <div className="text-center mb-6">
              <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">{t('no_aircraft_available', lang)}</h3>
              <p className="text-slate-400">{t('all_aircraft_unavailable', lang)}</p>
            </div>
            <div className="space-y-3 max-w-md mx-auto mb-6">
              {ownedAircraft.some(ac => ac.status === 'in_flight') && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-600/30">
                  <Plane className="w-5 h-5 text-amber-400" />
                  <p className="text-sm text-slate-300">{t('aircraft_in_flight', lang)}</p>
                </div>
              )}
              {ownedAircraft.some(ac => ac.status === 'maintenance' || ac.status === 'damaged') && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-600/30">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  <p className="text-sm text-slate-300">{t('aircraft_in_maintenance', lang)}</p>
                </div>
              )}
            </div>
          </Card>
        ) : filteredContracts.length > 0 ? (
           <>
             <h2 className="text-xl font-bold text-white mb-4">{t('compatible_contracts', lang)} ({compatibleContracts.length})</h2>
             <motion.div 
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
               layout
             >
               <AnimatePresence>
                 {filteredContracts.map((contract) => (
                   <ContractCard
                     key={contract.id}
                     contract={contract}
                     onAccept={handleAccept}
                     onView={handleView}
                     isAccepting={acceptContractMutation.isPending}
                     ownedAircraft={ownedAircraft}
                   />
                 ))}
               </AnimatePresence>
             </motion.div>

             {incompatibleShow.length > 0 && (
               <>
                 <h2 className="text-xl font-bold text-white mb-4">{t('incompatible_contracts', lang)} ({incompatibleContracts.length})</h2>
                 <motion.div 
                   className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50"
                   layout
                 >
                   <AnimatePresence>
                     {incompatibleShow.map((contract) => (
                       <div key={contract.id} className="relative">
                         <ContractCard
                           contract={contract}
                           onAccept={handleAccept}
                           onView={handleView}
                           isAccepting={false}
                           ownedAircraft={ownedAircraft}
                         />
                         <div className="absolute inset-0 bg-slate-900/80 rounded-xl flex items-center justify-center">
                           <div className="text-center px-4">
                             <p className="text-white font-semibold">{t('no_matching_aircraft', lang)}</p>
                             <p className="text-slate-400 text-sm mt-1">
                               {t('required_type', lang)}: {contract.required_aircraft_type?.join(', ') || t('all', lang)}<br />
                               {contract.distance_nm && `${t('range_label', lang)}: ${contract.distance_nm} NM`}
                               {contract.cargo_weight_kg && ` • ${t('cargo', lang)}: ${contract.cargo_weight_kg} kg`}
                             </p>
                           </div>
                         </div>
                       </div>
                     ))}
                   </AnimatePresence>
                 </motion.div>
               </>
             )}
           </>
         ) : (
          <Card className="p-8 sm:p-12 bg-slate-800 border border-slate-700">
            <div className="text-center mb-6">
              <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {ownedAircraft.length === 0 ? t('no_aircraft_owned', lang) : t('no_contracts_available', lang)}
              </h3>
            </div>
            <div className="space-y-3 max-w-md mx-auto mb-6">
              {ownedAircraft.length === 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-600/30">
                  <Plane className="w-5 h-5 text-red-400" />
                  <p className="text-sm text-slate-300">{t('no_aircraft_buy_first', lang)}</p>
                </div>
              )}
              {searchTerm && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-600/30">
                  <Search className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-slate-300">{t('no_search_results', lang)}</p>
                </div>
              )}
              {ownedAircraft.length > 0 && !searchTerm && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-600/30">
                  <RefreshCw className="w-5 h-5 text-slate-400" />
                  <p className="text-sm text-slate-300">{t('click_generate', lang)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              {searchTerm && (
                <Button onClick={() => { setSearchTerm(''); setActiveTab('all'); }}>
                   {t('reset_filters', lang)}
                </Button>
              )}
              <Button 
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('generating', lang)}</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> {t('generate_contracts', lang)}</>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
