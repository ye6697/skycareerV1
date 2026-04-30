import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Star, AlertTriangle, CheckCircle2, Plane, DollarSign, Timer, Award, Wind, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Animated post-flight summary modal that highlights the most important
// metrics + events with a cinematic reveal, before the user proceeds to the
// detailed result page.
//
// Props:
//   flight   – completed flight record (DB shape)
//   contract – matching contract record
//   lang     – 'de' | 'en'
//   onContinue – called when user presses "Continue" or "X"
export default function FlightCompletionAnimation({ flight, contract, lang = 'de', onContinue }) {
  const [stage, setStage] = useState(0);

  // Auto-progress through reveal stages.
  useEffect(() => {
    const timers = [];
    timers.push(setTimeout(() => setStage(1), 200));
    timers.push(setTimeout(() => setStage(2), 1100));
    timers.push(setTimeout(() => setStage(3), 1900));
    timers.push(setTimeout(() => setStage(4), 2700));
    timers.push(setTimeout(() => setStage(5), 3500));
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const xpd = flight?.xplane_data || {};
  const isCrash = !!xpd?.events?.crash || flight?.status === 'failed';
  const score = Math.round(Number(xpd.final_score ?? flight?.flight_score ?? 0));
  const profit = Math.round(Number(flight?.profit ?? 0));
  const revenue = Math.round(Number(flight?.revenue ?? 0));
  const landingG = Number(xpd.landingGForce ?? xpd.landing_g_force ?? flight?.landing_g_force ?? 0);
  const landingVs = Math.abs(Number(xpd.touchdown_vspeed ?? flight?.landing_vs ?? 0));
  const flightHours = Number(flight?.flight_duration_hours ?? xpd.flightHours ?? 0);
  const events = xpd.events || {};

  const incidentList = [];
  if (events.crash) incidentList.push({ key: 'crash', label: lang === 'de' ? 'CRASH' : 'CRASH', critical: true });
  if (events.tailstrike) incidentList.push({ key: 'tailstrike', label: lang === 'de' ? 'Heckaufsetzer' : 'Tailstrike' });
  if (events.stall) incidentList.push({ key: 'stall', label: lang === 'de' ? 'Stall' : 'Stall' });
  if (events.overstress) incidentList.push({ key: 'overstress', label: lang === 'de' ? 'Strukturlast' : 'Overstress' });
  if (events.overspeed) incidentList.push({ key: 'overspeed', label: 'Overspeed' });
  if (events.flaps_overspeed) incidentList.push({ key: 'flaps_overspeed', label: lang === 'de' ? 'Klappen-Overspeed' : 'Flaps Overspeed' });
  if (events.gear_up_landing) incidentList.push({ key: 'gear_up', label: lang === 'de' ? 'Gear-up' : 'Gear-up' });
  if (events.hard_landing) incidentList.push({ key: 'hard_landing', label: lang === 'de' ? 'Harte Landung' : 'Hard Landing' });
  if (events.high_g_force) incidentList.push({ key: 'high_g', label: lang === 'de' ? 'Hohe G-Kräfte' : 'High G' });
  if (events.wrong_airport) incidentList.push({ key: 'wrong_airport', label: lang === 'de' ? 'Falscher Flughafen' : 'Wrong Airport', critical: true });

  const scoreColor = isCrash ? 'text-red-400'
    : score >= 95 ? 'text-emerald-400'
    : score >= 85 ? 'text-green-400'
    : score >= 70 ? 'text-amber-400'
    : 'text-red-400';
  const scoreLabel = isCrash ? (lang === 'de' ? 'CRASH' : 'CRASH')
    : score >= 95 ? (lang === 'de' ? 'AUSGEZEICHNET' : 'EXCELLENT')
    : score >= 85 ? (lang === 'de' ? 'SEHR GUT' : 'VERY GOOD')
    : score >= 70 ? (lang === 'de' ? 'AKZEPTABEL' : 'ACCEPTABLE')
    : (lang === 'de' ? 'SCHLECHT' : 'POOR');

  const landingLabel = (() => {
    if (isCrash) return lang === 'de' ? 'Crash' : 'Crash';
    if (landingG <= 0) return '-';
    if (landingG < 1.0) return lang === 'de' ? 'Butterweich' : 'Butter';
    if (landingG < 1.2) return lang === 'de' ? 'Weich' : 'Soft';
    if (landingG < 1.6) return lang === 'de' ? 'Akzeptabel' : 'Acceptable';
    if (landingG < 2.0) return lang === 'de' ? 'Hart' : 'Hard';
    return lang === 'de' ? 'Sehr hart' : 'Very Hard';
  })();
  const landingColor = isCrash ? 'text-red-400'
    : landingG <= 0 ? 'text-slate-400'
    : landingG < 1.2 ? 'text-emerald-400'
    : landingG < 1.6 ? 'text-blue-400'
    : landingG < 2.0 ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-3 sm:p-6">
      {/* Background scanlines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
        <motion.div
          initial={{ y: '-100%' }}
          animate={{ y: '100%' }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent"
        />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="relative w-full max-w-2xl rounded-xl border border-cyan-500/40 bg-gradient-to-br from-slate-900/95 to-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.25)] overflow-hidden"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onContinue}
          className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded border border-slate-700 bg-slate-900/80 text-slate-400 hover:text-white hover:border-cyan-500/50 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-cyan-900/40">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-400">
            {lang === 'de' ? 'Flugauswertung' : 'Flight Debrief'}
          </p>
          <p className="text-base sm:text-lg font-bold text-white truncate">
            {contract?.title || (lang === 'de' ? 'Flug abgeschlossen' : 'Flight completed')}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {contract?.departure_airport} → {contract?.arrival_airport}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Stage 1: Score reveal (centered, big) */}
          <AnimatePresence>
            {stage >= 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 14 }}
                className="text-center py-3"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500 mb-1">
                  {lang === 'de' ? 'Finaler Score' : 'Final Score'}
                </p>
                <motion.div
                  initial={{ filter: 'blur(8px)' }}
                  animate={{ filter: 'blur(0px)' }}
                  transition={{ duration: 0.6 }}
                  className={`text-6xl sm:text-7xl font-mono font-bold ${scoreColor}`}
                >
                  {isCrash ? '0' : score}
                </motion.div>
                <p className={`text-xs font-mono uppercase tracking-widest mt-1 ${scoreColor}`}>
                  {scoreLabel}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stage 2: Landing metrics row */}
          <AnimatePresence>
            {stage >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-3 gap-2"
              >
                <StatBox
                  icon={<Activity className="w-3.5 h-3.5" />}
                  label={lang === 'de' ? 'Landung' : 'Landing'}
                  value={landingLabel}
                  valueClass={landingColor}
                />
                <StatBox
                  icon={<Wind className="w-3.5 h-3.5" />}
                  label="V/S"
                  value={landingVs > 0 ? `${Math.round(landingVs)} fpm` : '-'}
                  valueClass={landingVs < 150 ? 'text-emerald-400' : landingVs < 300 ? 'text-amber-400' : 'text-red-400'}
                />
                <StatBox
                  icon={<Star className="w-3.5 h-3.5" />}
                  label="G-Force"
                  value={landingG > 0 ? `${landingG.toFixed(2)}G` : '-'}
                  valueClass={landingG < 1.5 ? 'text-emerald-400' : landingG < 2.0 ? 'text-amber-400' : 'text-red-400'}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stage 3: Profit + flight duration */}
          <AnimatePresence>
            {stage >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-2"
              >
                <StatBox
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                  label={lang === 'de' ? 'Gewinn' : 'Profit'}
                  value={`$${profit.toLocaleString()}`}
                  valueClass={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}
                  big
                  animateNumber={profit}
                />
                <StatBox
                  icon={<Timer className="w-3.5 h-3.5" />}
                  label={lang === 'de' ? 'Flugzeit' : 'Flight Time'}
                  value={`${flightHours.toFixed(2)}h`}
                  valueClass="text-cyan-300"
                  big
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stage 4: Revenue line item */}
          <AnimatePresence>
            {stage >= 4 && revenue !== 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded border border-emerald-700/30 bg-emerald-950/20 px-3 py-2"
              >
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300">
                  {lang === 'de' ? 'Einnahmen' : 'Revenue'}
                </span>
                <span className="text-sm font-mono font-bold text-emerald-300">
                  ${revenue.toLocaleString()}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stage 5: Incidents */}
          <AnimatePresence>
            {stage >= 5 && incidentList.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded border border-red-700/40 bg-red-950/20 px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-red-300">
                    {lang === 'de' ? 'Vorfälle' : 'Incidents'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {incidentList.map((inc, idx) => (
                    <motion.span
                      key={inc.key}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.08 }}
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                        inc.critical
                          ? 'border-red-500 bg-red-900/40 text-red-200'
                          : 'border-amber-700/50 bg-amber-950/30 text-amber-300'
                      }`}
                    >
                      {inc.label}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
            {stage >= 5 && incidentList.length === 0 && !isCrash && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 rounded border border-emerald-700/40 bg-emerald-950/20 px-3 py-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-300">
                  {lang === 'de' ? 'Keine Vorfälle' : 'No incidents'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Continue button */}
        <AnimatePresence>
          {stage >= 5 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-5 pb-5 pt-1"
            >
              <Button
                onClick={onContinue}
                className="w-full h-11 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-mono font-bold uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(34,211,238,0.4)]"
              >
                {lang === 'de' ? 'Weiter zur Auswertung' : 'Continue to result'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function StatBox({ icon, label, value, valueClass = 'text-white', big = false }) {
  return (
    <div className="rounded border border-slate-700/60 bg-slate-900/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`font-mono font-bold ${big ? 'text-base sm:text-lg' : 'text-sm'} ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}