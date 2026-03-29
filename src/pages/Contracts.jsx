import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
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

import ContractCard from "@/components/contracts/ContractCard";
import { AlertCircle, Loader2, Wrench, UserX } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedAircraftId, setSelectedAircraftId] = useState('all');
  const [minNm, setMinNm] = useState('');
  const [maxNm, setMaxNm] = useState('');

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
  const ownedAircraft = pageData?.aircraft || [];
  const allContracts = (pageData?.contracts || [])
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const generateMutation = useMutation({
    mutationFn: async () => {
      const params = {};
      if (minNm) params.minNm = parseInt(minNm);
      if (maxNm) params.maxNm = parseInt(maxNm);
      const res = await base44.functions.invoke('generateContracts', params);
      return res.data;
    },
    onSuccess: () => {
      // Refetch page data immediately
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    }
  });

  // Auto-generate on first load if no contracts exist
  React.useEffect(() => {
    if (!isLoading && pageData && allContracts.length === 0 && !generateMutation.isPending) {
      generateMutation.mutate();
    }
  }, [isLoading, pageData]);

  // Filter available aircraft (not in flight, not sold, not damaged)
  const availableAircraft = ownedAircraft.filter(ac => ac.status === 'available');

  // Get selected aircraft for filtering
  const selectedAircraft = selectedAircraftId !== 'all' 
    ? availableAircraft.find(a => a.id === selectedAircraftId) 
    : null;

  // Separate contracts into compatible and incompatible based on selected aircraft or all available
  const aircraftToCheck = selectedAircraft ? [selectedAircraft] : availableAircraft;

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
    
    if (activeTab === 'all') return matchesSearch && contract.status === 'available';
    if (activeTab === 'accepted') return matchesSearch && contract.status === 'accepted';
    if (activeTab === 'passenger') return matchesSearch && contract.type === 'passenger' && contract.status === 'available';
    if (activeTab === 'cargo') return matchesSearch && contract.type === 'cargo' && contract.status === 'available';
    if (activeTab === 'charter') return matchesSearch && contract.type === 'charter' && contract.status === 'available';
    return matchesSearch;
  });

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