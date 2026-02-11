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

  const { data: allAircraft = [] } = useQuery({
    queryKey: ['aircraft', 'all', company?.id],
    queryFn: async () => {
      return await base44.entities.Aircraft.filter({ company_id: company.id });
    },
    enabled: !!company?.id
  });

  const getAircraftForFlight = (flight) => {
    return allAircraft.find(a => a.id === flight.aircraft_id);
  };

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

        {/* Departure Board Style Table */}
        {isLoading ? (
          <Card className="animate-pulse bg-slate-800 h-64" />
        ) : flights.length > 0 ? (
          <Card className="overflow-hidden bg-[#0c0e14] border border-slate-700 rounded-xl">
            {/* Board Header */}
            <div className="bg-[#111318] border-b border-slate-700/50 px-3 sm:px-5 py-3 flex items-center gap-3">
              <Plane className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-mono text-xs sm:text-sm font-bold tracking-widest uppercase">Flughistorie – Abflüge</span>
            </div>
            {/* Column Headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[100px_1fr_100px_70px_65px_55px_55px_70px_60px_90px] gap-1 px-3 sm:px-5 py-2 bg-[#111318] border-b border-slate-700/50 text-[10px] sm:text-xs font-mono font-bold text-amber-400/70 uppercase tracking-wider">
              <span>Datum</span>
              <span>Route</span>
              <span className="hidden sm:block">Flugzeug</span>
              <span className="text-center hidden sm:block">Score</span>
              <span className="text-center">Landung</span>
              <span className="text-center hidden sm:block">Land-G</span>
              <span className="text-center hidden sm:block">Max-G</span>
              <span className="text-center hidden sm:block">Wartung</span>
              <span className="text-center hidden sm:block">Deadline</span>
              <span className="text-right">Gewinn</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-slate-800/80">
              {flights.filter(f => {
                if (!searchTerm) return true;
                const contract = getContractForFlight(f);
                const search = searchTerm.toLowerCase();
                return contract?.departure_airport?.toLowerCase().includes(search) || 
                       contract?.arrival_airport?.toLowerCase().includes(search) ||
                       formatDate(f.departure_time).includes(search);
              }).map((flight, index) => {
                const contract = getContractForFlight(flight);
                const ac = getAircraftForFlight(flight);
                const isFailed = flight.status === 'failed';
                const landingG = flight.xplane_data?.landingGForce ?? flight.xplane_data?.landing_g_force ?? 0;
                const madeDeadline = flight.xplane_data?.madeDeadline;
                return (
                  <motion.div
                    key={flight.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className={`grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[100px_1fr_100px_70px_65px_55px_55px_70px_60px_90px] gap-1 items-center px-3 sm:px-5 py-2.5 cursor-pointer transition-colors font-mono text-sm ${isFailed ? 'bg-red-950/20 hover:bg-red-950/40' : 'hover:bg-slate-800/60'}`}
                    onClick={() => setSelectedFlight(flight)}
                  >
                    {/* Date */}
                    <div className="text-slate-400 text-[11px] sm:text-xs">
                      {formatDate(flight.departure_time)}
                    </div>
                    {/* Route */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white font-bold text-xs sm:text-sm">{contract?.departure_airport || '???'}</span>
                      <span className="text-amber-400 text-xs">→</span>
                      <span className="text-white font-bold text-xs sm:text-sm">{contract?.arrival_airport || '???'}</span>
                      {isFailed && (
                        <Badge className="bg-red-600 text-white border-0 text-[9px] px-1.5 py-0 font-bold animate-pulse">CRASH</Badge>
                      )}
                    </div>
                    {/* Aircraft */}
                    <div className="hidden sm:block text-[10px] text-slate-400 truncate">
                      {ac?.name || '-'}
                    </div>
                    {/* Score */}
                    <div className="text-center hidden sm:flex items-center justify-center gap-1">
                      <Star className={`w-3 h-3 ${flight.overall_rating >= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                      <span className="text-white text-xs font-bold">{flight.overall_rating?.toFixed(1) || '-'}</span>
                    </div>
                    {/* Landing V/S */}
                    <div className="flex justify-center">
                      <span className={`text-[11px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${
                        Math.abs(flight.landing_vs || 0) < 150
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : Math.abs(flight.landing_vs || 0) < 300
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {flight.landing_vs || 0} ft/m
                      </span>
                    </div>
                    {/* Landing G */}
                    <div className="text-center hidden sm:block">
                      <span className={`text-[11px] font-bold ${
                        landingG < 1.0 ? 'text-emerald-400' :
                        landingG < 1.6 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {landingG > 0 ? `${landingG.toFixed(1)}G` : '-'}
                      </span>
                    </div>
                    {/* Max G-Force */}
                    <div className="text-center hidden sm:block">
                      <span className={`text-[11px] font-bold ${
                        (flight.max_g_force || 0) <= 1.3 ? 'text-emerald-400' :
                        (flight.max_g_force || 0) <= 1.5 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {flight.max_g_force ? `${flight.max_g_force.toFixed(1)}G` : '-'}
                      </span>
                    </div>
                    {/* Maintenance */}
                    <div className="text-center hidden sm:block">
                      <span className={`text-[11px] font-bold ${(flight.maintenance_cost || 0) > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {flight.maintenance_cost ? `$${Math.round(flight.maintenance_cost).toLocaleString()}` : '-'}
                      </span>
                    </div>
                    {/* Deadline */}
                    <div className="text-center hidden sm:block">
                      {madeDeadline === true && <span className="text-[11px] font-bold text-emerald-400">✓</span>}
                      {madeDeadline === false && <span className="text-[11px] font-bold text-red-400">✗</span>}
                      {madeDeadline === undefined && <span className="text-[11px] text-slate-500">-</span>}
                    </div>
                    {/* Profit */}
                    <div className={`text-right text-xs sm:text-sm font-bold ${flight.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(flight.profit)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
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