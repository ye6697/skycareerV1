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
                Mission Briefing – {contract.title}
              </h3>
              <div className="space-y-3">
                {contract.briefing && (
                  <p className="text-slate-300 leading-relaxed">{contract.briefing}</p>
                )}
                <p className="text-slate-400 text-sm leading-relaxed">
                  {contract.type === 'passenger' && `Du wurdest beauftragt, ${contract.passenger_count || 0} Passagiere sicher von ${contract.departure_airport} ${contract.departure_city ? `(${contract.departure_city})` : ''} nach ${contract.arrival_airport} ${contract.arrival_city ? `(${contract.arrival_city})` : ''} zu fliegen. Die Strecke beträgt ${contract.distance_nm?.toLocaleString() || 0} Nautische Meilen. Die Passagiere erwarten einen komfortablen und professionellen Flug – achte besonders auf sanfte Manöver, niedrige G-Kräfte und eine butterweiche Landung, um die Zufriedenheit zu maximieren. Je besser dein Flug-Score, desto höher fällt der Bonus aus. Halte die Deadline ein und vermeide Vorfälle wie Strömungsabriss, Overspeed oder harte Landungen, um Strafkosten und Score-Abzüge zu vermeiden.`}
                  {contract.type === 'cargo' && `Du hast den Auftrag erhalten, ${contract.cargo_weight_kg?.toLocaleString() || 0} kg Fracht von ${contract.departure_airport} ${contract.departure_city ? `(${contract.departure_city})` : ''} nach ${contract.arrival_airport} ${contract.arrival_city ? `(${contract.arrival_city})` : ''} zu transportieren. Die Distanz beträgt ${contract.distance_nm?.toLocaleString() || 0} NM. Stelle sicher, dass dein Flugzeug die nötige Frachtkapazität und Reichweite besitzt. Fracht ist weniger empfindlich als Passagiere, aber Vorfälle wie harte Landungen oder Strukturbelastung führen trotzdem zu Wartungskosten. Liefere pünktlich innerhalb der vorgegebenen Deadline, um Bonuszahlungen zu sichern.`}
                  {contract.type === 'charter' && `Exklusiver Charterauftrag: Fliege ${contract.passenger_count ? `${contract.passenger_count} VIP-Passagiere` : 'eine Gruppe'} von ${contract.departure_airport} ${contract.departure_city ? `(${contract.departure_city})` : ''} nach ${contract.arrival_airport} ${contract.arrival_city ? `(${contract.arrival_city})` : ''} über ${contract.distance_nm?.toLocaleString() || 0} NM. Charterflüge haben besonders hohe Anforderungen an Komfort und Pünktlichkeit. Die Gäste erwarten erstklassigen Service – eine butterweiche Landung und ein ruhiger, professioneller Flugverlauf werden mit erheblichen Bonuszahlungen belohnt. Jeder Vorfall wirkt sich deutlich stärker auf die Bewertung aus.`}
                  {contract.type === 'emergency' && `DRINGENDER NOTFALLEINSATZ: Du musst schnellstmöglich von ${contract.departure_airport} ${contract.departure_city ? `(${contract.departure_city})` : ''} nach ${contract.arrival_airport} ${contract.arrival_city ? `(${contract.arrival_city})` : ''} fliegen! Die Strecke beträgt ${contract.distance_nm?.toLocaleString() || 0} NM. Zeit ist der absolut kritische Faktor – die Deadline muss unbedingt eingehalten werden, da sonst der gesamte Auftrag als fehlgeschlagen gilt. Trotz des Zeitdrucks ist eine sichere Flugdurchführung Pflicht. Unfälle oder Vorfälle führen zu empfindlichen Strafen.`}
                </p>
              </div>
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

            {/* Full Scoring & Events Overview */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Score & Auswirkungen
              </h3>
              
              {/* Landing Quality - G-force based */}
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-2">Landequalität (nach G-Kraft)</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between items-center p-2 bg-emerald-900/20 rounded">
                  <span className="text-slate-300">Butterweich (&lt;0.5 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400 font-medium">+40 Score</span>
                    <span className="text-emerald-400">+4× Payout</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-emerald-900/20 rounded">
                  <span className="text-slate-300">Weich (&lt;1.0 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400 font-medium">+20 Score</span>
                    <span className="text-emerald-400">+2× Payout</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-900/20 rounded">
                  <span className="text-slate-300">Akzeptabel (&lt;1.6 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-blue-400 font-medium">+5 Score</span>
                    <span className="text-slate-500">kein Bonus</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Hart (&lt;2.0 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-30 Score</span>
                    <span className="text-amber-400">-25% Payout</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Sehr Hart (≥2.0 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-50 Score</span>
                    <span className="text-amber-400">-50% Payout</span>
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-2">Deadline</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between items-center p-2 bg-blue-900/10 rounded">
                  <span className="text-slate-300">Deadline eingehalten</span>
                  <span className="text-emerald-400 font-medium text-xs">+20 Score</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-900/10 rounded">
                  <span className="text-slate-300">Deadline überschritten</span>
                  <span className="text-red-400 font-medium text-xs">-20 Score</span>
                </div>
              </div>

              {/* Penalties */}
              <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">Straf-Events</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Heckaufsetzer (Tailstrike)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-20 Score</span>
                    <span className="text-amber-400">2% Wartung</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Overspeed</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-15 Score</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Klappen-Overspeed</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-15 Score</span>
                    <span className="text-amber-400">2.5% Wartung</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">G-Kraft ≥1.5 G (erste)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-10 Score</span>
                    <span className="text-amber-400">1% Wartung</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Jede weitere G-Stufe (2G, 3G…)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-10 Score/G</span>
                    <span className="text-amber-400">G×1% Wartung</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Strukturschaden (Overstress)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-30 Score</span>
                    <span className="text-amber-400">4% Wartung</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Strömungsabriss (Stall)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-50 Score</span>
                  </div>
                </div>
              </div>

              {/* Catastrophic */}
              <p className="text-xs text-red-500 font-semibold uppercase tracking-wider mb-2">Katastrophal</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center p-2 bg-red-900/20 border border-red-800/30 rounded">
                  <span className="text-red-300 font-medium">Landung ohne Fahrwerk</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-bold">-35 Score</span>
                    <span className="text-red-400 font-bold">15% Wartung</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/20 border border-red-800/30 rounded">
                  <span className="text-red-300 font-medium">Crash</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-bold">-100 Score</span>
                    <span className="text-red-400 font-bold">70% Wartung</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">Wartungskosten = % des Flugzeug-Neuwerts. Landebonus/-abzug basiert auf dem Auftrags-Payout. Score startet bei 100.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}