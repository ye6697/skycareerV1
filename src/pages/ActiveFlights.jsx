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
import { hasTypeRating, isPilotRole, getTypeLabel } from "@/lib/typeRatings";
import {
  Plane,
  Users,
  MapPin,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Play,
  User } from
"lucide-react";

export default function ActiveFlights() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedContract, setSelectedContract] = useState(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState('');
  const [selectedCrew, setSelectedCrew] = useState({
    captain: '',
    first_officer: '',
    flight_attendant: '',
    loadmaster: ''
  });

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

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'available', company?.id],
    queryFn: () => base44.entities.Employee.filter({ company_id: company.id, status: 'available' }),
    enabled: !!company?.id
  });

  const startFlightMutation = useMutation({
    mutationFn: async () => {
      // Check if aircraft can handle contract requirements
      const ac = aircraft.find((a) => a.id === selectedAircraft);
      if (!ac) throw new Error(lang === 'de' ? 'Flugzeug nicht gefunden' : 'Aircraft not found');

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

      // Type-rating validation: every assigned pilot MUST have a license for this aircraft type.
      for (const [role, empId] of Object.entries(selectedCrew)) {
        if (!empId || !isPilotRole(role)) continue;
        const emp = employees.find((e) => e.id === empId);
        if (!emp) continue;
        if (!hasTypeRating(emp, ac.type)) {
          throw new Error(
            lang === 'de'
              ? `${emp.name} hat keine Type-Rating für ${getTypeLabel(ac.type, 'de')}. Training erforderlich!`
              : `${emp.name} has no type-rating for ${getTypeLabel(ac.type, 'en')}. Training required!`
          );
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
      const restartCommand = {
        id: `cmd-worker-restart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'worker_restart',
        simulator: 'msfs',
        created_at: nowIso,
        source: 'active_flight_start',
        persist_until_landed: false
      };
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
        aircraft_id: selectedAircraft,
        crew: Object.entries(selectedCrew).
        filter(([_, id]) => id).
        map(([role, id]) => ({ role, employee_id: id })),
        departure_time: new Date().toISOString(),
        status: 'in_flight',
        active_failures: [],
        bridge_command_queue: [restartCommand],
        xplane_data: {
          contract_id: selectedContract.id,
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
          bridge_command_queue: [restartCommand]
        }
      });

      // Update contract status
      await base44.entities.Contract.update(selectedContract.id, { status: 'in_progress' });

      // Update aircraft status
      await base44.entities.Aircraft.update(selectedAircraft, { status: 'in_flight' });

      // Update crew status
      for (const [role, id] of Object.entries(selectedCrew)) {
        if (id) {
          await base44.entities.Employee.update(id, { status: 'on_duty' });
        }
      }

      return flight;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsAssignDialogOpen(false);
      setSelectedContract(null);
      setSelectedAircraft('');
      setSelectedCrew({ captain: '', first_officer: '', flight_attendant: '', loadmaster: '' });
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

      if (activeFlight?.crew) {
        for (const member of activeFlight.crew) {
          await base44.entities.Employee.update(member.employee_id, {
            status: 'available'
          });
        }
      }

      return { penalty };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  const getCrewRequirement = (contract, role) => {
    return contract?.required_crew?.[role] || 0;
  };

  const isCrewComplete = (contract) => {
    if (!contract?.required_crew) return true;

    for (const [role, required] of Object.entries(contract.required_crew)) {
      if (required > 0 && (!selectedCrew[role] || selectedCrew[role] === '__none__')) return false;
    }
    return true;
  };

  const selectedAircraftType = aircraft.find((a) => a.id === selectedAircraft)?.type || null;

  const getPilotLicenseError = () => {
    if (!selectedAircraftType) return null;
    for (const [role, empId] of Object.entries(selectedCrew)) {
      if (!empId || !isPilotRole(role)) continue;
      const emp = employees.find((e) => e.id === empId);
      if (!emp) continue;
      if (!hasTypeRating(emp, selectedAircraftType)) {
        return lang === 'de'
          ? `${emp.name} hat keine Type-Rating für ${getTypeLabel(selectedAircraftType, 'de')}`
          : `${emp.name} has no type-rating for ${getTypeLabel(selectedAircraftType, 'en')}`;
      }
    }
    return null;
  };

  const canStartFlight = () => {
    return selectedAircraft && isCrewComplete(selectedContract) && !getPilotLicenseError();
  };

  const getRoleLabel = (role) => {
    const labels = lang === 'de' ? {
      captain: 'Kapitaen',
      first_officer: 'Erster Offizier',
      flight_attendant: 'Flugbegleiter/in',
      loadmaster: 'Lademeister'
    } : {
      captain: 'Captain',
      first_officer: 'First Officer',
      flight_attendant: 'Flight Attendant',
      loadmaster: 'Loadmaster'
    };
    return labels[role] || role;
  };

  const allContracts = [...contracts, ...inProgressContracts];
  const [activeTab, setActiveTab] = useState('active');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8">

          <h1 className="text-3xl font-bold text-white">{t('active_flights', lang)}</h1>
          <p className="text-slate-400">
            {lang === 'de'
              ? 'Bereite Fluege vor und starte sie mit FlightSim'
              : 'Prepare flights and start them with FlightSim'}
          </p>
        </motion.div>

        {/* Connection Status */}
        <Card className="p-4 mb-6 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
              company?.xplane_connection_status === 'connected' ?
              'bg-emerald-400 animate-pulse' :
              'bg-slate-600'}`
              } />
              <span>
                FlightSim: {company?.xplane_connection_status === 'connected'
                  ? (lang === 'de' ? 'Verbunden' : 'Connected')
                  : (lang === 'de' ? 'Nicht verbunden' : 'Disconnected')}
              </span>
            </div>
            {company?.xplane_connection_status !== 'connected' &&
            <p className="text-sm text-slate-300">
                {t('plugin_required', lang)}
              </p>
            }
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'active' ?
            'border-b-2 border-blue-500 text-blue-400' :
            'text-slate-400 hover:text-white'}`
            }>

            {t('active_flights_tab', lang)} ({allContracts.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'completed' ?
            'border-b-2 border-emerald-500 text-emerald-400' :
            'text-slate-400 hover:text-white'}`
            }>

            {t('completed_flights', lang)} ({completedContracts.length})
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'failed' ?
            'border-b-2 border-red-500 text-red-400' :
            'text-slate-400 hover:text-white'}`
            }>

            {t('failed_flights', lang)} ({failedContracts.length})
          </button>
        </div>

        {/* Active Contracts */}
        {activeTab === 'active' && allContracts.length > 0 ?
        <div className="space-y-4">
            <AnimatePresence>
              {allContracts.map((contract) =>
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}>

                  <Card className="overflow-hidden bg-slate-800 border border-slate-700">
                    <div className={`h-1 ${
                contract.status === 'in_progress' ?
                'bg-blue-500' :
                'bg-amber-500'}`
                } />
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-semibold text-white">
                              {contract.title}
                            </h3>
                            <Badge className={
                        contract.status === 'in_progress' ?
                        'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                        }>
                              {contract.status === 'in_progress' ? t('in_flight', lang) : t('ready', lang)}
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
                          {contract.bonus_potential > 0 &&
                      <p className="text-sm text-amber-600">
                              +${contract.bonus_potential?.toLocaleString()} {lang === 'de' ? 'Bonus' : 'Bonus'}
                            </p>
                      }
                        </div>
                      </div>

                      {/* Required Crew */}
                      {contract.required_crew &&
                  <div className="flex items-center gap-4 mb-4 p-3 bg-slate-900 rounded-lg">
                          <span className="text-sm text-slate-400">{t('required_crew', lang)}:</span>
                          <div className="flex items-center gap-3">
                            {Object.entries(contract.required_crew).map(([role, count]) =>
                      count > 0 &&
                      <Badge key={role} variant="outline" className="text-slate-50 px-2.5 py-0.5 text-xs font-semibold rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {count}x {getRoleLabel(role)}
                                </Badge>

                      )}
                          </div>
                        </div>
                  }

                      <div className="flex justify-end gap-2">
                        {contract.status === 'accepted' &&
                    <>
                            <Button
                        onClick={() => {
                          const penalty = contract?.payout * 0.3 || 5000;
                          if (confirm(`${t('cancel_confirm', lang)} $${penalty.toLocaleString()}`)) {
                            cancelFlightMutation.mutate({ contract, flight: null });
                          }
                        }}
                        disabled={cancelFlightMutation.isPending}
                        variant="destructive">

                              {cancelFlightMutation.isPending ? t('cancelling', lang) : t('cancel_flight', lang)}
                            </Button>
                            <Button
                        onClick={() => {
                          setSelectedContract(contract);
                          setIsAssignDialogOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700">

                              <Play className="w-4 h-4 mr-2" />
                              {t('prepare_flight', lang)}
                            </Button>
                          </>
                    }
                        {contract.status === 'in_progress' &&
                    <>
                            <Button
                        onClick={() => {
                          const penalty = contract?.payout * 0.3 || 5000;
                          if (confirm(`${t('cancel_confirm', lang)} $${penalty.toLocaleString()}`)) {
                            const linkedFlight = inFlightRecords.find((f) => f.contract_id === contract.id) || null;
                            cancelFlightMutation.mutate({ contract, flight: linkedFlight });
                          }
                        }}
                        disabled={cancelFlightMutation.isPending}
                        variant="destructive">

                              {cancelFlightMutation.isPending ? t('cancelling', lang) : t('cancel_flight', lang)}
                            </Button>
                            <Link to={createPageUrl(`FlightTracker?contractId=${contract.id}`)}>
                              <Button className="bg-emerald-600 hover:bg-emerald-700">
                                <Plane className="w-4 h-4 mr-2" />
                                {t('track_flight', lang)}
                              </Button>
                            </Link>
                          </>
                    }
                      </div>
                    </div>
                  </Card>
                </motion.div>
            )}
            </AnimatePresence>
          </div> :
        activeTab === 'active' ?
        <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('no_active_contracts', lang)}</h3>
            <p className="text-slate-400 mb-4">
              {t('accept_contract_to_start', lang)}
            </p>
            <Link to={createPageUrl("Contracts")}>
              <Button>{t('browse_contracts_label', lang)}</Button>
            </Link>
          </Card> :
        null}

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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('prepare_flight_title', lang)}: {selectedContract?.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Aircraft Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Plane className="w-4 h-4" />
                  {t('select_aircraft_label', lang)}
                </Label>
                <Select value={selectedAircraft} onValueChange={setSelectedAircraft}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('choose_aircraft', lang)} />
                  </SelectTrigger>
                  <SelectContent>
                    {aircraft.filter((ac) => {
                      // Filter to only show compatible aircraft
                      const passengerOk = ac.passenger_capacity >= (selectedContract?.passenger_count || 0);
                      const cargoOk = ac.cargo_capacity_kg >= (selectedContract?.cargo_weight_kg || 0);
                      const rangeOk = ac.range_nm >= (selectedContract?.distance_nm || 0);
                      return passengerOk && cargoOk && rangeOk;
                    }).map((ac) =>
                    <SelectItem key={ac.id} value={ac.id}>
                        {ac.name} ({ac.registration}) - {ac.passenger_capacity} {t('seats', lang)}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {aircraft.length === 0 &&
                <p className="text-sm text-red-500">{t('no_available_aircraft', lang)}</p>
                }
              </div>

              {/* Crew Selection */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('assign_crew', lang)}
                </Label>

                {['captain', 'first_officer', 'flight_attendant', 'loadmaster'].map((role) => {
                  const required = getCrewRequirement(selectedContract, role);
                  const roleEmployees = employees.filter((e) => e.role === role);

                  if (required === 0 && roleEmployees.length === 0) return null;

                  const needsLicense = isPilotRole(role) && selectedAircraftType;

                  return (
                    <div key={role} className="flex items-center gap-4">
                      <div className="w-40">
                        <span className="text-sm font-medium">
                          {getRoleLabel(role)}
                          {required > 0 && <span className="text-red-100 ml-1">*</span>}
                        </span>
                      </div>
                      <Select
                        value={selectedCrew[role]}
                        onValueChange={(value) => setSelectedCrew({ ...selectedCrew, [role]: value === 'none' ? '' : value })}>

                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={`${getRoleLabel(role)}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('do_not_assign', lang)}</SelectItem>
                          {roleEmployees.map((emp) => {
                            const licensed = needsLicense ? hasTypeRating(emp, selectedAircraftType) : true;
                            return (
                              <SelectItem key={emp.id} value={emp.id} disabled={!licensed}>
                                {emp.name} (Skill: {emp.skill_rating})
                                {needsLicense && !licensed && ` · ${lang === 'de' ? '🚫 Keine Lizenz' : '🚫 No license'}`}
                                {needsLicense && licensed && ` · ✓`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {required > 0 && !selectedCrew[role] &&
                      <AlertCircle className="w-5 h-5 text-amber-100" />
                      }
                      {selectedCrew[role] &&
                      <CheckCircle className="w-5 h-5 text-emerald-100" />
                      }
                    </div>);

                })}
              </div>

              {/* Warning */}
              {!isCrewComplete(selectedContract) &&
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">{t('incomplete_crew', lang)}</p>
                    <p className="text-sm text-amber-700">
                      {t('incomplete_crew_msg', lang)}
                    </p>
                  </div>
                </div>
              }

              {/* Type-Rating block */}
              {getPilotLicenseError() &&
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-300">
                      {lang === 'de' ? 'Type-Rating fehlt' : 'Type-rating missing'}
                    </p>
                    <p className="text-sm text-red-200">{getPilotLicenseError()}</p>
                    <p className="text-xs text-red-200/80 mt-1">
                      {lang === 'de'
                        ? 'Sende den Piloten zum Training (Pilot-Details).'
                        : 'Send the pilot to training (employee details).'}
                    </p>
                  </div>
                </div>
              }
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                {t('abort', lang)}
              </Button>
              <Button
                onClick={() => startFlightMutation.mutate()}
                disabled={!canStartFlight() || startFlightMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700">

                {startFlightMutation.isPending ? t('starting', lang) : t('start_flight', lang)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>);

}