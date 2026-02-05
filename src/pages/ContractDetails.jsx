import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plane,
  MapPin,
  ArrowRight,
  Users,
  Package,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Calendar,
  Fuel,
  Copy,
  Check
} from "lucide-react";

import FuelCalculator from "@/components/contracts/FuelCalculator";

export default function ContractDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('id');
  const [copiedField, setCopiedField] = React.useState(null);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const contracts = await base44.entities.Contract.filter({ id: contractId });
      return contracts[0];
    },
    enabled: !!contractId
  });

  const { data: aircraft } = useQuery({
    queryKey: ['aircraft'],
    queryFn: () => base44.entities.Aircraft.list(),
    select: (data) => data.find(a => contract?.required_aircraft_type?.includes(a.type))
  });

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading || !contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
          <Plane className="w-12 h-12 text-blue-400" />
        </motion.div>
      </div>
    );
  }

  const typeConfig = {
    passenger: { label: 'Passagierflug', color: 'bg-blue-500' },
    cargo: { label: 'Frachtflug', color: 'bg-amber-500' },
    charter: { label: 'Charterflug', color: 'bg-purple-500' },
    emergency: { label: 'Notfall', color: 'bg-red-500' }
  };

  const difficultyConfig = {
    easy: { label: 'Einfach', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
    medium: { label: 'Mittel', color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
    hard: { label: 'Schwer', color: 'text-red-400 bg-red-500/20 border-red-500/30' },
    extreme: { label: 'Extrem', color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' }
  };

  const payloadWeight = contract.type === 'passenger' 
    ? (contract.passenger_count || 0) * 85
    : (contract.cargo_weight_kg || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-5xl mx-auto p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button 
            variant="ghost" 
            onClick={() => navigate(createPageUrl("Contracts"))}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            ← Zurück zu Aufträgen
          </Button>
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">{contract.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={typeConfig[contract.type]?.color}>
                  {typeConfig[contract.type]?.label}
                </Badge>
                <Badge className={difficultyConfig[contract.difficulty]?.color}>
                  {difficultyConfig[contract.difficulty]?.label}
                </Badge>
                <Badge className="bg-slate-700 text-slate-300">
                  {contract.distance_nm?.toLocaleString()} NM
                </Badge>
              </div>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm text-slate-400">Vergütung</p>
              <p className="text-2xl lg:text-3xl font-bold text-emerald-400">
                ${contract.payout?.toLocaleString()}
              </p>
              {contract.bonus_potential > 0 && (
                <p className="text-xs text-amber-400">+ ${contract.bonus_potential?.toLocaleString()} Bonus möglich</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* X-Plane Setup Info */}
        <Card className="p-4 lg:p-6 bg-blue-900/20 border border-blue-700/50 mb-6">
          <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2">
            <Plane className="w-5 h-5" />
            X-Plane 12 Setup
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">Abflughafen (ICAO)</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(contract.departure_airport, 'departure')}
                  className="h-6 px-2"
                >
                  {copiedField === 'departure' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </Button>
              </div>
              <code className="text-blue-400 font-mono font-bold text-lg">{contract.departure_airport}</code>
              <p className="text-xs text-slate-500 mt-1">{contract.departure_city}</p>
            </div>

            <div className="bg-slate-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">Zielflughafen (ICAO)</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(contract.arrival_airport, 'arrival')}
                  className="h-6 px-2"
                >
                  {copiedField === 'arrival' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </Button>
              </div>
              <code className="text-emerald-400 font-mono font-bold text-lg">{contract.arrival_airport}</code>
              <p className="text-xs text-slate-500 mt-1">{contract.arrival_city}</p>
            </div>

            <div className="bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">Benötigter Flugzeugtyp</p>
              <p className="text-white font-medium">
                {contract.required_aircraft_type?.map(type => {
                  const typeLabels = {
                    small_prop: 'Kleines Propellerflugzeug',
                    turboprop: 'Turboprop',
                    regional_jet: 'Regionaljet',
                    narrow_body: 'Schmalrumpf',
                    wide_body: 'Großraumflugzeug',
                    cargo: 'Frachtflugzeug'
                  };
                  return typeLabels[type];
                }).join(', ')}
              </p>
            </div>

            <div className="bg-slate-900 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">Payload-Gewicht</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(payloadWeight.toString(), 'payload')}
                  className="h-6 px-2"
                >
                  {copiedField === 'payload' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </Button>
              </div>
              <p className="text-amber-400 font-mono font-bold text-lg">{payloadWeight.toLocaleString()} kg</p>
            </div>
          </div>
        </Card>

        {/* Fuel Calculator */}
        {aircraft && <FuelCalculator aircraft={aircraft} contract={contract} />}

        {/* Route & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card className="p-4 lg:p-6 bg-slate-800 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Flugdetails</h3>
            <div className="space-y-3">
              {contract.type === 'passenger' && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Passagiere
                  </span>
                  <span className="text-white font-medium">{contract.passenger_count}</span>
                </div>
              )}
              {contract.type === 'cargo' && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Fracht
                  </span>
                  <span className="text-white font-medium">{contract.cargo_weight_kg?.toLocaleString()} kg</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Distanz
                </span>
                <span className="text-white font-medium">{contract.distance_nm?.toLocaleString()} NM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Deadline
                </span>
                <span className="text-white font-medium">
                  {new Date(contract.deadline).toLocaleDateString('de-DE')}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4 lg:p-6 bg-slate-800 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Crew-Anforderungen</h3>
            <div className="space-y-3">
              {contract.required_crew?.captain > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kapitän</span>
                  <span className="text-white font-medium">{contract.required_crew.captain}</span>
                </div>
              )}
              {contract.required_crew?.first_officer > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Erster Offizier</span>
                  <span className="text-white font-medium">{contract.required_crew.first_officer}</span>
                </div>
              )}
              {contract.required_crew?.flight_attendant > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Flugbegleiter</span>
                  <span className="text-white font-medium">{contract.required_crew.flight_attendant}</span>
                </div>
              )}
              {contract.required_crew?.loadmaster > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Ladeoffizier</span>
                  <span className="text-white font-medium">{contract.required_crew.loadmaster}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Action Button */}
        {contract.status === 'available' && (
          <Button 
            onClick={() => navigate(createPageUrl("Contracts"))}
            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 h-12 text-lg"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Auftrag annehmen
          </Button>
        )}
      </div>
    </div>
  );
}