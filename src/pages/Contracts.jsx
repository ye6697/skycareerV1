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
  Filter,
  Users,
  Package,
  Star,
  Clock,
  Plane,
  RefreshCw
} from "lucide-react";

import ContractCard from "@/components/contracts/ContractCard";
import { AlertCircle, Loader2 } from "lucide-react";

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('all');

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0];
    }
  });

  const { data: ownedAircraft = [] } = useQuery({
    queryKey: ['aircraft', 'owned'],
    queryFn: async () => {
      if (!company) return [];
      return await base44.entities.Aircraft.filter({ company_id: company.id, status: { $ne: 'sold' } });
    },
    enabled: !!company
  });

  const { data: allContracts = [], isLoading } = useQuery({
    queryKey: ['contracts', 'available', company?.id],
    queryFn: async () => {
      const contracts = await base44.entities.Contract.filter({ 
        company_id: company.id, 
        status: 'available' 
      });
      return contracts
        .filter(c => (c.level_requirement || 1) <= (company?.level || 1))
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!company
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('generateContracts', {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    }
  });

  // Filter available aircraft (not in flight, not sold, not damaged)
  const availableAircraft = ownedAircraft.filter(ac => ac.status === 'available');

  // Separate contracts into compatible and incompatible
  const compatibleContracts = allContracts.filter(contract => {
    // Check if any available aircraft can fulfill this contract
    return availableAircraft.some(plane => {
      // Check type match
      const typeMatch = !contract.required_aircraft_type || 
                       contract.required_aircraft_type.length === 0 || 
                       contract.required_aircraft_type.includes(plane.type);
      
      // Check cargo capacity
      const cargoMatch = !contract.cargo_weight_kg || 
                        (plane.cargo_capacity_kg && plane.cargo_capacity_kg >= contract.cargo_weight_kg);
      
      // Check range
      const rangeMatch = !contract.distance_nm || 
                        (plane.range_nm && plane.range_nm >= contract.distance_nm);
      
      return typeMatch && cargoMatch && rangeMatch;
    });
  });
  
  const incompatibleContracts = allContracts.filter(contract => {
    return !availableAircraft.some(plane => {
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
      await base44.entities.Contract.update(contract.id, { 
        status: 'accepted',
        company_id: company.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    }
  });

  const getRangeCategory = (distanceNm) => {
    if (distanceNm <= 500) return 'short';
    if (distanceNm <= 1500) return 'medium';
    return 'long';
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.departure_airport?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.arrival_airport?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const rangeCategory = getRangeCategory(contract.distance_nm || 0);
    const matchesRange = rangeFilter === 'all' || rangeCategory === rangeFilter;
    
    if (activeTab === 'all') return matchesSearch && matchesRange && contract.status === 'available';
    if (activeTab === 'accepted') return matchesSearch && matchesRange && contract.status === 'accepted';
    if (activeTab === 'passenger') return matchesSearch && matchesRange && contract.type === 'passenger' && contract.status === 'available';
    if (activeTab === 'cargo') return matchesSearch && matchesRange && contract.type === 'cargo' && contract.status === 'available';
    if (activeTab === 'charter') return matchesSearch && matchesRange && contract.type === 'charter' && contract.status === 'available';
    return matchesSearch && matchesRange;
  });

  const handleAccept = (contract) => {
    acceptContractMutation.mutate(contract);
  };

  const handleView = (contract) => {
    navigate(createPageUrl(`ContractDetails?id=${contract.id}`));
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
              <h1 className="text-3xl font-bold text-white">Aufträge</h1>
              <p className="text-slate-400">Finde und akzeptiere lukrative Flugaufträge</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Suche nach Route, Flughafen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-slate-800 text-white border-slate-700"
                />
              </div>
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
          </div>
        </motion.div>

        {/* Range Filter */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-4 h-4 text-slate-400" />
          <button
            onClick={() => setRangeFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              rangeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Alle Entfernungen
          </button>
          <button
            onClick={() => setRangeFilter('short')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              rangeFilter === 'short'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Kurzstrecke (≤500 NM)
          </button>
          <button
            onClick={() => setRangeFilter('medium')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              rangeFilter === 'medium'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Mittelstrecke (500-1500 NM)
          </button>
          <button
            onClick={() => setRangeFilter('long')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              rangeFilter === 'long'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Langstrecke (>1500 NM)
          </button>
        </div>

        {/* Info Alert */}
         <div className="mb-6 p-4 bg-blue-900/40 border border-blue-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-100">Wichtig:</p>
            <p className="text-sm text-blue-200">Um die Flugwerte in einem Auftrag zurückzusetzen, musst du einen neuen Flug in X-Plane 12 starten.</p>
          </div>
        </div>

        {/* Tabs */}
         <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Plane className="w-4 h-4" />
              Alle
              <Badge variant="secondary" className="ml-1">
                {compatibleContracts.filter(c => c.status === 'available').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="accepted" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Angenommen
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">
                {contracts.filter(c => c.status === 'accepted').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="passenger" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Passagiere
            </TabsTrigger>
            <TabsTrigger value="cargo" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Fracht
            </TabsTrigger>
            <TabsTrigger value="charter" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Charter
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
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
          <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Keine Aufträge gefunden</h3>
          <p className="text-slate-400 mb-4">
             {searchTerm ? 'Versuche eine andere Suche' : 'Klicke auf "Aufträge generieren" um neue Aufträge zu erhalten'}
           </p>
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