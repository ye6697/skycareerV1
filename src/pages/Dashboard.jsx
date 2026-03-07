import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
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
  AlertCircle,
  Save,
  PlayCircle,
  History,
  Settings,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";

import StatCard from "@/components/dashboard/StatCard";
import ReputationGauge from "@/components/dashboard/ReputationGauge";
import XPlaneStatus from "@/components/dashboard/XPlaneStatus";
import CreditScoreBadge from "@/components/dashboard/CreditScoreBadge";
import ContractCard from "@/components/contracts/ContractCard";
import { Check } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  
  const [simbriefUsername, setSimbriefUsername] = useState('');
  const [simbriefPilotId, setSimbriefPilotId] = useState('');
  const [simbriefSaved, setSimbriefSaved] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return null;
      return base44.auth.me();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!userLoading && user === null) {
      navigate(createPageUrl('Landing'));
    }
  }, [user, userLoading, navigate]);

  // Load saved SimBrief credentials
  useEffect(() => {
    if (user) {
      setSimbriefUsername(user.simbrief_username || '');
      setSimbriefPilotId(user.simbrief_pilot_id || '');
    }
  }, [user]);

  const saveSimBriefCredentials = async () => {
    const updateData = {};
    updateData.simbrief_username = simbriefUsername || '';
    updateData.simbrief_pilot_id = simbriefPilotId || '';
    await base44.auth.updateMe(updateData);
    setSimbriefSaved(true);
    setTimeout(() => setSimbriefSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['simbrief-credentials'] });
  };

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
    enabled: !!user,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  const companyId = company?.id;

  const { data: allContracts = [] } = useQuery({
    queryKey: ['contracts', 'available', companyId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailableContracts', {});
      return res.data.contracts || [];
    },
    enabled: !!companyId,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  const contracts = allContracts.filter(c => c.status === 'available' || !c.company_id);
  const acceptedContracts = allContracts.filter(c => c.status === 'accepted' && c.company_id === companyId);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId],
    queryFn: () => base44.entities.Employee.filter({ company_id: companyId, status: 'available' }),
    enabled: !!companyId,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  const { data: allAircraft = [] } = useQuery({
    queryKey: ['aircraft', 'all', companyId],
    queryFn: () => base44.entities.Aircraft.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  const aircraft = allAircraft.filter(a => a.status === 'available');

  const fleetValue = allAircraft.filter(a => a.status !== 'sold').reduce((sum, a) => sum + (a.current_value || 0), 0);

  const { data: recentFlights = [] } = useQuery({
    queryKey: ['flights', 'recent', companyId],
    queryFn: () => base44.entities.Flight.filter({ company_id: companyId, status: 'completed' }, '-created_date', 5),
    enabled: !!companyId,
    staleTime: 120000,
    refetchOnWindowFocus: false,
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
    if (amount === undefined || amount === null) return '$0';
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)} Mrd`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)} Mio`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}k`;
    return `$${amount.toLocaleString()}`;
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
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{t('welcome_skycareer', lang)}</h1>
          <p className="text-slate-600 mb-8">{t('start_career', lang)}</p>
          <Link to={createPageUrl("Setup")}>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              {t('create_company', lang)}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 max-w-5xl mx-auto">
      {/* Zibo Style Top Bar Info */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-900/80 border border-cyan-900/30 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center shadow-lg">
           <span className="text-[10px] sm:text-xs text-cyan-600/70 font-mono uppercase tracking-wider">{t('balance', lang)}</span>
           <span className="text-base sm:text-xl font-mono text-emerald-400 font-bold">{formatCurrency(company.balance)}</span>
        </div>
        <div className="bg-slate-900/80 border border-cyan-900/30 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center shadow-lg">
           <span className="text-[10px] sm:text-xs text-cyan-600/70 font-mono uppercase tracking-wider">{t('level', lang)}</span>
           <span className="text-base sm:text-xl font-mono text-cyan-400 font-bold">{company.level || 1}</span>
        </div>
        <div className="bg-slate-900/80 border border-cyan-900/30 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center shadow-lg">
           <span className="text-[10px] sm:text-xs text-cyan-600/70 font-mono uppercase tracking-wider">Reputation</span>
           <span className="text-base sm:text-xl font-mono text-amber-400 font-bold">{company.reputation || 0}%</span>
        </div>
        <div className="bg-slate-900/80 border border-cyan-900/30 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center shadow-lg">
           <span className="text-[10px] sm:text-xs text-cyan-600/70 font-mono uppercase tracking-wider">{t('fleet', lang)}</span>
           <span className="text-base sm:text-xl font-mono text-purple-400 font-bold">{allAircraft.filter(a => a.status !== 'sold').length}</span>
        </div>
      </div>

      {/* Main Grid Menu */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 auto-rows-fr">
        {[
          { name: t('nav_contracts', lang), icon: FileText, path: "Contracts", color: "text-blue-400", alert: acceptedContracts.length > 0 },
          { name: t('nav_active_flights', lang), icon: PlayCircle, path: "ActiveFlights", color: "text-emerald-400" },
          { name: t('nav_fleet', lang), icon: Plane, path: "Fleet", color: "text-cyan-400" },
          { name: t('nav_employees', lang), icon: Users, path: "Employees", color: "text-indigo-400" },
          { name: t('nav_finances', lang), icon: DollarSign, path: "Finances", color: "text-amber-400" },
          { name: t('nav_flight_history', lang), icon: History, path: "FlightHistory", color: "text-purple-400" },
          { name: "SETUP", icon: Settings, path: "XPlaneSetup", color: "text-slate-400" },
          { name: t('account', lang), icon: User, path: "Account", color: "text-rose-400" },
        ].map((item, i) => (
          <Link key={i} to={createPageUrl(item.path)} className="block h-full min-h-[140px]">
            <button className="w-full h-full bg-slate-900/90 border border-cyan-900/40 hover:border-cyan-400/60 hover:bg-slate-800/90 rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-300 relative group shadow-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {item.alert && <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />}
              <item.icon className={`w-12 h-12 ${item.color} group-hover:scale-110 group-hover:-translate-y-1 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]`} />
              <span className="font-mono text-xs sm:text-sm uppercase font-bold text-slate-300 tracking-wider group-hover:text-white transition-colors">{item.name}</span>
            </button>
          </Link>
        ))}
      </div>
      
      {/* SimBrief Bar at bottom */}
      <div className="bg-slate-900/80 border border-cyan-900/30 rounded-lg p-2 sm:p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg mt-auto">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-cyan-600" />
          <span className="text-xs font-mono uppercase text-cyan-600/70">SimBrief Integration</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={simbriefUsername}
            onChange={(e) => setSimbriefUsername(e.target.value)}
            placeholder="Username"
            className="h-7 text-xs font-mono bg-slate-950 border-cyan-900/50 w-24 sm:w-32 text-cyan-100"
          />
          <Input
            value={simbriefPilotId}
            onChange={(e) => setSimbriefPilotId(e.target.value)}
            placeholder="Pilot ID"
            className="h-7 text-xs font-mono bg-slate-950 border-cyan-900/50 w-20 sm:w-24 text-cyan-100"
          />
          <Button
            size="sm"
            onClick={saveSimBriefCredentials}
            className={`h-7 text-[10px] font-mono uppercase ${simbriefSaved ? 'bg-emerald-600 text-black hover:bg-emerald-500' : 'bg-cyan-900/50 text-cyan-400 border border-cyan-700 hover:bg-cyan-800'}`}
          >
            {simbriefSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    </div>
  );
}