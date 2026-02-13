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

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Aufträge</h1>
              <p className="text-slate-400">Finde und akzeptiere lukrative Flugaufträge</p>
            </div>
            <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Suche nach Route, Flughafen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64 bg-slate-800 text-white border-slate-700"
                />
              </div>
          </div>

          {/* Distance Range Filter + Generate Button */}
          <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-lg">
            <p className="text-xs text-slate-400 mb-3 font-medium">Entfernungsfilter für Generierung (NM)</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Von</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={minNm}
                  onChange={(e) => setMinNm(e.target.value)}
                  className="w-24 h-8 text-sm bg-slate-900 border-slate-600 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Bis</span>
                <Input
                  type="number"
                  placeholder="∞"
                  value={maxNm}
                  onChange={(e) => setMaxNm(e.target.value)}
                  className="w-24 h-8 text-sm bg-slate-900 border-slate-600 text-white"
                />
              </div>
              <span className="text-xs text-slate-400">NM</span>
              <Button 
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 h-8 ml-auto"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generiere...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Aufträge generieren</>
                )}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Aircraft Selector */}
        {availableAircraft.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
              <Plane className="w-3 h-3" /> Flugzeug auswählen
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedAircraftId('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedAircraftId === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                Alle Flugzeuge
              </button>
              {availableAircraft.map(ac => (
                <button
                  key={ac.id}
                  onClick={() => setSelectedAircraftId(ac.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedAircraftId === ac.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  <span>{ac.name}</span>
                  <span className="text-[10px] opacity-60">{ac.registration}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info Alert */}
         <div className="mb-6 p-4 bg-blue-900/40 border border-blue-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-100">Wichtig:</p>
            <p className="text-sm text-blue-200">Um die Flugwerte in einem Auftrag zurückzusetzen, musst du einen neuen Flug in X-Plane 12 starten.</p>
          </div>
        </div>

        {/* Tabs */}
         <div className="mb-6 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800 border border-slate-700 inline-flex w-auto min-w-max">
              <TabsTrigger value="all" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Plane className="w-3 h-3 sm:w-4 sm:h-4" />
                Alle
                <Badge variant="secondary" className="ml-1 text-xs">
                  {compatibleContracts.filter(c => c.status === 'available').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="accepted" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                Angenommen
                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 text-xs">
                  {contracts.filter(c => c.status === 'accepted').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="passenger" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                Passagiere
              </TabsTrigger>
              <TabsTrigger value="cargo" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                Fracht
              </TabsTrigger>
              <TabsTrigger value="charter" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                Charter
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Contract Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-64 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : filteredContracts.length > 0 ? (
           <>
             <h2 className="text-xl font-bold text-white mb-4">Kompatible Aufträge ({compatibleContracts.length})</h2>
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
                 <h2 className="text-xl font-bold text-white mb-4">Nicht kompatible Aufträge ({incompatibleContracts.length})</h2>
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
                             <p className="text-white font-semibold">Keine passenden Flugzeuge</p>
                             <p className="text-slate-400 text-sm mt-1">
                               Erforderlich: Typ {contract.required_aircraft_type?.join(', ') || 'Beliebig'}<br />
                               {contract.distance_nm && `Reichweite: ${contract.distance_nm} NM`}
                               {contract.cargo_weight_kg && ` • Cargo: ${contract.cargo_weight_kg} kg`}
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
              <h3 className="text-xl font-semibold text-white mb-2">Keine Aufträge verfügbar</h3>
            </div>

            {/* Diagnostic hints */}
            {(() => {
              const allAc = ownedAircraft || [];
              const noAircraft = allAc.length === 0;
              const allInFlight = !noAircraft && allAc.every(ac => ac.status === 'in_flight');
              const hasDamaged = allAc.some(ac => ac.status === 'damaged' || ac.status === 'maintenance');
              const noAvailable = !noAircraft && availableAircraft.length === 0;

              // Check employees
              const employees = pageData?.employees || [];

              const hints = [];

              if (noAircraft) {
                hints.push({ icon: <Plane className="w-5 h-5 text-red-400" />, text: 'Du besitzt keine Flugzeuge. Kaufe zuerst ein Flugzeug in der Flotte.', color: 'red' });
              } else if (noAvailable) {
                if (allInFlight) {
                  hints.push({ icon: <Plane className="w-5 h-5 text-amber-400" />, text: 'Alle Flugzeuge sind derzeit im Flug. Warte bis ein Flug abgeschlossen ist.', color: 'amber' });
                }
                if (hasDamaged) {
                  hints.push({ icon: <Wrench className="w-5 h-5 text-amber-400" />, text: 'Einige Flugzeuge sind beschädigt oder in Wartung. Repariere sie in der Flotte.', color: 'amber' });
                }
                if (!allInFlight && !hasDamaged) {
                  hints.push({ icon: <Plane className="w-5 h-5 text-amber-400" />, text: 'Keine verfügbaren Flugzeuge. Prüfe den Status deiner Flotte.', color: 'amber' });
                }
              }

              const availCaptains = employees.filter(e => e.role === 'captain' && (e.status === 'available' || e.status === 'on_duty'));
              if (availCaptains.length === 0 && !noAircraft) {
                hints.push({ icon: <UserX className="w-5 h-5 text-amber-400" />, text: 'Kein Kapitän verfügbar. Stelle einen Kapitän auf der Mitarbeiter-Seite ein.', color: 'amber' });
              }

              if (searchTerm) {
                hints.push({ icon: <Search className="w-5 h-5 text-blue-400" />, text: 'Die Suche liefert keine Ergebnisse. Versuche einen anderen Suchbegriff.', color: 'blue' });
              }

              if (hints.length === 0) {
                hints.push({ icon: <RefreshCw className="w-5 h-5 text-slate-400" />, text: 'Klicke auf "Aufträge generieren" um neue Aufträge zu erhalten.', color: 'slate' });
              }

              return (
                <div className="space-y-3 max-w-md mx-auto mb-6">
                  {hints.map((hint, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-600/30">
                      {hint.icon}
                      <p className="text-sm text-slate-300">{hint.text}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setSearchTerm(''); setActiveTab('all'); }}>
                Filter zurücksetzen
              </Button>
              <Button 
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generiere...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Aufträge generieren</>
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}