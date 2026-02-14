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
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function ContractDetails() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  
  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('id');

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const contracts = await base44.entities.Contract.filter({ id: contractId });
      return contracts[0];
    },
    enabled: !!contractId,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const typeConfig = {
    passenger: { icon: Users, color: "blue", label: t('passenger', lang) },
    cargo: { icon: Package, color: "orange", label: t('cargo', lang) },
    charter: { icon: Star, color: "purple", label: t('charter', lang) },
    emergency: { icon: Clock, color: "red", label: t('emergency', lang) }
  };

  const difficultyConfig = {
    easy: { color: "bg-emerald-100 text-emerald-700", label: t('easy', lang) },
    medium: { color: "bg-blue-100 text-blue-700", label: t('medium', lang) },
    hard: { color: "bg-orange-100 text-orange-700", label: t('hard', lang) },
    extreme: { color: "bg-red-100 text-red-700", label: t('extreme', lang) }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">{t('loading', lang)}</div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white mb-4">{t('contract_not_found', lang)}</p>
          <Button 
            onClick={() => navigate(createPageUrl("Contracts"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t('back_to_contracts', lang)}
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
            {t('back_to_contracts', lang)}
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
                  +${Math.round(contract.bonus_potential).toLocaleString()} {t('bonus_possible', lang)}
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
                {lang === 'de' ? 'Mission Briefing' : 'Mission Briefing'} – {contract.title}
              </h3>
              <div className="space-y-3">
                {contract.briefing && (
                  <p className="text-slate-300 leading-relaxed">{contract.briefing}</p>
                )}
                <p className="text-slate-400 text-sm leading-relaxed">
                  {lang === 'de' ? (
                    <>
                      {contract.type === 'passenger' && `Du wurdest beauftragt, ${contract.passenger_count || 0} Passagiere sicher von ${contract.departure_airport} ${contract.departure_city ? `(${contract.departure_city})` : ''} nach ${contract.arrival_airport} ${contract.arrival_city ? `(${contract.arrival_city})` : ''} zu fliegen. Die Strecke beträgt ${contract.distance_nm?.toLocaleString() || 0} NM. Die Passagiere erwarten einen komfortablen und professionellen Flug. Je besser dein Flug-Score, desto höher fällt der Bonus aus.`}
                      {contract.type === 'cargo' && `Du hast den Auftrag erhalten, ${contract.cargo_weight_kg?.toLocaleString() || 0} kg Fracht von ${contract.departure_airport} nach ${contract.arrival_airport} zu transportieren. Die Distanz beträgt ${contract.distance_nm?.toLocaleString() || 0} NM. Liefere pünktlich, um Bonuszahlungen zu sichern.`}
                      {contract.type === 'charter' && `Exklusiver Charterauftrag: Fliege ${contract.passenger_count ? `${contract.passenger_count} VIP-Passagiere` : 'eine Gruppe'} von ${contract.departure_airport} nach ${contract.arrival_airport} über ${contract.distance_nm?.toLocaleString() || 0} NM. Charterflüge haben besonders hohe Anforderungen an Komfort und Pünktlichkeit.`}
                      {contract.type === 'emergency' && `DRINGENDER NOTFALLEINSATZ: Fliege schnellstmöglich von ${contract.departure_airport} nach ${contract.arrival_airport}! Die Strecke beträgt ${contract.distance_nm?.toLocaleString() || 0} NM. Zeit ist der absolut kritische Faktor.`}
                    </>
                  ) : (
                    <>
                      {contract.type === 'passenger' && `You are tasked with safely transporting ${contract.passenger_count || 0} passengers from ${contract.departure_airport} ${contract.departure_city ? `(${contract.departure_city})` : ''} to ${contract.arrival_airport} ${contract.arrival_city ? `(${contract.arrival_city})` : ''}. The route covers ${contract.distance_nm?.toLocaleString() || 0} NM. Passengers expect a comfortable, professional flight. The better your flight score, the higher the bonus.`}
                      {contract.type === 'cargo' && `You have been assigned to transport ${contract.cargo_weight_kg?.toLocaleString() || 0} kg of cargo from ${contract.departure_airport} to ${contract.arrival_airport}. Distance: ${contract.distance_nm?.toLocaleString() || 0} NM. Deliver on time to secure bonus payments.`}
                      {contract.type === 'charter' && `Exclusive charter flight: Fly ${contract.passenger_count ? `${contract.passenger_count} VIP passengers` : 'a group'} from ${contract.departure_airport} to ${contract.arrival_airport} over ${contract.distance_nm?.toLocaleString() || 0} NM. Charter flights have particularly high standards for comfort and punctuality.`}
                      {contract.type === 'emergency' && `URGENT EMERGENCY MISSION: Fly as quickly as possible from ${contract.departure_airport} to ${contract.arrival_airport}! Distance: ${contract.distance_nm?.toLocaleString() || 0} NM. Time is the critical factor.`}
                    </>
                  )}
                </p>
              </div>
            </Card>

            {/* Flight Details */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plane className="w-5 h-5 text-blue-400" />
                {t('flight_details', lang)}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-xs sm:text-sm mb-1">{t('distance', lang)}</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-400">
                    {contract.distance_nm?.toLocaleString()} NM
                  </p>
                </div>
                {contract.passenger_count > 0 && (
                  <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-xs sm:text-sm mb-1">{t('passengers', lang)}</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                      {contract.passenger_count}
                    </p>
                  </div>
                )}
                {contract.cargo_weight_kg > 0 && (
                  <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-xs sm:text-sm mb-1">{t('cargo', lang)}</p>
                    <p className="text-xl sm:text-2xl font-bold text-orange-400">
                      {contract.cargo_weight_kg?.toLocaleString()} kg
                    </p>
                  </div>
                )}
                <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-xs sm:text-sm mb-1">{t('deadline', lang)}</p>
                  <p className="text-lg sm:text-xl font-bold text-amber-400">
                  {contract.deadline_minutes ? `${contract.deadline_minutes} min` : contract.deadline ? new Date(contract.deadline).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US') : t('none', lang)}
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                  <p className="text-slate-400 text-xs sm:text-sm mb-1">{t('contract_type', lang)}</p>
                  <p className="text-lg sm:text-xl font-bold text-purple-400">
                    {config.label}
                  </p>
                </div>
                {contract.level_requirement > 1 && (
                  <div className="p-3 sm:p-4 bg-slate-900 rounded-lg">
                    <p className="text-slate-400 text-xs sm:text-sm mb-1">{t('min_level', lang)}</p>
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
                {t('payout', lang)}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                  <span className="text-slate-400">{t('base_payout', lang)}</span>
                  <span className="text-emerald-400 font-bold text-lg">${Math.round(contract.payout || 0).toLocaleString()}</span>
                </div>
                {contract.bonus_potential > 0 && (
                  <div className="flex justify-between items-center p-3 bg-slate-900 rounded-lg">
                    <span className="text-slate-400">{t('max_bonus', lang)}</span>
                    <span className="text-amber-400 font-bold">+${Math.round(contract.bonus_potential).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                  <span className="text-emerald-300 font-medium">{t('max_total_revenue', lang)}</span>
                  <span className="text-emerald-400 font-bold text-xl">${Math.round((contract.payout || 0) + (contract.bonus_potential || 0)).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {t('costs_disclaimer', lang)}
                </p>
              </div>
            </Card>

            {/* Required Aircraft */}
            {contract.required_aircraft_type && contract.required_aircraft_type.length > 0 && (
              <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4">{t('required_aircraft', lang)}</h3>
                <div className="flex flex-wrap gap-2">
                  {contract.required_aircraft_type.map((type) => (
                    <Badge key={type} className="bg-blue-500/20 text-blue-400 border-blue-400/50 px-3 sm:px-4 py-2">
                      <Plane className="w-4 h-4 mr-2" />
                      {type === 'small_prop' ? t('small_prop_label', lang) :
                      type === 'turboprop' ? t('turboprop_label', lang) :
                      type === 'regional_jet' ? t('regional_jet_label', lang) :
                      type === 'narrow_body' ? t('narrow_body_label', lang) :
                      type === 'wide_body' ? t('wide_body_label', lang) :
                      type === 'cargo' ? t('cargo_label', lang) : type}
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
                  {t('required_crew', lang)}
                </h3>
                <div className="space-y-3">
                  {Object.entries(contract.required_crew).map(([role, count]) => {
                    if (count === 0) return null;
                    const roleLabels = {
                     captain: t('captain', lang),
                     first_officer: t('first_officer', lang),
                     flight_attendant: t('flight_attendant', lang),
                     loadmaster: t('loadmaster', lang)
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
              <h3 className="text-lg font-semibold mb-4">{t('status_label', lang)}</h3>
              <Badge className={`${
                contract.status === 'available' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                contract.status === 'accepted' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                contract.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                contract.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                contract.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                'bg-slate-500/20 text-slate-400'
              } px-4 py-2`}>
                {contract.status === 'available' ? t('available', lang) :
                 contract.status === 'accepted' ? t('accepted', lang) :
                 contract.status === 'in_progress' ? t('in_flight', lang) :
                 contract.status === 'completed' ? t('completed', lang) :
                 contract.status === 'failed' ? t('failed_status', lang) :
                 contract.status}
              </Badge>
            </Card>

            {/* Full Scoring & Events Overview */}
            <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                {t('score_and_effects', lang)}
              </h3>
              
              {/* Landing Quality - G-force based */}
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-2">{lang === 'de' ? 'Landequalität (nach G-Kraft)' : 'Landing Quality (by G-force)'}</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between items-center p-2 bg-emerald-900/20 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Butterweich' : 'Butter'} (&lt;0.5 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400 font-medium">+40 Score</span>
                    <span className="text-emerald-400">+4× Payout</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-emerald-900/20 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Weich' : 'Soft'} (&lt;1.0 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-400 font-medium">+20 Score</span>
                    <span className="text-emerald-400">+2× Payout</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-900/20 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Akzeptabel' : 'Acceptable'} (&lt;1.6 G)</span>
                  <div className="flex gap-3 text-xs">
                   <span className="text-blue-400 font-medium">+5 Score</span>
                   <span className="text-slate-500">{lang === 'de' ? 'kein Bonus' : 'no bonus'}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Hart' : 'Hard'} (&lt;2.0 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-30 Score</span>
                    <span className="text-amber-400">-25% Payout</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Sehr Hart' : 'Very Hard'} (≥2.0 G)</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-50 Score</span>
                    <span className="text-amber-400">-50% Payout</span>
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-2">{t('deadline', lang)}</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between items-center p-2 bg-blue-900/10 rounded">
                   <span className="text-slate-300">{lang === 'de' ? 'Deadline eingehalten' : 'Deadline met'}</span>
                  <span className="text-emerald-400 font-medium text-xs">+20 Score</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Deadline überschritten' : 'Deadline exceeded'}</span>
                  <span className="text-red-400 font-medium text-xs">-20 Score</span>
                </div>
              </div>

              {/* Penalties */}
              <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">{lang === 'de' ? 'Straf-Events' : 'Penalty Events'}</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Heckaufsetzer (Tailstrike)' : 'Tailstrike'}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-20 Score</span>
                    <span className="text-amber-400">2% {t('maintenance', lang)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">Overspeed</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-15 Score</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Klappen-Overspeed' : 'Flaps Overspeed'}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-15 Score</span>
                    <span className="text-amber-400">2.5% {t('maintenance', lang)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'G-Kraft ≥1.5 G (erste)' : 'G-force ≥1.5 G (first)'}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-10 Score</span>
                    <span className="text-amber-400">1% {t('maintenance', lang)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Jede weitere G-Stufe (2G, 3G…)' : 'Each additional G-step (2G, 3G…)'}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-10 Score/G</span>
                    <span className="text-amber-400">G×1% {t('maintenance', lang)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Strukturschaden (Overstress)' : 'Structural damage (Overstress)'}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-30 Score</span>
                    <span className="text-amber-400">4% {t('maintenance', lang)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/10 rounded">
                  <span className="text-slate-300">{lang === 'de' ? 'Strömungsabriss (Stall)' : 'Stall'}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-medium">-50 Score</span>
                  </div>
                </div>
              </div>

              {/* Catastrophic */}
              <p className="text-xs text-red-500 font-semibold uppercase tracking-wider mb-2">{lang === 'de' ? 'Katastrophal' : 'Catastrophic'}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center p-2 bg-red-900/20 border border-red-800/30 rounded">
                  <span className="text-red-300 font-medium">{lang === 'de' ? 'Landung ohne Fahrwerk' : 'Gear-up landing'}</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-bold">-35 Score</span>
                    <span className="text-red-400 font-bold">15% {t('maintenance', lang)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-900/20 border border-red-800/30 rounded">
                  <span className="text-red-300 font-medium">Crash</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-400 font-bold">-100 Score</span>
                    <span className="text-red-400 font-bold">70% {t('maintenance', lang)}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">{lang === 'de' ? 'Wartungskosten = % des Flugzeug-Neuwerts. Landebonus/-abzug basiert auf dem Auftrags-Payout. Score startet bei 100.' : 'Maintenance cost = % of aircraft purchase price. Landing bonus/penalty based on contract payout. Score starts at 100.'}</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}