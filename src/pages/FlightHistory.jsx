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

  const { data: flights = [], isLoading } = useQuery({
    queryKey: ['flights', 'history'],
    queryFn: () => base44.entities.Flight.filter({ status: 'completed' }, '-created_date')
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'all'],
    queryFn: () => base44.entities.Contract.list()
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
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plane className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Flüge Gesamt</p>
                <p className="text-2xl font-bold text-slate-900">{flights.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Ø Bewertung</p>
                <p className="text-2xl font-bold text-white">{avgRating.toFixed(1)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {totalProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-400">Gesamtgewinn</p>
                <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
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
          <Card className="animate-pulse bg-slate-100 h-64" />
        ) : flights.length > 0 ? (
          <Card className="overflow-hidden bg-slate-800 border border-slate-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Bewertung</TableHead>
                  <TableHead>Landung</TableHead>
                  <TableHead>Einnahmen</TableHead>
                  <TableHead>Kosten</TableHead>
                  <TableHead>Gewinn</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flights.map((flight) => {
                  const contract = getContractForFlight(flight);
                  return (
                    <TableRow 
                      key={flight.id} 
                      className="cursor-pointer hover:bg-slate-700"
                      onClick={() => setSelectedFlight(flight)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formatDate(flight.departure_time)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {contract?.departure_airport} → {contract?.arrival_airport}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className={`w-4 h-4 ${
                            flight.overall_rating >= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                          }`} />
                          <span className="font-medium">{flight.overall_rating?.toFixed(1) || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${
                          Math.abs(flight.landing_vs || 0) < 150 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : Math.abs(flight.landing_vs || 0) < 300
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {flight.landing_vs} ft/min
                        </Badge>
                      </TableCell>
                      <TableCell className="text-emerald-600 font-medium">
                        {formatCurrency(flight.revenue)}
                      </TableCell>
                      <TableCell className="text-red-500">
                        -{formatCurrency((flight.fuel_cost || 0) + (flight.crew_cost || 0) + (flight.maintenance_cost || 0))}
                      </TableCell>
                      <TableCell className={`font-bold ${flight.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatCurrency(flight.profit)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Details</Button>
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

        {/* Flight Detail Dialog */}
        <Dialog open={!!selectedFlight} onOpenChange={() => setSelectedFlight(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Flugdetails</DialogTitle>
            </DialogHeader>
            {selectedFlight && (
              <div className="space-y-4">
                <FlightRating flight={selectedFlight} />
                
                <Card className="p-4 bg-slate-50">
                  <h4 className="font-semibold mb-3">Finanzübersicht</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Einnahmen</span>
                      <span className="text-emerald-600 font-medium">
                        {formatCurrency(selectedFlight.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Treibstoffkosten</span>
                      <span className="text-red-500">-{formatCurrency(selectedFlight.fuel_cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Crew-Kosten</span>
                      <span className="text-red-500">-{formatCurrency(selectedFlight.crew_cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Wartungskosten</span>
                      <span className="text-red-500">-{formatCurrency(selectedFlight.maintenance_cost)}</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-bold">
                      <span>Gewinn</span>
                      <span className={selectedFlight.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>
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