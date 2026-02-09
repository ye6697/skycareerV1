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
  ArrowLeft,
  MapPin,
  DollarSign,
  Plane,
  Users,
  Package,
  Clock,
  Star,
  AlertTriangle,
  User
} from "lucide-react";

export default function ContractDetails() {
  const navigate = useNavigate();
  
  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('id');

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const contracts = await base44.entities.Contract.filter({ id: contractId });
      return contracts[0];
    },
    enabled: !!contractId
  });

  const typeConfig = {
    passenger: { icon: Users, color: "blue", label: "Passagiere" },
    cargo: { icon: Package, color: "orange", label: "Fracht" },
    charter: { icon: Star, color: "purple", label: "Charter" },
    emergency: { icon: Clock, color: "red", label: "Notfall" }
  };

  const difficultyConfig = {
    easy: { color: "bg-emerald-100 text-emerald-700", label: "Einfach" },
    medium: { color: "bg-blue-100 text-blue-700", label: "Mittel" },
    hard: { color: "bg-orange-100 text-orange-700", label: "Schwer" },
    extreme: { color: "bg-red-100 text-red-700", label: "Extrem" }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Lädt...</div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white mb-4">Auftrag nicht gefunden</p>
          <Button 
            onClick={() => navigate(createPageUrl("Contracts"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Zurück zu Aufträgen
          </Button>
        </div>
      </div>
    );
  }

  const config = typeConfig[contract.type] || typeConfig.passenger;
  const difficulty = difficultyConfig[contract.difficulty] || difficultyConfig.medium;
  const TypeIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 sm:mb-8"
        >
          <Button 
            variant="ghost"
            onClick={() => navigate(createPageUrl("Contracts"))}
            className="mb-4 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zu Aufträgen
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{contract.title}</h1>
                <Badge className={`${difficulty.color} border`}>
                  {difficulty.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {contract.departure_airport} {contract.departure_city && `(${contract.departure_city})`}
                </span>
                <span>→</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {contract.arrival_airport} {contract.arrival_city && `(${contract.arrival_city})`}
                </span>
              </div>
            </div>
            <div className="sm:text-right flex-shrink-0">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">
                ${Math.round(contract.payout || 0).toLocaleString()}
              </p>
              {contract.bonus_potential > 0 && (
                <p className="text-sm text-amber-400">
                  +${Math.round(contract.bonus_potential).toLocaleString()} Bonus möglich
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Mission Briefing */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <TypeIcon className={`w-5 h-5 ${
                  config.color === "blue" ? "text-blue-400" :
                  config.color === "orange" ? "text-orange-400" :
                  config.color === "purple" ? "text-purple-400" :
                  "text-red-400"
                }`} />
                Mission Briefing
              </h3>
              {contract.briefing ? (
                <div className="space-y-3">
                  <p className="text-slate-300 leading-relaxed">{contract.briefing}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {contract.type === 'passenger' && `Dieser Passagierflug von ${contract.departure_airport} ${contract.departure_city ? `(${contract.departure_city})` : ''} nach ${contract.arrival_airport} ${contract.arrival_city ? `(${contract.arrival_city})` : ''} erfordert eine professionelle und komfortable Durchführung. ${contract.passenger_count || 0} Passagiere erwarten einen sicheren und pünktlichen Transport über eine Distanz von ${contract.distance_nm?.toLocaleString() || 0} Nautischen Meilen. Achte auf eine sanfte Landung und halte die G-Kräfte niedrig, um die Passagierzufriedenheit zu maximieren und den bestmöglichen Bonus zu erzielen.`}
                    {contract.type === 'cargo' && `Für diesen Frachtauftrag müssen ${contract.cargo_weight_kg?.toLocaleString() || 0} kg Ladung sicher von ${contract.departure_airport} nach ${contract.arrival_airport} transportiert werden. Die Strecke beträgt ${contract.distance_nm?.toLocaleString() || 0} NM. Stelle sicher, dass dein Flugzeug die nötige Frachtkapazität und Reichweite besitzt. Eine pünktliche Lieferung innerhalb der Deadline wird zusätzlich belohnt.`}
                    {contract.type === 'charter' && `Ein exklusiver Charterflug von ${contract.departure_airport} nach ${contract.arrival_airport} über ${contract.distance_nm?.toLocaleString() || 0} NM. Charterflüge haben besonders hohe Anforderungen an Komfort und Pünktlichkeit. Die Passagiere erwarten erstklassigen Service – eine butterweiche Landung und ruhiger Flugverlauf werden mit erheblichen Bonuszahlungen belohnt.`}
                    {contract.type === 'emergency' && `DRINGEND: Notfalleinsatz von ${contract.departure_airport} nach ${contract.arrival_airport}! Die Strecke beträgt ${contract.distance_nm?.toLocaleString() || 0} NM und muss schnellstmöglich geflogen werden. Zeit ist der kritische Faktor – die Deadline muss unbedingt eingehalten werden. Trotz des Zeitdrucks ist eine sichere Flugdurchführung Pflicht.`}
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 text-sm leading-relaxed">
                  {contract.type === 'passenger' ? `Passagierflug von ${contract.departure_airport} nach ${contract.arrival_airport} über ${contract.distance_nm?.toLocaleString() || 0} NM. ${contract.passenger_count || 0} Passagiere warten auf einen komfortablen und sicheren Flug. Achte auf sanfte Manöver und eine weiche Landung für maximale Zufriedenheit.` :
                   contract.type === 'cargo' ? `Frachtauftrag: ${contract.cargo_weight_kg?.toLocaleString() || 0} kg von ${contract.departure_airport} nach ${contract.arrival_airport}. Distanz: ${contract.distance_nm?.toLocaleString() || 0} NM. Sichere und pünktliche Lieferung ist gefragt.` :
                   `Flugauftrag von ${contract.departure_airport} nach ${contract.arrival_airport} über ${contract.distance_nm?.toLocaleString() || 0} NM. Führe den Flug professionell und sicher durch.`}
                </p>
              )}
            </Card>

            {/* Flight Details */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plane className="w-5 h-5 text-blue-400" />
                Flugdetails
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-xs sm:text-sm mb-1">Entfernung</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-400">
                    {contract.distance_nm?.toLocaleString()} NM
                  </p>
                </div>
                {contract.passenger_count > 0 && (
                  <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-xs sm:text-sm mb-1">Passagiere</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                      {contract.passenger_count}
                    </p>
                  </div>
                )}
                {contract.cargo_weight_kg > 0 && (
                  <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-xs sm:text-sm mb-1">Fracht</p>
                    <p className="text-xl sm:text-2xl font-bold text-orange-400">
                      {contract.cargo_weight_kg?.toLocaleString()} kg
                    </p>
                  </div>
                )}
                <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-xs sm:text-sm mb-1">Deadline</p>
                  <p className="text-lg sm:text-xl font-bold text-amber-400">
                    {contract.deadline_minutes ? `${contract.deadline_minutes} min` : contract.deadline ? new Date(contract.deadline).toLocaleDateString('de-DE') : 'Keine'}
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-xs sm:text-sm mb-1">Auftragstyp</p>
                  <p className="text-lg sm:text-xl font-bold text-purple-400">
                    {config.label}
                  </p>
                </div>
                {contract.level_requirement > 1 && (
                  <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-xs sm:text-sm mb-1">Min. Level</p>
                    <p className="text-xl sm:text-2xl font-bold text-amber-400">
                      {contract.level_requirement}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Financial Overview */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Vergütung
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                  <span className="text-slate-400">Grundvergütung</span>
                  <span className="text-emerald-400 font-bold text-lg">${Math.round(contract.payout || 0).toLocaleString()}</span>
                </div>
                {contract.bonus_potential > 0 && (
                  <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                    <span className="text-slate-400">Max. Bonus (perfekte Landung)</span>
                    <span className="text-amber-400 font-bold">+${Math.round(contract.bonus_potential).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                  <span className="text-emerald-300 font-medium">Max. Gesamterlös</span>
                  <span className="text-emerald-400 font-bold text-xl">${Math.round((contract.payout || 0) + (contract.bonus_potential || 0)).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Abzüglich Treibstoff-, Crew- und Wartungskosten. Der tatsächliche Gewinn hängt von Flugdauer, Landequalität und Events ab.
                </p>
              </div>
            </Card>

            {/* Required Aircraft */}
            {contract.required_aircraft_type && contract.required_aircraft_type.length > 0 && (
              <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4">Benötigtes Flugzeug</h3>
                <div className="flex flex-wrap gap-2">
                  {contract.required_aircraft_type.map((type) => (
                    <Badge key={type} className="bg-blue-500/20 text-blue-400 border-blue-400/50 px-3 sm:px-4 py-2">
                      <Plane className="w-4 h-4 mr-2" />
                      {type === 'small_prop' ? 'Propeller (Klein)' :
                       type === 'turboprop' ? 'Turboprop' :
                       type === 'regional_jet' ? 'Regionaljet' :
                       type === 'narrow_body' ? 'Narrow-Body' :
                       type === 'wide_body' ? 'Wide-Body' :
                       type === 'cargo' ? 'Fracht' : type}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Required Crew */}
            {contract.required_crew && (
              <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  Benötigte Crew
                </h3>
                <div className="space-y-3">
                  {Object.entries(contract.required_crew).map(([role, count]) => {
                    if (count === 0) return null;
                    const roleLabels = {
                      captain: 'Kapitän',
                      first_officer: 'Erster Offizier',
                      flight_attendant: 'Flugbegleiter/in',
                      loadmaster: 'Lademeister'
                    };
                    return (
                      <div key={role} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">{roleLabels[role] || role}</span>
                        </div>
                        <Badge variant="outline" className="text-white">
                          {count}x
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Status */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4">Status</h3>
              <Badge className={`${
                contract.status === 'available' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                contract.status === 'accepted' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                contract.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                contract.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                contract.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                'bg-slate-500/20 text-slate-400'
              } px-4 py-2`}>
                {contract.status === 'available' ? 'Verfügbar' :
                 contract.status === 'accepted' ? 'Angenommen' :
                 contract.status === 'in_progress' ? 'Im Flug' :
                 contract.status === 'completed' ? 'Abgeschlossen' :
                 contract.status === 'failed' ? 'Fehlgeschlagen' :
                 contract.status}
              </Badge>
            </Card>

            {/* Scoring Info */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Bewertungs-Info
              </h3>
              <div className="space-y-2 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Butterweiche Landung (&lt;0.5G)</span>
                  <span className="text-emerald-400 font-medium">+40 Punkte</span>
                </div>
                <div className="flex justify-between">
                  <span>Weiche Landung (&lt;1.0G)</span>
                  <span className="text-emerald-400 font-medium">+20 Punkte</span>
                </div>
                <div className="flex justify-between">
                  <span>Harte Landung (&gt;1.6G)</span>
                  <span className="text-red-400 font-medium">-30 Punkte</span>
                </div>
                <div className="flex justify-between">
                  <span>Deadline eingehalten</span>
                  <span className="text-emerald-400 font-medium">+20 Punkte</span>
                </div>
                <div className="flex justify-between">
                  <span>Deadline verpasst</span>
                  <span className="text-red-400 font-medium">-20 Punkte</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}