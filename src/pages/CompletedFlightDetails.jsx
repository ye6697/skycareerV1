import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Plane,
  Star,
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Clock,
  Gauge,
  MessageCircle,
  Wrench,
  TrendingUp
} from "lucide-react";

// Einheitliche Hilfsfunktionen
const formatCurrency = (amount) => `$${Math.round(amount || 0).toLocaleString()}`;

const getScoreColor = (score) => {
  if (score >= 95) return "text-emerald-400";
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-amber-400";
  if (score >= 50) return "text-orange-400";
  return "text-red-400";
};

const getScoreLabel = (score) => {
  if (score >= 95) return "Ausgezeichnet";
  if (score >= 85) return "Sehr Gut";
  if (score >= 70) return "Gut";
  if (score >= 50) return "Akzeptabel";
  return "Schlecht";
};

const getLandingLabel = (type) => {
  const labels = {
    butter: { text: 'BUTTERWEICHE LANDUNG!', color: 'text-amber-400', icon: Star, bg: 'from-amber-600 to-amber-500' },
    soft: { text: 'Weiche Landung', color: 'text-emerald-400', icon: CheckCircle2, bg: 'from-emerald-600 to-emerald-500' },
    acceptable: { text: 'Akzeptable Landung', color: 'text-blue-400', icon: CheckCircle2, bg: 'from-blue-600 to-blue-500' },
    hard: { text: 'Harte Landung', color: 'text-red-400', icon: AlertTriangle, bg: 'from-red-600 to-red-500' },
    very_hard: { text: 'Sehr Harte Landung', color: 'text-red-500', icon: AlertTriangle, bg: 'from-red-700 to-red-600' },
    crash: { text: 'CRASH', color: 'text-red-500', icon: AlertTriangle, bg: 'from-red-800 to-red-700' },
  };
  return labels[type] || labels.acceptable;
};

export default function CompletedFlightDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('contractId');
  const flightId = urlParams.get('flightId');

  // Lade Company für company_id
  const { data: company } = useQuery({
    queryKey: ['company-for-flight'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const companies = await base44.entities.Company.filter({ id: cid });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0];
    }
  });

  // Lade Flight - entweder über flightId oder contractId
  const { data: flight, isLoading: flightLoading } = useQuery({
    queryKey: ['flight-detail', flightId, contractId, company?.id],
    queryFn: async () => {
      if (flightId) {
        const flights = await base44.entities.Flight.filter({ id: flightId });
        return flights[0] || null;
      }
      if (contractId && company?.id) {
        const flights = await base44.entities.Flight.filter({ 
          contract_id: contractId, 
          company_id: company.id 
        }, '-created_date', 1);
        return flights[0] || null;
      }
      return null;
    },
    enabled: !!(flightId || (contractId && company?.id))
  });

  // Lade Contract
  const { data: contract, isLoading: contractLoading } = useQuery({
    queryKey: ['contract-detail', contractId, flight?.contract_id],
    queryFn: async () => {
      const cId = contractId || flight?.contract_id;
      if (!cId) return null;
      const contracts = await base44.entities.Contract.filter({ id: cId });
      return contracts[0] || null;
    },
    enabled: !!(contractId || flight?.contract_id)
  });

  // Lade GameSettings
  const { data: gameSettings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const settings = await base44.entities.GameSettings.list();
      return settings[0] || null;
    }
  });

  // Loading State
  if (flightLoading || contractLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <Plane className="w-12 h-12 text-blue-400 mx-auto" />
          </motion.div>
          <p className="text-white mt-4">Flugdaten werden geladen...</p>
        </div>
      </div>
    );
  }

  if (!flight || !contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white mb-4">Flugdaten nicht gefunden</p>
          <Button onClick={() => navigate(createPageUrl("ActiveFlights"))} className="bg-blue-600 hover:bg-blue-700">
            Zurück
          </Button>
        </div>
      </div>
    );
  }

  // === SINGLE SOURCE OF TRUTH: Alles aus dem Flight-Record ===
  const xd = flight.xplane_data || {};
  const isCrash = xd.events?.crash === true || flight.status === 'failed';
  const score = xd.final_score ?? flight.flight_score ?? 0;
  const landingGForce = xd.landingGForce ?? xd.landing_g_force ?? flight.max_g_force ?? 0;
  const landingVs = Math.abs(flight.landing_vs || xd.landingVs || 0);
  const landingType = xd.landingType || (isCrash ? 'crash' : null);
  const landingScoreChange = xd.landingScoreChange || 0;
  const landingBonus = xd.landingBonus || 0;
  const landingMaintenanceCost = xd.landingMaintenanceCost || 0;
  const maxGForce = xd.maxGForce || flight.max_g_force || 0;
  const events = xd.events || {};
  const levelBonus = xd.levelBonus || 0;
  const levelBonusPercent = xd.levelBonusPercent || 0;
  const companyLevel = xd.companyLevel || 1;
  const crashMaintenanceCost = xd.crashMaintenanceCost || 0;
  const eventMaintenanceCost = xd.maintenanceCost || 0;
  const landingInfo = getLandingLabel(landingType);
  const LandingIcon = landingInfo.icon;

  // Active events
  const activeEvents = Object.entries(events).filter(([_, val]) => val === true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{contract.title}</h1>
                {isCrash ? (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> CRASH
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Abgeschlossen
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-slate-400">
                <span className="flex items-center gap-1 font-mono"><MapPin className="w-4 h-4" /> {contract.departure_airport}</span>
                <span>→</span>
                <span className="flex items-center gap-1 font-mono"><MapPin className="w-4 h-4" /> {contract.arrival_airport}</span>
                <span className="text-slate-600">|</span>
                <span>{contract.distance_nm} NM</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* === LINKE SPALTE === */}
          <div className="lg:col-span-2 space-y-6">

            {/* Score Card */}
            <Card className="p-6 bg-slate-800 border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400" /> Flug-Bewertung
                </h3>
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl border border-slate-600">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{Math.round(score)}</span>
                  <span className="text-sm text-slate-400">/ 100</span>
                </div>
              </div>
              <Progress value={score} className="h-3 bg-slate-700 mb-2" />
              <p className={`text-center font-semibold ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
            </Card>

            {/* Landing Quality */}
            {landingType && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LandingIcon className={`w-5 h-5 ${landingInfo.color}`} /> Landungs-Qualität
                </h3>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`mb-6 p-6 rounded-lg bg-gradient-to-br ${landingInfo.bg} text-white text-center`}
                >
                  <p className="text-sm opacity-80 mb-2">Landungsqualität</p>
                  <p className="text-3xl font-bold">{landingInfo.text}</p>
                </motion.div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-xs text-slate-400 mb-2">G-Kraft beim Aufsetzen</p>
                    <p className={`text-2xl font-bold font-mono ${
                      landingGForce < 0.5 ? 'text-amber-400' :
                      landingGForce < 1.0 ? 'text-emerald-400' :
                      landingGForce < 1.6 ? 'text-blue-400' :
                      landingGForce < 2.0 ? 'text-red-400' : 'text-red-500'
                    }`}>
                      {isCrash ? 'CRASH' : `${landingGForce.toFixed(2)} G`}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-lg">
                    <p className="text-xs text-slate-400 mb-2">Sinkrate beim Landen</p>
                    <p className={`text-2xl font-bold font-mono ${
                      landingVs < 100 ? 'text-emerald-400' :
                      landingVs < 150 ? 'text-green-400' :
                      landingVs < 300 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {landingVs} ft/min
                    </p>
                  </div>
                </div>

                {/* Score & Finanzielle Auswirkung */}
                {(landingScoreChange !== 0 || landingBonus > 0 || landingMaintenanceCost > 0) && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-900 rounded-lg">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Score-Auswirkung</p>
                      <p className={`font-mono font-bold ${
                        landingScoreChange > 0 ? 'text-emerald-400' :
                        landingScoreChange < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {landingScoreChange > 0 ? '+' : ''}{landingScoreChange} Punkte
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Finanzielle Auswirkung</p>
                      {landingBonus > 0 ? (
                        <p className="font-mono font-bold text-emerald-400">+{formatCurrency(landingBonus)}</p>
                      ) : landingMaintenanceCost > 0 ? (
                        <p className="font-mono font-bold text-red-400">-{formatCurrency(landingMaintenanceCost)}</p>
                      ) : (
                        <p className="text-slate-400">-</p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Flugdetails */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-400" /> Flugdetails
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-xs text-slate-400 mb-1">Max G-Kraft</p>
                  <p className={`text-xl font-mono font-bold ${
                    maxGForce < 1.3 ? 'text-emerald-400' :
                    maxGForce < 1.8 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {maxGForce.toFixed(2)} G
                  </p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-xs text-slate-400 mb-1">Treibstoff verbraucht</p>
                  <p className="text-xl font-mono font-bold text-blue-400">
                    {Math.round(flight.fuel_used_liters || 0)} L
                  </p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-xs text-slate-400 mb-1">Flugdauer</p>
                  <p className="text-xl font-mono font-bold text-purple-400">
                    {(flight.flight_duration_hours || 0).toFixed(1)} h
                  </p>
                </div>
              </div>
            </Card>

            {/* Wartungskosten-Aufschlüsselung */}
            {(eventMaintenanceCost > 0 || crashMaintenanceCost > 0) && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-red-400" /> Wartungskosten-Aufschlüsselung
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300 p-2 bg-slate-900 rounded">
                    <span>Reguläre Wartung ({(flight.flight_duration_hours || 0).toFixed(1)}h × $400/h)</span>
                    <span className="text-amber-400 font-mono">{formatCurrency((flight.flight_duration_hours || 0) * 400)}</span>
                  </div>
                  {eventMaintenanceCost > 0 && (
                    <div className="flex justify-between text-slate-300 p-2 bg-slate-900 rounded">
                      <span>Event-Schäden im Flug</span>
                      <span className="text-red-400 font-mono">{formatCurrency(eventMaintenanceCost)}</span>
                    </div>
                  )}
                  {crashMaintenanceCost > 0 && (
                    <div className="flex justify-between text-slate-300 p-2 bg-slate-900 rounded">
                      <span>Crash-Reparatur (70% des Neuwertes)</span>
                      <span className="text-red-500 font-bold font-mono">{formatCurrency(crashMaintenanceCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-700 font-bold p-2">
                    <span className="text-white">Gesamt Wartungskosten</span>
                    <span className="text-red-400 font-mono">{formatCurrency(flight.maintenance_cost)}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Vorfälle */}
            {activeEvents.length > 0 && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" /> Vorfälle während des Fluges
                </h3>
                <div className="space-y-2">
                  {events.crash === true && (
                    <div className="flex items-center gap-2 text-red-400 text-sm font-bold p-2 bg-red-900/20 rounded">
                      <AlertTriangle className="w-4 h-4" /> CRASH (-100 Punkte, Wartung: 70% Neuwert)
                    </div>
                  )}
                  {events.tailstrike === true && (
                    <div className="flex items-center gap-2 text-red-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Heckaufsetzer (-20 Punkte)
                    </div>
                  )}
                  {events.stall === true && (
                    <div className="flex items-center gap-2 text-red-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Strömungsabriss (-50 Punkte)
                    </div>
                  )}
                  {events.overstress === true && (
                    <div className="flex items-center gap-2 text-orange-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Strukturbelastung (-30 Punkte)
                    </div>
                  )}
                  {events.flaps_overspeed === true && (
                    <div className="flex items-center gap-2 text-orange-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Klappen-Overspeed
                    </div>
                  )}
                  {events.gear_up_landing === true && (
                    <div className="flex items-center gap-2 text-red-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Landung ohne Fahrwerk
                    </div>
                  )}
                  {events.high_g_force === true && (
                    <div className="flex items-center gap-2 text-orange-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Hohe G-Kräfte (Max: {maxGForce.toFixed(2)} G)
                    </div>
                  )}
                  {events.hard_landing === true && (
                    <div className="flex items-center gap-2 text-red-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Harte Landung
                    </div>
                  )}
                  {events.harsh_controls === true && (
                    <div className="flex items-center gap-2 text-orange-400 text-sm p-2 bg-slate-900 rounded">
                      <AlertTriangle className="w-4 h-4" /> Ruppige Steuerung
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Passagier-Kommentare */}
            {flight.passenger_comments?.length > 0 && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-slate-400" /> Passagier-Kommentare
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {flight.passenger_comments.map((comment, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-3 bg-slate-900 rounded-lg text-sm text-slate-300 italic"
                    >
                      "{comment}"
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* === RECHTE SPALTE: Finanzen === */}
          <div className="space-y-6">
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" /> Finanzübersicht
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <span className="text-slate-400">Auftrag-Payout</span>
                  <span className="text-emerald-400 font-mono">{formatCurrency(contract.payout)}</span>
                </div>
                {landingBonus > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Landequalitäts-Bonus</span>
                    <span className="text-emerald-400 font-mono">+{formatCurrency(landingBonus)}</span>
                  </div>
                )}
                {levelBonus > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-amber-400">Level-Bonus (Lv.{companyLevel} × {levelBonusPercent.toFixed(0)}%)</span>
                    <span className="text-amber-400 font-mono">+{formatCurrency(levelBonus)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <span className="text-slate-400">Treibstoff ({Math.round(flight.fuel_used_liters || 0)} L)</span>
                  <span className="text-red-400 font-mono">-{formatCurrency(flight.fuel_cost)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <span className="text-slate-400">Crew ({(flight.flight_duration_hours || 0).toFixed(1)}h)</span>
                  <span className="text-red-400 font-mono">-{formatCurrency(flight.crew_cost)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                  <span className="text-slate-400">Flughafen-Gebühren</span>
                  <span className="text-red-400 font-mono">-$150</span>
                </div>
                {(flight.maintenance_cost || 0) > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">Wartung</span>
                    <span className="text-red-400 font-mono">-{formatCurrency(flight.maintenance_cost)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3">
                  <span className="font-semibold">Einnahmen</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {formatCurrency(flight.revenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-semibold">Gewinn/Verlust</span>
                  <span className={`text-xl font-bold font-mono ${(flight.profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(flight.profit)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" /> XP-Belohnung
              </h3>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-400">+{Math.round(score)} XP</p>
                <p className="text-sm text-slate-400 mt-1">Basierend auf dem Flug-Score</p>
              </div>
            </Card>

            {/* Datum */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Clock className="w-4 h-4" />
                <span>
                  {flight.departure_time ? new Date(flight.departure_time).toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '-'}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}