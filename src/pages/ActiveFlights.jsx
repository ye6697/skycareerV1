import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plane, Users, MapPin, ArrowRight, AlertCircle, CheckCircle, Play,
  User, XCircle
} from "lucide-react";
import { useLanguage, useT } from "@/components/LanguageContext";
import { t as tr } from "@/components/i18n/translations";

export default function ActiveFlights() {
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const t = useT();
  const [selectedContract, setSelectedContract] = useState(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState('');
  const [selectedCrew, setSelectedCrew] = useState({
    captain: '', first_officer: '', flight_attendant: '', loadmaster: ''
  });
  const [activeTab, setActiveTab] = useState('active');

  // Get current user & company
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });

  const { data: company } = useQuery({
    queryKey: ['company', currentUser?.company_id],
    queryFn: async () => {
      if (currentUser?.company_id) {
        const c = await base44.entities.Company.filter({ id: currentUser.company_id });
        if (c[0]) return c[0];
      }
      const c = await base44.entities.Company.filter({ created_by: currentUser.email });
      return c[0];
    },
    enabled: !!currentUser,
    staleTime: 120000,
  });

  const companyId = company?.id;

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'accepted', companyId],
    queryFn: () => base44.entities.Contract.filter({ status: 'accepted', company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: inProgressContracts = [] } = useQuery({
    queryKey: ['contracts', 'in_progress', companyId],
    queryFn: () => base44.entities.Contract.filter({ status: 'in_progress', company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: completedContracts = [] } = useQuery({
    queryKey: ['contracts', 'completed', companyId],
    queryFn: () => base44.entities.Contract.filter({ status: 'completed', company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: failedContracts = [] } = useQuery({
    queryKey: ['contracts', 'failed', companyId],
    queryFn: () => base44.entities.Contract.filter({ status: 'failed', company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: aircraft = [] } = useQuery({
    queryKey: ['aircraft', 'available', companyId],
    queryFn: () => base44.entities.Aircraft.filter({ status: 'available', company_id: companyId }),
    enabled: !!companyId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'available', companyId],
    queryFn: () => base44.entities.Employee.filter({ status: 'available', company_id: companyId }),
    enabled: !!companyId,
  });

  const startFlightMutation = useMutation({
    mutationFn: async () => {
      const ac = aircraft.find(a => a.id === selectedAircraft);
      if (!ac) throw new Error('Aircraft not found');
      if (ac.passenger_capacity < (selectedContract?.passenger_count || 0)) throw new Error('Not enough seats');
      if (ac.cargo_capacity_kg < (selectedContract?.cargo_weight_kg || 0)) throw new Error('Not enough cargo');
      if (ac.range_nm < (selectedContract?.distance_nm || 0)) throw new Error('Not enough range');

      const flight = await base44.entities.Flight.create({
        company_id: companyId,
        contract_id: selectedContract.id,
        aircraft_id: selectedAircraft,
        crew: Object.entries(selectedCrew).filter(([_, id]) => id).map(([role, id]) => ({ role, employee_id: id })),
        departure_time: new Date().toISOString(),
        status: 'in_flight'
      });

      await base44.entities.Contract.update(selectedContract.id, { status: 'in_progress' });
      await base44.entities.Aircraft.update(selectedAircraft, { status: 'in_flight' });
      for (const [_, id] of Object.entries(selectedCrew)) {
        if (id) await base44.entities.Employee.update(id, { status: 'on_duty' });
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
    mutationFn: async (contractToCancel) => {
      const penalty = (contractToCancel.payout + (contractToCancel.bonus_potential || 0)) * 0.1;
      await base44.entities.Contract.update(contractToCancel.id, { status: 'available', company_id: null });
      if (company) {
        await base44.entities.Company.update(company.id, { balance: Math.max(0, (company.balance || 0) - penalty) });
        await base44.entities.Transaction.create({
          company_id: companyId, type: 'expense', category: 'other',
          amount: penalty, description: `Stornierungsgebühr: ${contractToCancel.title}`, date: new Date().toISOString()
        });
      }
      return penalty;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    }
  });

  const getCrewRequirement = (contract, role) => contract?.required_crew?.[role] || 0;

  const isCrewComplete = (contract) => {
    if (!contract?.required_crew) return true;
    for (const [role, required] of Object.entries(contract.required_crew)) {
      if (required > 0 && !selectedCrew[role]) return false;
    }
    return true;
  };

  const canStartFlight = () => selectedAircraft && isCrewComplete(selectedContract);

  const getRoleLabel = (role) => {
    const labels = {
      captain: t('Captain', 'Kapitän'),
      first_officer: t('First Officer', 'Erster Offizier'),
      flight_attendant: t('Flight Attendant', 'Flugbegleiter/in'),
      loadmaster: t('Loadmaster', 'Lademeister')
    };
    return labels[role] || role;
  };

  const allContracts = [...contracts, ...inProgressContracts];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-white">{t('Active Flights', 'Aktive Flüge')}</h1>
          <p className="text-slate-400">{t('Prepare flights and start them with X-Plane 12', 'Bereite Flüge vor und starte sie mit X-Plane 12')}</p>
        </motion.div>

        {/* Connection Status */}
        <Card className="p-4 mb-6 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${company?.xplane_connection_status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>X-Plane 12: {company?.xplane_connection_status === 'connected' ? t('Connected', 'Verbunden') : t('Not connected', 'Nicht verbunden')}</span>
            </div>
            {company?.xplane_connection_status !== 'connected' && (
              <p className="text-sm text-slate-300">{t('Plugin connection required for live flight data', 'Plugin-Verbindung erforderlich für Live-Flugdaten')}</p>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700 overflow-x-auto">
          {[
            { id: 'active', label: t('Active Flights', 'Aktive Flüge'), count: allContracts.length, color: 'blue' },
            { id: 'completed', label: t('Completed', 'Abgeschlossen'), count: completedContracts.length, color: 'emerald' },
            { id: 'failed', label: t('Failed', 'Fehlgeschlagen'), count: failedContracts.length, color: 'red' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? `border-b-2 border-${tab.color}-500 text-${tab.color}-400` : 'text-slate-400 hover:text-white'
              }`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Active Contracts */}
        {activeTab === 'active' && (allContracts.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence>
              {allContracts.map(contract => (
                <motion.div key={contract.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <Card className="overflow-hidden bg-slate-800 border border-slate-700">
                    <div className={`h-1 ${contract.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-semibold text-white">{contract.title}</h3>
                            <Badge className={contract.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                              {contract.status === 'in_progress' ? t('In Flight', 'Im Flug') : t('Ready', 'Bereit')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{contract.departure_airport}</span>
                            <ArrowRight className="w-4 h-4" />
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{contract.arrival_airport}</span>
                            <span className="text-slate-600">|</span>
                            <span>{contract.distance_nm} NM</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-600">${contract.payout?.toLocaleString()}</p>
                          {contract.bonus_potential > 0 && <p className="text-sm text-amber-600">+${contract.bonus_potential?.toLocaleString()} Bonus</p>}
                        </div>
                      </div>

                      {contract.required_crew && (
                        <div className="flex items-center gap-4 mb-4 p-3 bg-slate-900 rounded-lg flex-wrap">
                          <span className="text-sm text-slate-400">{t('Required Crew:', 'Benötigte Crew:')}</span>
                          <div className="flex items-center gap-3 flex-wrap">
                            {Object.entries(contract.required_crew).map(([role, count]) => count > 0 && (
                              <Badge key={role} variant="outline" className="text-slate-50 flex items-center gap-1">
                                <User className="w-3 h-3" />{count}x {getRoleLabel(role)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        {contract.status === 'accepted' && (
                          <>
                            <Button onClick={() => { setSelectedContract(contract); setIsAssignDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
                              <Play className="w-4 h-4 mr-2" />{t('Prepare Flight', 'Flug vorbereiten')}
                            </Button>
                            <Button onClick={() => cancelFlightMutation.mutate(contract)} disabled={cancelFlightMutation.isPending} variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
                              {t('Cancel', 'Stornieren')}
                            </Button>
                          </>
                        )}
                        {contract.status === 'in_progress' && (
                          <>
                            <Link to={createPageUrl(`FlightTracker?contractId=${contract.id}`)}>
                              <Button className="bg-emerald-600 hover:bg-emerald-700">
                                <Plane className="w-4 h-4 mr-2" />{t('Track Flight', 'Flug verfolgen')}
                              </Button>
                            </Link>
                            <Button onClick={() => cancelFlightMutation.mutate(contract)} disabled={cancelFlightMutation.isPending} variant="outline" className="border-red-500 text-red-400 hover:bg-red-500/10">
                              {t('Abort', 'Abbrechen')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <Plane className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('No active contracts', 'Keine aktiven Aufträge')}</h3>
            <p className="text-slate-400 mb-4">{t('Accept a contract to start a flight', 'Nimm einen Auftrag an, um einen Flug zu starten')}</p>
            <Link to={createPageUrl("Contracts")}><Button>{t('Browse Contracts', 'Aufträge durchsuchen')}</Button></Link>
          </Card>
        ))}

        {/* Completed */}
        {activeTab === 'completed' && (completedContracts.length > 0 ? (
          <div className="space-y-4">
            {completedContracts.map(contract => (
              <Link key={contract.id} to={createPageUrl(`CompletedFlightDetails?contractId=${contract.id}`)}>
                <Card className="overflow-hidden bg-slate-800 border border-slate-700 hover:border-emerald-500 transition-colors cursor-pointer mb-4">
                  <div className="h-1 bg-emerald-500" />
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-semibold text-white">{contract.title}</h3>
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t('Completed', 'Abgeschlossen')}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-slate-400">
                          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{contract.departure_airport}</span>
                          <ArrowRight className="w-4 h-4" />
                          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{contract.arrival_airport}</span>
                          <span className="text-slate-600">|</span><span>{contract.distance_nm} NM</span>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">${contract.payout?.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <CheckCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('No completed flights', 'Keine abgeschlossenen Flüge')}</h3>
            <p className="text-slate-400">{t('All completed flights will be shown here', 'Alle abgeschlossenen Flüge werden hier angezeigt')}</p>
          </Card>
        ))}

        {/* Failed */}
        {activeTab === 'failed' && (failedContracts.length > 0 ? (
          <div className="space-y-4">
            {failedContracts.map(contract => (
              <Card key={contract.id} className="overflow-hidden bg-slate-800 border border-slate-700">
                <div className="h-1 bg-red-500" />
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-semibold text-white">{contract.title}</h3>
                        <Badge className="bg-red-100 text-red-700 border-red-200">{t('Failed', 'Fehlgeschlagen')}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{contract.departure_airport}</span>
                        <ArrowRight className="w-4 h-4" />
                        <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{contract.arrival_airport}</span>
                        <span className="text-slate-600">|</span><span>{contract.distance_nm} NM</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-red-500">${contract.payout?.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <XCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('No failed contracts', 'Keine fehlgeschlagenen Aufträge')}</h3>
            <p className="text-slate-400">{t('Failed contracts will be shown here', 'Fehlgeschlagene Aufträge werden hier angezeigt')}</p>
          </Card>
        ))}

        {/* Assignment Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="max-w-2xl bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">{t('Prepare Flight:', 'Flug vorbereiten:')} {selectedContract?.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-300"><Plane className="w-4 h-4" />{t('Select Aircraft', 'Flugzeug auswählen')}</Label>
                <Select value={selectedAircraft} onValueChange={setSelectedAircraft}>
                  <SelectTrigger className="bg-slate-900 border-slate-600"><SelectValue placeholder={t('Choose aircraft...', 'Flugzeug wählen...')} /></SelectTrigger>
                  <SelectContent>
                    {aircraft.filter(ac => {
                      const passengerOk = ac.passenger_capacity >= (selectedContract?.passenger_count || 0);
                      const cargoOk = ac.cargo_capacity_kg >= (selectedContract?.cargo_weight_kg || 0);
                      const rangeOk = ac.range_nm >= (selectedContract?.distance_nm || 0);
                      return passengerOk && cargoOk && rangeOk;
                    }).map(ac => (
                      <SelectItem key={ac.id} value={ac.id}>{ac.name} ({ac.registration}) - {ac.passenger_capacity} {t('seats', 'Sitze')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {aircraft.length === 0 && <p className="text-sm text-red-500">{t('No available aircraft!', 'Kein verfügbares Flugzeug!')}</p>}
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-slate-300"><Users className="w-4 h-4" />{t('Assign Crew', 'Crew zuweisen')}</Label>
                {['captain', 'first_officer', 'flight_attendant', 'loadmaster'].map(role => {
                  const required = getCrewRequirement(selectedContract, role);
                  const roleEmployees = employees.filter(e => e.role === role);
                  if (required === 0 && roleEmployees.length === 0) return null;
                  return (
                    <div key={role} className="flex items-center gap-4">
                      <div className="w-40">
                        <span className="text-sm font-medium text-slate-300">
                          {getRoleLabel(role)}{required > 0 && <span className="text-red-400 ml-1">*</span>}
                        </span>
                      </div>
                      <Select value={selectedCrew[role]} onValueChange={v => setSelectedCrew({ ...selectedCrew, [role]: v })}>
                        <SelectTrigger className="flex-1 bg-slate-900 border-slate-600"><SelectValue placeholder={`${getRoleLabel(role)} ${t('choose...', 'wählen...')}`} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>-- {t('Not assigned', 'Nicht zuweisen')} --</SelectItem>
                          {roleEmployees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name} (Skill: {emp.skill_rating})</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {required > 0 && !selectedCrew[role] && <AlertCircle className="w-5 h-5 text-amber-400" />}
                      {selectedCrew[role] && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>

              {!isCrewComplete(selectedContract) && (
                <div className="p-3 bg-amber-900/20 border border-amber-700/40 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-300">{t('Incomplete Crew', 'Unvollständige Crew')}</p>
                    <p className="text-sm text-amber-400">{t('A complete crew is required for this contract.', 'Für diesen Auftrag wird eine vollständige Crew benötigt.')}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setIsAssignDialogOpen(false)}>{t('Cancel', 'Abbrechen')}</Button>
              <Button onClick={() => startFlightMutation.mutate()} disabled={!canStartFlight() || startFlightMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {startFlightMutation.isPending ? t('Starting...', 'Starte...') : t('Start Flight', 'Flug starten')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}