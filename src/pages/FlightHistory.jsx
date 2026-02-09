import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Search,
  Plane,
  Star,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown
} from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";

export default function FlightHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFlight, setSelectedFlight] = useState(null);

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

  const { data: flights = [], isLoading } = useQuery({
    queryKey: ['flights', 'history', company?.id],
    queryFn: async () => {
      const completed = await base44.entities.Flight.filter({ company_id: company.id, status: 'completed' }, '-created_date');
      const failed = await base44.entities.Flight.filter({ company_id: company.id, status: 'failed' }, '-created_date');
      return [...completed, ...failed].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!company?.id
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'all', company?.id],
    queryFn: async () => {
      return await base44.entities.Contract.filter({ company_id: company.id });
    },
    enabled: !!company?.id
  });

  const getContractForFlight = (flight) => {
    return contracts.find(c => c.id === flight.contract_id);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalProfit = flights.reduce((sum, f) => sum + (f.profit || 0), 0);
  const avgRating = flights.length > 0 
    ? flights.reduce((sum, f) => sum + (f.overall_rating || 0), 0) / flights.length 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Flughistorie</h1>
          <p className="text-slate-400">Übersicht aller abgeschlossenen Flüge</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="p-3 sm:p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
                <Plane className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-400 truncate">Flüge</p>
                <p className="text-lg sm:text-2xl font-bold text-white">{flights.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-500/20 rounded-lg flex-shrink-0">
                <Star className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-400 truncate">Ø Bewertung</p>
                <p className="text-lg sm:text-2xl font-bold text-white">{avgRating.toFixed(1)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${totalProfit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {totalProfit >= 0 ? (
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-400 truncate">Gewinn</p>
                <p className={`text-lg sm:text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg flex-shrink-0">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-400 truncate">Ø/Flug</p>
                <p className="text-lg sm:text-2xl font-bold text-white">
                  {formatCurrency(flights.length > 0 ? totalProfit / flights.length : 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Flug suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 text-white border-slate-700"
            />
          </div>
        </div>

        {/* Flight List */}
        {isLoading ? (
          <Card className="animate-pulse bg-slate-800 h-64" />
        ) : flights.length > 0 ? (
          <div className="space-y-3">
            {flights.map((flight) => {
              const contract = getContractForFlight(flight);
              return (
                <Card 
                  key={flight.id} 
                  className={`p-3 sm:p-4 bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-500 transition-colors ${flight.status === 'failed' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}`}
                  onClick={() => setSelectedFlight(flight)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs text-slate-500">{formatDate(flight.departure_time)}</span>
                        {flight.status === 'failed' && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Crash</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-white font-mono text-sm sm:text-base">
                        <span>{contract?.departure_airport || '???'}</span>
                        <span className="text-slate-500">→</span>
                        <span>{contract?.arrival_airport || '???'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Star className={`w-4 h-4 ${flight.overall_rating >= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                        <span className="text-white text-sm font-medium">{flight.overall_rating?.toFixed(1) || '-'}</span>
                      </div>
                      <Badge className={`text-xs ${
                        Math.abs(flight.landing_vs || 0) < 150 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                          : Math.abs(flight.landing_vs || 0) < 300
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>
                        {flight.landing_vs} ft/m
                      </Badge>
                      <span className={`text-sm font-bold ${flight.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(flight.profit)}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Keine Flüge</h3>
            <p className="text-slate-400">Du hast noch keine Flüge abgeschlossen.</p>
          </Card>
        )}

        {/* Flight Detail Dialog */}
        <Dialog open={!!selectedFlight} onOpenChange={() => setSelectedFlight(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Flugdetails</DialogTitle>
            </DialogHeader>
            {selectedFlight && (
              <div className="space-y-4">
                <FlightRating flight={selectedFlight} />
                
                <Card className="p-4 bg-slate-800 border-slate-700">
                  <h4 className="font-semibold mb-3 text-white">Finanzübersicht</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-white">
                      <span>Einnahmen</span>
                      <span className="text-emerald-400 font-medium">
                        {formatCurrency(selectedFlight.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Treibstoffkosten</span>
                      <span className="text-red-400">-{formatCurrency(selectedFlight.fuel_cost)}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Crew-Kosten</span>
                      <span className="text-red-400">-{formatCurrency(selectedFlight.crew_cost)}</span>
                    </div>
                    <div className="flex justify-between text-white">
                      <span>Wartungskosten</span>
                      <span className="text-red-400">-{formatCurrency(selectedFlight.maintenance_cost)}</span>
                    </div>
                    <hr className="border-slate-600" />
                    <div className="flex justify-between font-bold text-white">
                      <span>Gewinn</span>
                      <span className={selectedFlight.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {formatCurrency(selectedFlight.profit)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}