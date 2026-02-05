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

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const { data: contracts = [], isLoading, refetch } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date')
  });

  const acceptContractMutation = useMutation({
    mutationFn: async (contract) => {
      await base44.entities.Contract.update(contract.id, { status: 'accepted' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
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
    navigate(createPageUrl(`ContractDetail?id=${contract.id}`));
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
                variant="outline" 
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Plane className="w-4 h-4" />
              Alle
              <Badge variant="secondary" className="ml-1">
                {contracts.filter(c => c.status === 'available').length}
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
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
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
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
          <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Keine Aufträge gefunden</h3>
          <p className="text-slate-400 mb-4">
              {searchTerm ? 'Versuche eine andere Suche' : 'Neue Aufträge werden regelmäßig generiert'}
            </p>
            <Button onClick={() => { setSearchTerm(''); setActiveTab('all'); }}>
              Filter zurücksetzen
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}