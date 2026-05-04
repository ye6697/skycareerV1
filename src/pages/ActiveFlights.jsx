import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import { getInsurancePlanConfig, INSURANCE_PACKAGES } from "@/lib/insurance";

import {
  Plane,
  MapPin,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Play,
  GraduationCap,
  Users,
  Package,
  Gauge,
  Activity,
  CheckCircle2,
  XCircle,
  Radio,
  Info,
  TrendingUp } from
"lucide-react";

import ActiveFlightCard from "@/components/flights/ActiveFlightCard";

const DIFFICULTY_OPTIONS = [
  {
    value: 'easy',
    color: 'text-emerald-300',
    label: { de: 'Freier Modus', en: 'Free mode' },
    summary: {
      de: 'Kein SkyCareer-Wetterpreset.',
      en: 'No SkyCareer weather preset.'
    },
    detail: {
      de: 'SkyCareer laesst dein aktuelles Simulator-Wetter unveraendert. Nutze das fuer Live Weather, eigene Presets oder komplett freie Fluege.',
      en: 'SkyCareer leaves your current simulator weather unchanged. Use this for live weather, custom presets, or fully free flights.'
    }
  },
  {
    value: 'medium',
    color: 'text-cyan-300',
    label: { de: 'Mittel', en: 'Medium' },
    summary: {
      de: 'Normaler Auftrag mit ausgewogenem Anspruch.',
      en: 'Normal contract with a balanced challenge.'
    },
    detail: {
      de: 'Der Standard fuer die meisten Fluege: realistisch, aber nicht hart bestrafend.',
      en: 'The default for most flights: realistic without being too punishing.'
    }
  },
  {
    value: 'hard',
    color: 'text-amber-300',
    label: { de: 'Schwer', en: 'Hard' },
    summary: {
      de: 'Anspruchsvoller Flug fuer sauberes Arbeiten.',
      en: 'Demanding flight for precise operation.'
    },
    detail: {
      de: 'Passend fuer laengere Strecken, groessere Flugzeuge oder wenn du bewusst mehr Risiko willst.',
      en: 'Fits longer routes, larger aircraft, or when you want more intentional risk.'
    }
  },
  {
    value: 'extreme',
    color: 'text-red-300',
    label: { de: 'Extrem', en: 'Extreme' },
    summary: {
      de: 'Maximale Herausforderung fuer erfahrene Piloten.',
      en: 'Maximum challenge for experienced pilots.'
    },
    detail: {
      de: 'Waehle das nur, wenn du den Auftrag wirklich als harte Challenge fliegen moechtest.',
      en: 'Choose this only when you want the contract to be a real challenge.'
    }
  }
];

const normalizeDifficulty = (value) =>
  DIFFICULTY_OPTIONS.some((option) => option.value === value) ? value : 'medium';

const DIFFICULTY_PAYOUT_BONUS = {
  easy: 0,
  medium: 10,
  hard: 25,
  extreme: 50,
};

const DIFFICULTY_EFFECTS = {
  easy: {
    de: 'Kein Wetterwechsel, kein Bonus. Du fliegst mit deinem eigenen Wetter oder Live Weather.',
    en: 'No weather change, no bonus. You fly with your own weather or live weather.',
  },
  medium: {
    de: 'Moderater Wind, Regen und Wolken. +10% auf das Auftrags-Payout.',
    en: 'Moderate wind, rain, and cloud cover. +10% contract payout.',
  },
  hard: {
    de: 'Tiefe Wolken, starke Boeen und deutlich schlechtere Sicht. +25% auf das Auftrags-Payout.',
    en: 'Low clouds, strong gusts, and notably worse visibility. +25% contract payout.',
  },
  extreme: {
    de: 'Sehr tiefe Wolken, Sturm, Gewitter, harter Wind und minimale Sicht. +50% auf das Auftrags-Payout.',
    en: 'Very low clouds, storm, thunderstorm, harsh wind, and minimal visibility. +50% contract payout.',
  },
};

const WEATHER_PRESETS_BY_DIFFICULTY = {
  medium: {
    label: 'Medium',
    preset_name: 'SkyCareer Medium Challenge',
    theme_path: 'WeatherPresets\\SkyCareer Medium Challenge.WPR',
    wind_speed_kts: 14,
    wind_gust_kts: 22,
    wind_direction: 260,
    visibility_sm: 7,
    cloud_base_ft: 3000,
    cloud_coverage: 'BKN',
    rain_intensity: 0.15,
    precip_rate: 0.4,
    turbulence: 0.22,
    temperature_c: 14,
    qnh_hpa: 1012,
  },
  hard: {
    label: 'Hard',
    preset_name: 'SkyCareer Hard Challenge',
    theme_path: 'WeatherPresets\\SkyCareer Hard Challenge.WPR',
    wind_speed_kts: 28,
    wind_gust_kts: 42,
    wind_direction: 290,
    visibility_sm: 4,
    cloud_base_ft: 1500,
    cloud_coverage: 'BKN',
    rain_intensity: 0.55,
    precip_rate: 2.4,
    turbulence: 0.58,
    temperature_c: 9,
    qnh_hpa: 1006,
  },
  extreme: {
    label: 'Extreme',
    preset_name: 'SkyCareer Extreme Challenge',
    theme_path: 'WeatherPresets\\SkyCareer Extreme Challenge.WPR',
    wind_speed_kts: 65,
    wind_gust_kts: 92,
    wind_direction: 315,
    visibility_sm: 0.5,
    cloud_base_ft: 350,
    cloud_coverage: 'OVC',
    rain_intensity: 1,
    precip_rate: 22,
    turbulence: 1,
    thunderstorm: true,
    temperature_c: 5,
    qnh_hpa: 982,
  },
};

const buildWeatherCommand = (difficulty, createdAtIso) => {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const preset = WEATHER_PRESETS_BY_DIFFICULTY[normalizedDifficulty];
  if (!preset) return null;
  return {
    id: `cmd-set-weather-${normalizedDifficulty}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'set_weather',
    simulator: 'msfs',
    created_at: createdAtIso,
    source: 'active_flight_start',
    persist_until_landed: false,
    payload: {
      difficulty: normalizedDifficulty,
      ...preset,
    },
  };
};

export default function ActiveFlights() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedContract, setSelectedContract] = useState(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState('');
  const [isWeatherInfoOpen, setIsWeatherInfoOpen] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      if (cid) {
        const cos = await base44.entities.Company.filter({ id: cid });
        if (cos[0]) return cos[0];
      }
      const cos = await base44.entities.Company.filter({ created_by: user.email });
      return cos[0] || null;
    }
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'accepted', company?.id],
    queryFn: () => base44.entities.Contract.filter({ company_id: company.id, status: 'accepted' }),
    enabled: !!company?.id
  });

  const { data: inProgressContracts = [] } = useQuery({
    queryKey: ['contracts', 'in_progress', company?.id],
    queryFn: () => base44.entities.Contract.filter({ company_id: company.id, status: 'in_progress' }),
    enabled: !!company?.id
  });

  const { data: completedContracts = [] } = useQuery({
    queryKey: ['contracts', 'completed', company?.id],
    queryFn: () => base44.entities.Contract.filter({ company_id: company.id, status: 'completed' }),
    enabled: !!company?.id
  });

  const { data: failedContracts = [] } = useQuery({
    queryKey: ['contracts', 'failed', company?.id],
    queryFn: () => base44.entities.Contract.filter({ company_id: company.id, status: 'failed' }),
    enabled: !!company?.id
  });

  const { data: inFlightRecords = [] } = useQuery({
    queryKey: ['flights', 'in_flight', company?.id],
    queryFn: () => base44.entities.Flight.filter({ company_id: company.id, status: 'in_flight' }),
    enabled: !!company?.id
  });

  const { data: aircraft = [] } = useQuery({
    queryKey: ['aircraft', 'available', company?.id],
    queryFn: () => base44.entities.Aircraft.filter({ company_id: company.id, status: 'available' }),
    enabled: !!company?.id
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60000,
  });

  const { data: aircraftTemplates = [] } = useQuery({
    queryKey: ['aircraftTemplates'],
    queryFn: () => base44.entities.AircraftTemplate.list(),
    staleTime: 5 * 60 * 1000,
  });

  const userTypeRatings = React.useMemo(() => {
    const list = currentUser?.type_ratings || currentUser?.data?.type_ratings || [];
    return Array.isArray(list) ? list : [];
  }, [currentUser]);

  const isTrContract = (c) => /__TR__:/.test(String(c?.briefing || ''));

  const startFlightMutation = useMutation({
    mutationFn: async () => {
      // For type-rating training contracts, the user flies a model they may
      // not own. We therefore allow starting without an owned aircraft.
      const isTr = isTrContract(selectedContract);
      const aircraftIdToUse = isTr
        ? null
        : selectedAircraft;
      const ac = isTr
        ? null
        : aircraft.find((a) => a.id === aircraftIdToUse);
      if (!isTr && !ac) {
        throw new Error(lang === 'de'
          ? 'Du brauchst mindestens ein Flugzeug in deiner Flotte (egal welcher Typ).'
          : 'You need at least one aircraft in your fleet (any type).');
      }
      if (!isTr) {
        // Validate aircraft is suitable for contract
        if (ac.passenger_capacity < (selectedContract?.passenger_count || 0)) {
          throw new Error(lang === 'de' ? 'Flugzeug hat nicht genug Sitze' : 'Aircraft does not have enough seats');
        }
        if (ac.cargo_capacity_kg < (selectedContract?.cargo_weight_kg || 0)) {
          throw new Error(lang === 'de' ? 'Flugzeug hat nicht genug Frachtraum' : 'Aircraft does not have enough cargo capacity');
        }
        if (ac.range_nm < (selectedContract?.distance_nm || 0)) {
          throw new Error(lang === 'de' ? 'Flugzeug hat nicht genug Reichweite' : 'Aircraft does not have enough range');
        }
      }

      const nowIso = new Date().toISOString();
      const normalizePctLike = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return n > 1 && n <= 100 ? (n / 100) : n;
      };
      const localStoredPlan = (() => {
        try {
          const raw = String(window.localStorage.getItem(`insurance_plan_${ac?.id || 'unknown'}`) || '').trim().toLowerCase();
          return INSURANCE_PACKAGES[raw] ? raw : null;
        } catch (_) {
          return null;
        }
      })();
      const aircraftPlan = String(ac?.insurance_plan || '').trim().toLowerCase();
      const insurancePlan = (INSURANCE_PACKAGES[localStoredPlan] ? localStoredPlan : null)
        || (INSURANCE_PACKAGES[aircraftPlan] ? aircraftPlan : null)
        || 'basic';
      const insuranceCfg = getInsurancePlanConfig(insurancePlan);
      const insuranceHourlyRatePct = normalizePctLike(ac?.insurance_hourly_rate_pct) ?? insuranceCfg.hourlyRatePctOfNewValue;
      const insuranceCoveragePct = normalizePctLike(ac?.insurance_maintenance_coverage_pct) ?? insuranceCfg.maintenanceCoveragePct;
      const insuranceScoreBonusPct = normalizePctLike(ac?.insurance_score_bonus_pct) ?? insuranceCfg.scoreBonusPct;
      const normalizedDifficulty = normalizeDifficulty(selectedDifficulty || selectedContract?.difficulty);
      const restartCommand = {
        id: `cmd-worker-restart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'worker_restart',
        simulator: 'msfs',
        created_at: nowIso,
        source: 'active_flight_start',
        persist_until_landed: false
      };
      const weatherCommand = buildWeatherCommand(normalizedDifficulty, nowIso);
      const startBridgeCommands = [restartCommand, weatherCommand].filter(Boolean);
      const currentUser = await base44.auth.me();
      const userFailurePref = (
        typeof currentUser?.failure_triggers_enabled_user === 'boolean'
          ? currentUser.failure_triggers_enabled_user
          : (typeof currentUser?.data?.failure_triggers_enabled_user === 'boolean'
              ? currentUser.data.failure_triggers_enabled_user
              : (typeof currentUser?.failure_triggers_enabled === 'boolean'
                  ? currentUser.failure_triggers_enabled
                  : (typeof currentUser?.data?.failure_triggers_enabled === 'boolean'
                      ? currentUser.data.failure_triggers_enabled
                      : null)))
      );
      const sessionFailureTriggersEnabled = userFailurePref !== false;

      // Create flight record with 'in_flight' status
      const flight = await base44.entities.Flight.create({
        company_id: company.id,
        contract_id: selectedContract.id,
        aircraft_id: aircraftIdToUse,
        crew: [],
        departure_time: new Date().toISOString(),
        status: 'in_flight',
        active_failures: [],
        bridge_command_queue: startBridgeCommands,
        xplane_data: {
          contract_id: selectedContract.id,
          selected_difficulty: normalizedDifficulty,
          forced_weather: weatherCommand?.payload || null,
          was_airborne: false,
          airborne_started_at: null,
          completion_armed: false,
          completion_armed_at: null,
          touchdown_detected: false,
          touchdown_vspeed: 0,
          landing_g_force: 0,
          landing_data_locked: false,
          bridge_local_landing_locked: false,
          maintenance_failure_category: null,
          maintenance_failure_severity: null,
          maintenance_failure_timestamp: null,
          flight_path: [],
          flight_events_log: [],
          bridge_event_log: [],
          telemetry_history: [],
          failure_triggers_enabled: sessionFailureTriggersEnabled,
          insurance_plan: insurancePlan,
          insurance_hourly_rate_pct: insuranceHourlyRatePct,
          insurance_coverage_pct: insuranceCoveragePct !== null ? Math.round(insuranceCoveragePct * 100) : null,
          insurance_score_bonus_pct: insuranceScoreBonusPct !== null ? Math.round(insuranceScoreBonusPct * 100) : null,
          bridge_reset_requested_at: nowIso,
          bridge_reset_reason: 'new_contract_flight_start',
          bridge_command_queue: startBridgeCommands
        }
      });

      // Update contract status and persist the user-selected challenge level.
      await base44.entities.Contract.update(selectedContract.id, {
        status: 'in_progress',
        difficulty: normalizedDifficulty
      });

      // Update aircraft status — but only if it isn't already in flight
      // (TR missions may reuse an aircraft that's busy in another sim session).
      if (!isTr || String(ac?.status || '').toLowerCase() === 'available') {
        await base44.entities.Aircraft.update(aircraftIdToUse, { status: 'in_flight' });
      }

      return flight;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      setIsAssignDialogOpen(false);
      setSelectedContract(null);
      setSelectedAircraft('');
      setSelectedDifficulty('medium');
    }
  });

  const cancelFlightMutation = useMutation({
    mutationFn: async ({ contract, flight }) => {
      const penalty = contract?.payout ? contract.payout * 0.3 : 5000;

      let activeFlight = flight || null;
      if (!activeFlight?.id && contract?.id) {
        const byContract = await base44.entities.Flight.filter({ contract_id: contract.id });
        activeFlight = byContract.find((f) => f.status === 'in_flight') || byContract[0] || null;
      }

      if (activeFlight?.id) {
        await base44.entities.Flight.update(activeFlight.id, {
          status: 'cancelled'
        });
      }

      await base44.entities.Contract.update(contract.id, {
        status: 'failed'
      });

      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - penalty,
          reputation: Math.max(0, (company.reputation || 50) - 5)
        });
      }

      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'other',
        amount: penalty,
        description: `Stornierungsgebuehr: ${contract?.title}`,
        reference_id: contract.id,
        date: new Date().toISOString()
      });

      if (activeFlight?.aircraft_id) {
        await base44.entities.Aircraft.update(activeFlight.aircraft_id, {
          status: 'available'
        });
      }

      return { penalty };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  // Selected aircraft model rating check (only relevant for non-TR contracts)
  const selectedAircraftObj = React.useMemo(
    () => aircraft.find((a) => a.id === selectedAircraft) || null,
    [aircraft, selectedAircraft]
  );
  const selectedAircraftMissingRating = React.useMemo(() => {
    if (!selectedAircraftObj) return false;
    if (isTrContract(selectedContract)) return false;
    const modelName = String(selectedAircraftObj?.name || '').trim();
    if (!modelName) return false;
    return !userTypeRatings.includes(modelName);
  }, [selectedAircraftObj, selectedContract, userTypeRatings]);

  const canStartFlight = () => {
    if (!selectedDifficulty) return false;
    if (isTrContract(selectedContract)) return true;
    if (!selectedAircraft) return false;
    if (selectedAircraftMissingRating) return false;
    return true;
  };

  const allContracts = [...contracts, ...inProgressContracts];
  const [activeTab, setActiveTab] = useState('active');

  const isXplaneConnected = company?.xplane_connection_status === 'connected';
  const trainingCount = allContracts.filter((c) => /__TR__:/.test(String(c?.briefing || ''))).length;
  const selectedDifficultyOption = DIFFICULTY_OPTIONS.find((option) => option.value === selectedDifficulty) || DIFFICULTY_OPTIONS[1];
  const openPrepareDialog = (contract) => {
    setSelectedContract(contract);
    setSelectedDifficulty(normalizeDifficulty(contract?.difficulty));
    setIsAssignDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        {/* Modern Header with HUD-style stats */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1 h-6 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {t('active_flights', lang)}
                </h1>
              </div>
              <p className="text-slate-400 text-sm pl-3">
                {lang === 'de'
                  ? 'Bereite Fluege vor und starte sie mit FlightSim'
                  : 'Prepare flights and start them with FlightSim'}
              </p>
            </div>

            {/* HUD-style sim connection chip */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-md ${
              isXplaneConnected
                ? 'bg-emerald-950/40 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : 'bg-slate-900/60 border-slate-700'
            }`}>
              <div className="relative">
                <div className={`w-2 h-2 rounded-full ${
                  isXplaneConnected ? 'bg-emerald-400' : 'bg-slate-600'
                }`} />
                {isXplaneConnected && (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <Radio className={`w-3.5 h-3.5 ${isXplaneConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div className="flex flex-col">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 leading-none">
                  FlightSim
                </span>
                <span className={`text-[11px] font-mono font-bold uppercase leading-tight ${
                  isXplaneConnected ? 'text-emerald-300' : 'text-slate-400'
                }`}>
                  {isXplaneConnected
                    ? (lang === 'de' ? 'Verbunden' : 'Connected')
                    : (lang === 'de' ? 'Getrennt' : 'Offline')}
                </span>
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-900 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Activity className="w-3 h-3 text-cyan-400" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-400">
                  {lang === 'de' ? 'Aktiv' : 'Active'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-cyan-200">{allContracts.length}</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-slate-900 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <GraduationCap className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400">
                  {lang === 'de' ? 'Training' : 'Training'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-amber-200">{trainingCount}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-slate-900 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400">
                  {lang === 'de' ? 'Fertig' : 'Done'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-emerald-200">{completedContracts.length}</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-gradient-to-br from-red-950/40 to-slate-900 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-red-400">
                  {lang === 'de' ? 'Fehler' : 'Failed'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-red-200">{failedContracts.length}</p>
            </div>
          </div>
        </motion.div>

        {/* Modernized segmented tabs */}
        <div className="flex gap-1.5 mb-5 p-1 rounded-lg bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          {[
            { key: 'active', label: t('active_flights_tab', lang), count: allContracts.length, icon: Activity, color: 'cyan' },
            { key: 'completed', label: t('completed_flights', lang), count: completedContracts.length, icon: CheckCircle2, color: 'emerald' },
            { key: 'failed', label: t('failed_flights', lang), count: failedContracts.length, icon: XCircle, color: 'red' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const colors = {
              cyan: isActive ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.25)]' : 'text-slate-400 hover:text-cyan-300',
              emerald: isActive ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]' : 'text-slate-400 hover:text-emerald-300',
              red: isActive ? 'bg-red-500/20 text-red-200 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]' : 'text-slate-400 hover:text-red-300',
            };
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] sm:text-xs font-mono uppercase tracking-wider font-bold transition-all border ${
                  isActive ? colors[tab.color] : `border-transparent ${colors[tab.color]}`
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-slate-950/60' : 'bg-slate-800/60'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Contracts */}
        {activeTab === 'active' && allContracts.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {allContracts.map((contract) => {
                const linkedFlight = contract.status === 'in_progress'
                  ? (inFlightRecords.find((f) => f.contract_id === contract.id) || null)
                  : null;
                return (
                  <ActiveFlightCard
                    key={contract.id}
                    contract={contract}
                    flight={linkedFlight}
                    lang={lang}
                    isCancelling={cancelFlightMutation.isPending}
                    onPrepare={() => {
                      openPrepareDialog(contract);
                    }}
                    onCancel={() => {
                      const penalty = contract?.payout * 0.3 || 5000;
                      if (confirm(`${t('cancel_confirm', lang)} $${penalty.toLocaleString()}`)) {
                        cancelFlightMutation.mutate({ contract, flight: linkedFlight });
                      }
                    }}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        ) : activeTab === 'active' ? (
          <Card className="p-10 text-center bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 mx-auto mb-4 flex items-center justify-center">
              <Plane className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{t('no_active_contracts', lang)}</h3>
            <p className="text-slate-400 mb-5 text-sm">
              {t('accept_contract_to_start', lang)}
            </p>
            <Link to={createPageUrl("Contracts")}>
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold">
                <TrendingUp className="w-4 h-4 mr-2" />
                {t('browse_contracts_label', lang)}
              </Button>
            </Link>
          </Card>
        ) : null}

        {/* Completed Contracts */}
        {activeTab === 'completed' && completedContracts.length > 0 ?
        <div className="space-y-4">
            <AnimatePresence>
              {completedContracts.map((contract) =>
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}>

                  <Link to={createPageUrl(`CompletedFlightDetails?contractId=${contract.id}`)}>
                    <Card className="overflow-hidden bg-slate-800 border border-slate-700 hover:border-emerald-500 transition-colors cursor-pointer">
                      <div className="h-1 bg-emerald-500" />
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-xl font-semibold text-white">
                                {contract.title}
                              </h3>
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                {t('completed', lang)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {contract.departure_airport}
                              </span>
                              <ArrowRight className="w-4 h-4" />
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {contract.arrival_airport}
                              </span>
                              <span className="text-slate-600">|</span>
                              <span>{contract.distance_nm} NM</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">
                              ${contract.payout?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
            )}
            </AnimatePresence>
          </div> :
        activeTab === 'completed' ?
        <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <CheckCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('no_completed_flights', lang)}</h3>
            <p className="text-slate-400">
              {t('all_completed_shown_here', lang)}
            </p>
          </Card> :
        null}

        {/* Failed Contracts */}
        {activeTab === 'failed' && failedContracts.length > 0 ?
        <div className="space-y-4">
            <AnimatePresence>
              {failedContracts.map((contract) =>
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}>

                  <Link to={createPageUrl(`CompletedFlightDetails?contractId=${contract.id}`)}>
                    <Card className="overflow-hidden bg-slate-800 border border-slate-700 hover:border-red-500 transition-colors cursor-pointer">
                      <div className="h-1 bg-red-500" />
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-xl font-semibold text-white">
                                {contract.title}
                              </h3>
                              <Badge className="bg-red-100 text-red-700 border-red-200">
                                {t('failed', lang)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {contract.departure_airport}
                              </span>
                              <ArrowRight className="w-4 h-4" />
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {contract.arrival_airport}
                              </span>
                              <span className="text-slate-600">|</span>
                              <span>{contract.distance_nm} NM</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-red-500">
                              ${contract.payout?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
            )}
            </AnimatePresence>
          </div> :
        activeTab === 'failed' ?
        <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('no_failed_flights', lang)}</h3>
            <p className="text-slate-400">
              {t('all_failed_shown_here', lang)}
            </p>
          </Card> :
        null}

        {/* Assignment Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="max-w-3xl bg-slate-900 border border-slate-700/60 text-slate-100 shadow-2xl shadow-black/50 p-0 overflow-hidden">
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-900 border-b border-cyan-900/40 px-6 py-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(14,165,233,0.18),transparent_55%)]" />
              <DialogHeader className="relative">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                    <Plane className="w-5 h-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-300/80">
                      {t('prepare_flight_title', lang)}
                    </p>
                    <DialogTitle className="text-lg font-bold text-white">{selectedContract?.title}</DialogTitle>
                  </div>
                </div>
                {selectedContract && (
                  <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="flex items-center gap-1 font-mono"><MapPin className="w-3 h-3" />{selectedContract.departure_airport}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="flex items-center gap-1 font-mono"><MapPin className="w-3 h-3" />{selectedContract.arrival_airport}</span>
                    <span className="text-slate-600">|</span>
                    <span className="font-mono">{selectedContract.distance_nm} NM</span>
                    {selectedContract.passenger_count > 0 && (<><span className="text-slate-600">|</span><span className="flex items-center gap-1 font-mono"><Users className="w-3 h-3" />{selectedContract.passenger_count}</span></>)}
                    {selectedContract.cargo_weight_kg > 0 && (<><span className="text-slate-600">|</span><span className="flex items-center gap-1 font-mono"><Package className="w-3 h-3" />{selectedContract.cargo_weight_kg} kg</span></>)}
                  </div>
                )}
              </DialogHeader>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-cyan-300">
                  <Gauge className="w-4 h-4" />
                  {lang === 'de' ? 'Schwierigkeitsgrad' : 'Difficulty'}
                </Label>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder={lang === 'de' ? 'Schwierigkeitsgrad waehlen...' : 'Choose difficulty...'} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-white">
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="focus:bg-slate-800">
                        {option.label[lang === 'de' ? 'de' : 'en']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-cyan-300 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-mono uppercase tracking-wider text-cyan-300">
                          {lang === 'de' ? 'Info zum Schwierigkeitsgrad' : 'Difficulty info'}
                        </p>
                        <p className={`text-sm font-bold ${selectedDifficultyOption.color}`}>
                          {selectedDifficultyOption.label[lang === 'de' ? 'de' : 'en']}: {selectedDifficultyOption.summary[lang === 'de' ? 'de' : 'en']}
                        </p>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">
                        {selectedDifficultyOption.detail[lang === 'de' ? 'de' : 'en']}
                      </p>
                      <p className="text-xs leading-relaxed text-slate-400">
                        {lang === 'de'
                          ? selectedDifficulty === 'easy'
                            ? 'Freier Modus speichert nur den Auftrag und veraendert dein Wetter nicht.'
                            : 'Diese Auswahl wird beim Starten gespeichert und als Wetter-Preset an die Bridge gesendet. Mittel, Schwer und Extrem setzen jeweils ein eigenes MSFS-Wetterpreset.'
                          : selectedDifficulty === 'easy'
                            ? 'Free mode only saves the contract and does not change your weather.'
                            : 'This selection is saved when the flight starts and sent to the bridge as a weather preset. Medium, Hard, and Extreme each apply a dedicated MSFS weather preset.'}
                      </p>
                      <div className="rounded border border-slate-700 bg-slate-950/60 overflow-hidden">
                        {DIFFICULTY_OPTIONS.map((option) => {
                          const payoutPct = DIFFICULTY_PAYOUT_BONUS[option.value] || 0;
                          const isActive = option.value === selectedDifficulty;
                          return (
                            <div
                              key={option.value}
                              className={`grid grid-cols-[84px_54px_1fr] gap-2 px-3 py-2 text-[11px] border-b border-slate-800 last:border-b-0 ${isActive ? 'bg-cyan-500/10' : ''}`}
                            >
                              <span className={`font-bold ${option.color}`}>
                                {option.label[lang === 'de' ? 'de' : 'en']}
                              </span>
                              <span className={payoutPct > 0 ? 'text-emerald-300 font-mono' : 'text-slate-500 font-mono'}>
                                {payoutPct > 0 ? `+${payoutPct}%` : '+0%'}
                              </span>
                              <span className="text-slate-300 leading-snug">
                                {DIFFICULTY_EFFECTS[option.value][lang === 'de' ? 'de' : 'en']}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                // Detect type-rating training contract via briefing tag __TR__:ModelName
                const trMatch = String(selectedContract?.briefing || '').match(/__TR__:(.+)/);
                const trModelName = trMatch ? trMatch[1].trim() : null;

                if (trModelName) {
                  const trTemplate = aircraftTemplates.find((t) => t.name === trModelName);
                  return (
                    <>
                      <Label className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-cyan-300">
                        <GraduationCap className="w-4 h-4" />
                        {lang === 'de' ? 'Type-Rating Training' : 'Type-Rating Training'}
                      </Label>

                      <div className="rounded-lg border border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 to-slate-900/60 p-4">
                        <div className="flex items-center gap-3">
                          {trTemplate?.image_url ? (
                            <img src={trTemplate.image_url} alt={trModelName} className="w-24 h-16 object-cover rounded border border-cyan-500/30" />
                          ) : (
                            <div className="w-24 h-16 rounded border border-cyan-500/30 bg-slate-900 flex items-center justify-center">
                              <Plane className="w-6 h-6 text-cyan-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                              {lang === 'de' ? 'Trainings-Flugzeug' : 'Training aircraft'}
                            </p>
                            <p className="text-lg font-bold text-white truncate">{trModelName}</p>
                            {trTemplate && (
                              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1">
                                {trTemplate.passenger_capacity > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{trTemplate.passenger_capacity}</span>}
                                {trTemplate.range_nm > 0 && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{trTemplate.range_nm} NM</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                        {lang === 'de'
                          ? 'Lade dieses Flugzeug in deinem Simulator und starte den Trainingsflug.'
                          : 'Load this aircraft in your simulator and start the training flight.'}
                      </div>
                    </>
                  );
                }

                // Regular contract — original behavior: pick from owned available aircraft
                return (
                  <>
                    <Label className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-cyan-300">
                      <Plane className="w-4 h-4" />
                      {t('select_aircraft_label', lang)}
                    </Label>
                    <Select value={selectedAircraft} onValueChange={setSelectedAircraft}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder={t('choose_aircraft', lang)} />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-white">
                        {aircraft.filter((ac) => {
                          const passengerOk = ac.passenger_capacity >= (selectedContract?.passenger_count || 0);
                          const cargoOk = ac.cargo_capacity_kg >= (selectedContract?.cargo_weight_kg || 0);
                          const rangeOk = ac.range_nm >= (selectedContract?.distance_nm || 0);
                          return passengerOk && cargoOk && rangeOk;
                        }).map((ac) =>
                          <SelectItem key={ac.id} value={ac.id} className="focus:bg-slate-800">
                            {ac.name} ({ac.registration}) - {ac.passenger_capacity} {t('seats', lang)}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {aircraft.length === 0 &&
                      <p className="text-sm text-red-400">{t('no_available_aircraft', lang)}</p>
                    }

                    {selectedAircraftMissingRating && selectedAircraftObj && (
                      <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-amber-200">
                              {lang === 'de' ? 'Type-Rating fehlt' : 'Missing Type-Rating'}
                            </p>
                            <p className="text-xs text-amber-300/90 mt-1">
                              {lang === 'de'
                                ? `Du hast kein gültiges Type-Rating für die ${selectedAircraftObj.name}. Erwirb das Rating, um diesen Flug starten zu können.`
                                : `You don't have a valid type-rating for the ${selectedAircraftObj.name}. Earn the rating to start this flight.`}
                            </p>
                          </div>
                        </div>
                        <Link
                          to={createPageUrl(`TypeRatings?model=${encodeURIComponent(selectedAircraftObj.name || '')}`)}
                          onClick={() => setIsAssignDialogOpen(false)}
                          className="block"
                        >
                          <Button className="w-full h-10 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold">
                            <GraduationCap className="w-4 h-4 mr-2" />
                            {lang === 'de' ? 'Type-Rating erwerben' : 'Earn Type-Rating'}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <DialogFooter className="px-6 py-4 bg-slate-950/60 border-t border-slate-800">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)} className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white">
                {t('abort', lang)}
              </Button>
              <Button
                onClick={() => startFlightMutation.mutate()}
                disabled={!canStartFlight() || startFlightMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none">
                <Play className="w-4 h-4 mr-2" />
                {startFlightMutation.isPending ? t('starting', lang) : t('start_flight', lang)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
                        <button
                          type="button"
                          onClick={() => setIsWeatherInfoOpen(true)}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                          aria-label="Weather difficulty info"
                        >
                          <Info className="w-3 h-3" />
                        </button>
        <Dialog open={isWeatherInfoOpen} onOpenChange={setIsWeatherInfoOpen}>
          <DialogContent className="max-w-lg bg-slate-900 border border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle>{lang === 'de' ? 'Info: Wetter-Schwierigkeit' : 'Info: Weather difficulty'}</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-slate-300 space-y-2">
              <p>{lang === 'de' ? 'Vor dem Climb kannst du waehlen, ob SkyCareer dein MSFS-Wetter setzen soll. Freier Modus laesst dein Wetter unveraendert; Mittel, Schwer und Extrem senden ein sichtbares SkyCareer-Wetterpreset an die Bridge.' : 'Before climb, you can choose whether SkyCareer should set your MSFS weather. Free mode leaves weather unchanged; Medium, Hard, and Extreme send a visible SkyCareer weather preset to the bridge.'}</p>
              <p>{lang === 'de' ? 'Payout-Bonus: Freier Modus +0%, Mittel +10%, Schwer +25%, Extrem +50%. Der Bonus wird beim Flugabschluss wirklich auf die Auszahlung gerechnet und auf der Ergebnisseite angezeigt.' : 'Payout bonus: Free mode +0%, Medium +10%, Hard +25%, Extreme +50%. The bonus is really added when the flight is completed and shown on the results page.'}</p>
              <p className="text-amber-300">{lang === 'de' ? 'Extrem ist jetzt deutlich staerker und kann kleine Flugzeuge, Autopiloten und Anfluege schnell ueberfordern.' : 'Extreme is now much stronger and can quickly overwhelm small aircraft, autopilots, and approaches.'}</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>);

}
