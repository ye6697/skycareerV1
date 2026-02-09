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
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search,
  Plane,
  Star,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  ExternalLink
} from "lucide-react";

export default function FlightHistory() {
  const [searchTerm, setSearchTerm] = useState('');

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
  const avgScore = flights.length > 0 
    ? flights.reduce((sum, f) => sum + (f.xplane_data?.final_score ?? f.flight_score ?? 0), 0) / flights.length 
    : 0;

  const filteredFlights = flights.filter(f => {
    if (!searchTerm) return true;
    const contract = getContractForFlight(f);
    const search = searchTerm.toLowerCase();
    return (
      contract?.title?.toLowerCase().includes(search) ||
      contract?.departure_airport?.toLowerCase().includes(search) ||
      contract?.arrival_airport?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white">Flughistorie</h1>
          <p className="text-slate-400">Übersicht aller abgeschlossenen Flüge</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Plane className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Flüge Gesamt</p>
                <p className="text-2xl font-bold text-white">{flights.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Ø Score</p>
                <p className="text-2xl font-bold text-white">{Math.round(avgScore)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalProfit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {totalProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-400">Gesamtgewinn</p>
                <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-slate-800 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Ø Gewinn/Flug</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(flights.length > 0 ? totalProfit / flights.length : 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Flug suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 text-white border-slate-700"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <Card className="animate-pulse bg-slate-800 h-64 border-slate-700" />
        ) : filteredFlights.length > 0 ? (
          <Card className="overflow-hidden bg-slate-800 border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white">Datum</TableHead>
                  <TableHead className="text-white">Route</TableHead>
                  <TableHead className="text-white">Score</TableHead>
                  <TableHead className="text-white">Landung</TableHead>
                  <TableHead className="text-white">Einnahmen</TableHead>
                  <TableHead className="text-white">Gewinn</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFlights.map((flight) => {
                  const contract = getContractForFlight(flight);
                  const score = flight.xplane_data?.final_score ?? flight.flight_score ?? 0;
                  const landingType = flight.xplane_data?.landingType;
                  return (
                    <TableRow key={flight.id} className={`hover:bg-slate-700 ${flight.status === 'failed' ? 'bg-red-900/20' : ''}`}>
                      <TableCell className="text-white">
                       <div className="flex items-center gap-2">
                         <Calendar className="w-4 h-4 text-slate-400" />
                         {formatDate(flight.departure_time)}
                         {flight.status === 'failed' && (
                           <Badge className="bg-red-500/20 text-red-400 border-red-500/30 ml-2">Crash</Badge>
                         )}
                       </div>
                      </TableCell>
                      <TableCell className="text-white">
                       <span className="font-mono">
                         {contract?.departure_airport} → {contract?.arrival_airport}
                       </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold ${
                          score >= 85 ? 'text-emerald-400' :
                          score >= 70 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {Math.round(score)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${
                          landingType === 'butter' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          landingType === 'soft' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                          landingType === 'acceptable' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          landingType === 'hard' || landingType === 'very_hard' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                          'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}>
                          {landingType === 'butter' ? 'Butter' :
                           landingType === 'soft' ? 'Weich' :
                           landingType === 'acceptable' ? 'OK' :
                           landingType === 'hard' ? 'Hart' :
                           landingType === 'very_hard' ? 'Sehr hart' :
                           flight.status === 'failed' ? 'Crash' :
                           `${Math.abs(flight.landing_vs || 0)} ft/min`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-emerald-400 font-medium font-mono">
                        {formatCurrency(flight.revenue)}
                      </TableCell>
                      <TableCell className={`font-bold font-mono ${(flight.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(flight.profit)}
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`CompletedFlightDetails?flightId=${flight.id}`)}>
                          <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                            <ExternalLink className="w-4 h-4 mr-1" /> Details
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Keine Flüge</h3>
            <p className="text-slate-400">Du hast noch keine Flüge abgeschlossen.</p>
          </Card>
        )}
      </div>
    </div>
  );
}