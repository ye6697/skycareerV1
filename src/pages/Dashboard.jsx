import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plane,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  FileText,
  Clock,
  Star,
  ChevronRight,
  AlertCircle
} from "lucide-react";

import StatCard from "@/components/dashboard/StatCard";
import ReputationGauge from "@/components/dashboard/ReputationGauge";
import XPlaneStatus from "@/components/dashboard/XPlaneStatus";
import ContractCard from "@/components/contracts/ContractCard";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const userCompanyId = user?.company_id || user?.data?.company_id;

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', userCompanyId],
    queryFn: async () => {
      if (userCompanyId) {
        const companies = await base44.entities.Company.filter({ id: userCompanyId });
        if (companies[0]) return companies[0];
      }
      // Fallback: try finding company by created_by
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (companies[0]) {
        // Save company_id for future lookups
        await base44.auth.updateMe({ company_id: companies[0].id });
        return companies[0];
      }
      return null;
    },
    enabled: !!user
  });

  const companyId = company?.id;

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'available'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailableContracts', {});
      return res.data.contracts || [];
    },
    enabled: !!companyId
  });

  const { data: acceptedContracts = [] } = useQuery({
    queryKey: ['contracts', 'accepted', companyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailableContracts', {});
      const allContracts = res.data.contracts || [];
      return allContracts.filter(c => c.status === 'accepted' && c.company_id === companyId);
    },
    enabled: !!companyId
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId],
    queryFn: () => base44.entities.Employee.filter({ company_id: companyId, status: 'available' }),
    enabled: !!companyId
  });

  const { data: aircraft = [] } = useQuery({
    queryKey: ['aircraft', companyId],
    queryFn: () => base44.entities.Aircraft.filter({ company_id: companyId, status: 'available' }),
    enabled: !!companyId
  });

  const { data: allAircraft = [] } = useQuery({
    queryKey: ['aircraft', 'all', companyId],
    queryFn: () => base44.entities.Aircraft.filter({ company_id: companyId, status: { $ne: 'sold' } }),
    enabled: !!companyId
  });

  const { data: recentFlights = [] } = useQuery({
    queryKey: ['flights', 'recent', companyId],
    queryFn: () => base44.entities.Flight.filter({ company_id: companyId, status: 'completed' }, '-created_date', 5),
    enabled: !!companyId
  });

  // Filter contracts based on available aircraft capabilities
  const filteredContracts = React.useMemo(() => {
    if (!contracts.length || !aircraft.length) return contracts;

    return contracts.filter(contract => {
      // Check if any available aircraft can fulfill this contract
      return aircraft.some(plane => {
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
    }).slice(0, 10);
  }, [contracts, aircraft]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (companyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Plane className="w-12 h-12 text-blue-600" />
        </motion.div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg"
          >
            <Plane className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Willkommen bei SkyCareer</h1>
          <p className="text-slate-600 mb-8">Starte deine virtuelle Airline-Karriere mit X-Plane 12</p>
          <Link to={createPageUrl("Setup")}>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Unternehmen gründen
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{company.name}</h1>
              <p className="text-slate-400">{company.callsign} • Hub: {company.hub_airport || "Nicht festgelegt"}</p>
              {company.xplane_api_key && (
                <div className="mt-2 flex items-center gap-2 min-w-0">
                  <p className="text-xs text-slate-500 flex-shrink-0">API-Key:</p>
                  <code className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-1 rounded truncate">
                    {company.xplane_api_key}
                  </code>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Kontostand</p>
              <p className="text-xl sm:text-3xl font-bold text-emerald-600">{formatCurrency(company.balance)}</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard
            title="Flüge Gesamt"
            value={company.total_flights?.toLocaleString() || 0}
            icon={Plane}
            color="blue"
          />
          <StatCard
            title="Passagiere"
            value={company.total_passengers?.toLocaleString() || 0}
            icon={Users}
            color="purple"
          />
          <StatCard
            title="Fracht (kg)"
            value={company.total_cargo_kg?.toLocaleString() || 0}
            icon={Package}
            color="orange"
          />
          <StatCard
            title="Level"
            value={company.level || 1}
            subtitle="+10% Bonusgewinn/Level"
            icon={TrendingUp}
            color="amber"
          />
          <StatCard
            title="Mitarbeiter"
            value={employees.length}
            subtitle={`${employees.filter(e => e.role === 'captain' || e.role === 'first_officer').length} Piloten`}
            icon={Users}
            color="green"
          />
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <ReputationGauge reputation={company.reputation} level={company.level} />
          <XPlaneStatus status={company.xplane_connection_status} />
          
          {/* Quick Actions */}
          <Card className="p-6 bg-slate-800 border border-slate-700">
          <h3 className="font-semibold text-white mb-4">Schnellzugriff</h3>
            <div className="space-y-2">
              <Link to={createPageUrl("Contracts")} className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Aufträge durchsuchen
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to={createPageUrl("Employees")} className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Mitarbeiter einstellen
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to={createPageUrl("Fleet")} className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Plane className="w-4 h-4" />
                    Flotte verwalten
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Active Contracts Alert */}
        {acceptedContracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <Card className="p-4 bg-amber-900/20 border border-amber-700/50">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <div className="flex-1">
                  <p className="font-medium text-amber-100">
                    {acceptedContracts.length} aktive{acceptedContracts.length === 1 ? 'r' : ''} Auftrag wartet auf Durchführung
                  </p>
                  <p className="text-sm text-amber-300">
                    Verbinde X-Plane 12 und führe den Flug durch
                  </p>
                </div>
                <Link to={createPageUrl("ActiveFlights")}>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    Zu aktiven Flügen
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Available Contracts */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Verfügbare Aufträge</h2>
            <Link to={createPageUrl("Contracts")}>
              <Button variant="ghost" className="text-blue-600">
                Alle anzeigen <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          {filteredContracts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContracts.map((contract) => (
                <ContractCard key={contract.id} contract={contract} ownedAircraft={allAircraft} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center bg-slate-800 border border-slate-700">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Keine verfügbaren Aufträge</p>
            </Card>
          )}
        </div>

        {/* Recent Flights */}
         {recentFlights.length > 0 && (
           <div>
             <div className="flex items-center justify-between mb-4">
               <div>
                 <h2 className="text-xl font-semibold text-white">Letzter Flug</h2>
                 {recentFlights[0] && (
                   <p className="text-sm text-slate-400">
                     {recentFlights[0].departure_time ? new Date(recentFlights[0].departure_time).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                   </p>
                 )}
               </div>
               <Link to={createPageUrl("FlightHistory")}>
                 <Button variant="ghost" className="text-blue-600">
                   Alle anzeigen <ChevronRight className="w-4 h-4 ml-1" />
                 </Button>
               </Link>
             </div>
             <Card className="p-6 bg-slate-800 border border-slate-700">
               {recentFlights[0] && (
                 <div className="space-y-4">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                       <Plane className="w-6 h-6 text-blue-600" />
                     </div>
                     <div>
                       <p className="font-medium text-white">Flug #{recentFlights[0].id?.slice(-6)}</p>
                       <p className="text-sm text-slate-400">Status: Abgeschlossen</p>
                     </div>
                   </div>
                   <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-slate-900 rounded-lg">
                     <div className="text-center">
                       <p className="text-sm text-slate-400 mb-1">Bewertung</p>
                       <div className="flex items-center justify-center gap-1">
                         <Star className={`w-5 h-5 ${recentFlights[0].overall_rating >= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                         <span className="text-lg font-semibold text-white">{recentFlights[0].overall_rating?.toFixed(1) || '-'}</span>
                       </div>
                     </div>
                     <div className="text-center">
                       <p className="text-sm text-slate-400 mb-1">Gewinn</p>
                       <p className={`text-lg font-semibold ${recentFlights[0].profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                         {formatCurrency(recentFlights[0].profit)}
                       </p>
                     </div>
                     <div className="text-center">
                       <p className="text-sm text-slate-400 mb-1">Flugstunden</p>
                       <p className="text-lg font-semibold text-white">{(recentFlights[0].flight_duration_hours || 0).toFixed(1)}h</p>
                     </div>
                   </div>
                 </div>
               )}
             </Card>
           </div>
         )}
      </div>
    </div>
  );
}