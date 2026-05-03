import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { GraduationCap, X, MapPin, ArrowRight, DollarSign, Plane, Trophy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import {
  getTypeRatingCost,
  startTypeRatingTraining,
  TYPE_RATING_PASS_SCORE,
  TYPE_RATING_MAX_NM,
  userHasTypeRating,
  getActiveTypeRating,
  canEarnTypeRating,
} from '@/lib/typeRatings';
import RealMoneyBuyButton from '@/components/store/RealMoneyBuyButton';
import { TYPE_RATING_ITEM } from '@/lib/lemonItemCatalog';

// Animated, glass-style popup that lets the player pay for and start a
// type-rating training mission for a specific aircraft model. The mission
// must be flown under 100 NM and scored at least 80% to unlock the rating.
export default function TypeRatingMissionPopup({ open, aircraft, company, user, onClose }) {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const modelName = aircraft?.name || '';
  const cost = getTypeRatingCost(aircraft);
  const hasRating = userHasTypeRating(user, modelName);
  const active = getActiveTypeRating(user, modelName);
  const canPay = (company?.balance || 0) >= cost;
  const requiredLevel = Number(aircraft?.level_requirement || 1);
  const companyLevel = Number(company?.level || 1);
  const hasLevel = canEarnTypeRating(company, aircraft);

  // Fetch existing accepted training contracts for this model.
  const { data: trainingContracts = [], refetch: refetchTraining } = useQuery({
    queryKey: ['type-rating-training-contracts', company?.id, modelName],
    queryFn: async () => {
      if (!company?.id || !modelName) return [];
      const all = await base44.entities.Contract.filter({
        company_id: company.id,
        type: 'charter',
      });
      return all.filter((c) => c?.briefing?.includes(`__TR__:${modelName}`));
    },
    enabled: !!(open && active && company?.id && modelName),
    staleTime: 5000,
  });

  // Helper: create the 3 training contracts for this model.
  async function createTrainingContracts() {
    const hub = company.hub_airport || 'EDDF';
    const now = Date.now();
    const presetRoutes = [
      { from: hub, to: hub === 'EDDM' ? 'EDDF' : 'EDDM', dist: 80 },
      { from: hub, to: hub === 'EDDH' ? 'EDDF' : 'EDDH', dist: 95 },
      { from: hub, to: hub === 'EDDS' ? 'EDDF' : 'EDDS', dist: 70 },
    ];
    await Promise.all(presetRoutes.map((r, i) =>
      base44.entities.Contract.create({
        company_id: company.id,
        title: `Type-Rating: ${modelName} (${i + 1}/3)`,
        briefing: `__TR__:${modelName}`,
        type: 'charter',
        departure_airport: r.from,
        arrival_airport: r.to,
        distance_nm: r.dist,
        payout: 5000,
        deadline: new Date(now + 7 * 24 * 3600 * 1000).toISOString(),
        required_aircraft_type: [aircraft.type],
        required_crew: { captain: 1 },
        status: 'available',
        difficulty: 'easy',
        level_requirement: 1,
        bonus_potential: 2000,
      })
    ));
  }

  // Pay & generate 3 training mission contracts (status=available so the
  // player can pick one and accept it from this popup).
  const startMission = useMutation({
    mutationFn: async () => {
      if (!aircraft || !company) throw new Error('Missing data');
      const { cost: paid } = await startTypeRatingTraining({
        aircraftModel: modelName,
        aircraftType: aircraft.type,
        aircraftLevelRequirement: requiredLevel,
        company,
      });
      await createTrainingContracts();
      return { paid };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      refetchTraining();
    },
  });

  // Recovery: if user already paid (active rating exists) but no contracts
  // are present (e.g. previous create call failed or contracts were deleted),
  // allow them to regenerate the 3 missions for free.
  const regenContracts = useMutation({
    mutationFn: async () => {
      if (!aircraft || !company) throw new Error('Missing data');
      await createTrainingContracts();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      refetchTraining();
    },
  });

  // Accept a single training contract (sets it to accepted/in-progress).
  const acceptContract = useMutation({
    mutationFn: async (contract) => {
      await base44.functions.invoke('acceptContract', { contractId: contract.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contractsPageData'] });
      refetchTraining();
    },
  });

  if (!open || !aircraft) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/40 shadow-[0_0_60px_rgba(6,182,212,0.3)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow accents */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="relative px-6 py-4 border-b border-cyan-500/20 bg-slate-950/60 backdrop-blur">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {lang === 'de' ? 'Type-Rating Training' : 'Type-Rating Training'}
                </h2>
                <p className="text-xs text-cyan-400 font-mono">{modelName}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[calc(90vh-7rem)]">
            <div className="p-6 space-y-4">
              {/* Already has rating */}
              {hasRating && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center gap-3"
                >
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-emerald-300">
                      {lang === 'de' ? 'Rating bereits erworben!' : 'Rating already earned!'}
                    </p>
                    <p className="text-xs text-emerald-400/80">
                      {lang === 'de' ? `Du darfst die ${modelName} fliegen.` : `You may fly the ${modelName}.`}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Active training */}
              {!hasRating && active && (
                <>
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-cyan-300" />
                      <p className="text-sm font-bold text-cyan-200">
                        {lang === 'de' ? 'Training läuft' : 'Training in progress'}
                      </p>
                    </div>
                    <p className="text-xs text-cyan-300/90">
                      {lang === 'de'
                        ? `Schließe einen der folgenden Trainingsflüge mit ≥${TYPE_RATING_PASS_SCORE}% Score ab, um dein Rating zu erhalten.`
                        : `Complete one of the training flights below with ≥${TYPE_RATING_PASS_SCORE}% score to earn your rating.`}
                    </p>
                  </motion.div>

                  {/* Training contract cards */}
                  <div className="space-y-2">
                    {trainingContracts.length === 0 && (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center space-y-3">
                        <p className="text-xs text-amber-200">
                          {lang === 'de'
                            ? 'Keine Trainingsaufträge gefunden. Klicke unten, um sie (erneut) zu erzeugen.'
                            : 'No training contracts found. Click below to (re)generate them.'}
                        </p>
                        <Button
                          onClick={() => regenContracts.mutate()}
                          disabled={regenContracts.isPending}
                          className="h-9 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                        >
                          {regenContracts.isPending
                            ? (lang === 'de' ? 'Erzeuge…' : 'Generating…')
                            : (lang === 'de' ? 'Aufträge erzeugen' : 'Generate contracts')}
                        </Button>
                        {regenContracts.isError && (
                          <p className="text-xs text-red-400">
                            {String(regenContracts.error?.message || 'Error')}
                          </p>
                        )}
                      </div>
                    )}
                    {trainingContracts.map((contract, idx) => {
                      const status = String(contract?.status || 'available').toLowerCase();
                      const isAvailable = status === 'available';
                      const isAccepted = status === 'accepted' || status === 'in_progress';
                      return (
                        <motion.div
                          key={contract.id}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.08 }}
                          className="rounded-xl border border-slate-700 bg-slate-900/60 backdrop-blur p-4 hover:border-cyan-500/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{contract.title}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                <MapPin className="w-3 h-3" />
                                <span>{contract.departure_airport}</span>
                                <ArrowRight className="w-3 h-3" />
                                <span>{contract.arrival_airport}</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-cyan-300">{contract.distance_nm} NM</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-400">
                                ${(contract.payout || 0).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1 mb-2">
                            <Trophy className="w-3 h-3" />
                            {lang === 'de'
                              ? `Mindestens ${TYPE_RATING_PASS_SCORE}% Score nötig`
                              : `Minimum ${TYPE_RATING_PASS_SCORE}% score required`}
                          </div>
                          {isAvailable && (
                            <Button
                              onClick={() => acceptContract.mutate(contract)}
                              disabled={acceptContract.isPending}
                              className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                            >
                              {acceptContract.isPending
                                ? (lang === 'de' ? 'Wird angenommen…' : 'Accepting…')
                                : (lang === 'de' ? 'Auftrag annehmen' : 'Accept contract')}
                            </Button>
                          )}
                          {isAccepted && (
                            <div className="text-[10px] text-emerald-300 text-center font-mono uppercase tracking-wider">
                              {lang === 'de' ? '✓ Angenommen – siehe „Aktive Flüge"' : '✓ Accepted – see "Active Flights"'}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-slate-400 text-center">
                    {lang === 'de'
                      ? 'Wähle einen Auftrag aus und nimm ihn an.'
                      : 'Pick a contract and accept it to start training.'}
                  </div>
                </>
              )}

              {/* No rating yet, no active training: show start button */}
              {!hasRating && !active && (
                <>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {lang === 'de'
                        ? `Um die ${modelName} kaufen und fliegen zu können, brauchst du ein Type-Rating für dieses Modell.`
                        : `To purchase and fly the ${modelName}, you need a type-rating for this model.`}
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-950/60 border border-slate-700/50 p-3">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{lang === 'de' ? 'Kosten' : 'Cost'}</span>
                        </div>
                        <p className={`text-lg font-bold ${canPay ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${cost.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-950/60 border border-slate-700/50 p-3">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>{lang === 'de' ? 'Min-Score' : 'Min score'}</span>
                        </div>
                        <p className="text-lg font-bold text-cyan-400">{TYPE_RATING_PASS_SCORE}%</p>
                      </div>
                      <div className="rounded-lg bg-slate-950/60 border border-slate-700/50 p-3">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Plane className="w-3.5 h-3.5" />
                          <span>{lang === 'de' ? 'Min-Level' : 'Min level'}</span>
                        </div>
                        <p className={`text-lg font-bold ${hasLevel ? 'text-emerald-400' : 'text-red-400'}`}>
                          {requiredLevel}
                        </p>
                      </div>
                    </div>

                    <ul className="text-xs text-slate-300 space-y-1.5 mt-2">
                      <li className="flex items-start gap-2">
                        <Plane className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <span>{lang === 'de'
                          ? `Du erhältst 3 Trainingsaufträge unter ${TYPE_RATING_MAX_NM} NM.`
                          : `You get 3 training contracts under ${TYPE_RATING_MAX_NM} NM.`}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Trophy className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <span>{lang === 'de'
                          ? `Erreiche bei einem Flug ≥${TYPE_RATING_PASS_SCORE}% Score, um das Rating zu erhalten.`
                          : `Achieve ≥${TYPE_RATING_PASS_SCORE}% score on one flight to earn the rating.`}</span>
                      </li>
                    </ul>
                  </div>

                  {!hasLevel && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <p className="text-xs text-red-300">
                        {lang === 'de'
                          ? `Dein Firmen-Level (${companyLevel}) ist zu niedrig. Mindestens Level ${requiredLevel} erforderlich.`
                          : `Your company level (${companyLevel}) is too low. Level ${requiredLevel} required.`}
                      </p>
                    </div>
                  )}

                  {hasLevel && !canPay && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <p className="text-xs text-red-300">
                        {lang === 'de' ? 'Nicht genug Geld' : 'Insufficient funds'}
                      </p>
                    </div>
                  )}

                  {startMission.isError && (
                    <p className="text-xs text-red-400 text-center">
                      {String(startMission.error?.message || 'Error')}
                    </p>
                  )}

                  <Button
                    onClick={() => startMission.mutate()}
                    disabled={!canPay || !hasLevel || startMission.isPending}
                    className="w-full h-11 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold disabled:opacity-50"
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {startMission.isPending
                      ? (lang === 'de' ? 'Starte Training…' : 'Starting…')
                      : (lang === 'de' ? `Training starten (-$${cost.toLocaleString()})` : `Start training (-$${cost.toLocaleString()})`)}
                  </Button>

                  {/* Real-money instant unlock */}
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center" aria-hidden>
                      <div className="w-full border-t border-slate-700" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-2 text-[10px] font-mono uppercase tracking-wider bg-slate-950 text-slate-500">
                        {lang === 'de' ? 'oder' : 'or'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-200">
                        {lang === 'de' ? 'Sofort freischalten' : 'Instant unlock'}
                      </p>
                      <p className="text-[10px] text-amber-300/80">
                        {lang === 'de'
                          ? 'Kein Training nötig — sofort verfügbar.'
                          : 'No training required — available immediately.'}
                      </p>
                    </div>
                    <RealMoneyBuyButton
                      sku={TYPE_RATING_ITEM.sku}
                      priceCents={TYPE_RATING_ITEM.priceCents}
                      metadata={{ aircraft_model: modelName }}
                      label={`$${(TYPE_RATING_ITEM.priceCents / 100).toFixed(2)}`}
                      onDelivered={() => {
                        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
                        onClose?.();
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}