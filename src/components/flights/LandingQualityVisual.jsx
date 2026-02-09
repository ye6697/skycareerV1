import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Star, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function LandingQualityVisual({ flight, gameSettings }) {
  const landingVs = Math.abs(flight.landing_vs || 0);
  const landingGforce = Math.abs(
    flight.xplane_data?.landingGForce ?? 
    flight.xplane_data?.landing_g_force ?? 
    flight.max_g_force ?? 0
  );

  const landingType = flight.xplane_data?.landingType;
  const totalRevenue = flight.revenue || flight.xplane_data?.totalRevenue || 0;
  
  const effectiveLandingType = landingType || (() => {
    if (landingGforce <= 0) return null;
    if (landingGforce < 0.5) return 'butter';
    if (landingGforce < 1.0) return 'soft';
    if (landingGforce < 1.6) return 'acceptable';
    if (landingGforce < 2.0) return 'hard';
    return 'very_hard';
  })();
  
  const effectiveScoreChange = (() => {
    if (!effectiveLandingType) return 0;
    if (effectiveLandingType === 'butter') return 40;
    if (effectiveLandingType === 'soft') return 20;
    if (effectiveLandingType === 'acceptable') return 5;
    if (effectiveLandingType === 'hard') return -30;
    if (effectiveLandingType === 'very_hard') return -50;
    return 0;
  })();
  
  // Financial impact based on total revenue
  const effectiveFinancialImpact = (() => {
    if (!effectiveLandingType) return 0;
    if (effectiveLandingType === 'butter') return totalRevenue * 4;
    if (effectiveLandingType === 'soft') return totalRevenue * 2;
    if (effectiveLandingType === 'acceptable') return 0;
    if (effectiveLandingType === 'hard') return -(totalRevenue * 0.25);
    if (effectiveLandingType === 'very_hard') return -(totalRevenue * 0.5);
    return 0;
  })();

  // Determine landing quality ONLY based on G-force
  const getLandingQuality = () => {
    if (landingGforce < 0.5) return { type: 'butter', label: 'BUTTERWEICH!', color: 'amber', icon: Star };
    if (landingGforce < 1.0) return { type: 'soft', label: 'Weich', color: 'emerald', icon: CheckCircle2 };
    if (landingGforce < 1.6) return { type: 'acceptable', label: 'Akzeptabel', color: 'blue', icon: CheckCircle2 };
    if (landingGforce < 2.0) return { type: 'hard', label: 'Harte Landung', color: 'red', icon: AlertTriangle };
    return { type: 'very_hard', label: 'Sehr Harte Landung', color: 'red', icon: AlertTriangle };
  };

  const quality = getLandingQuality();
  const Icon = quality.icon;

  // Calculate visual indicators
  const crashThreshold = gameSettings?.crash_vs_threshold || 1000;
  const vsPercentage = Math.min((landingVs / crashThreshold) * 100, 100);
  const gforcePercentage = Math.min((landingGforce / 3) * 100, 100);

  const colorMap = {
    red: 'from-red-600 to-red-500',
    blue: 'from-blue-600 to-blue-500',
    emerald: 'from-emerald-600 to-emerald-500',
    amber: 'from-amber-600 to-amber-500'
  };

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700 overflow-hidden">
      <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
        <Icon className={`w-5 h-5 text-${quality.color}-400`} />
        Landungs-Qualität
      </h3>

      {/* Main Quality Display */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`mb-6 p-6 rounded-lg bg-gradient-to-br ${colorMap[quality.color]} text-white text-center`}
      >
        <p className="text-sm opacity-80 mb-2">Landungsqualität</p>
        <p className="text-3xl font-bold">{quality.label}</p>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Vertical Speed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 bg-slate-900 rounded-lg"
        >
          <p className="text-xs text-slate-400 mb-2">Vertikale Geschwindigkeit</p>
          <p className={`text-2xl font-bold font-mono mb-2 text-${quality.color}-400`}>
            {landingVs.toFixed(0)} ft/min
          </p>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${vsPercentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full bg-gradient-to-r ${colorMap[quality.color]} transition-all`}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
           (Vertikalgeschwindigkeit zur Referenz)
          </p>
        </motion.div>

        {/* G-Force at Landing */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 bg-slate-900 rounded-lg"
        >
          <p className="text-xs text-slate-400 mb-2">G-Kräfte beim Aufsetzen</p>
          <p className={`text-2xl font-bold font-mono mb-2 text-${
            landingGforce < 1.5 ? 'emerald' :
            landingGforce < 2.0 ? 'amber' :
            'red'
          }-400`}>
            {landingGforce.toFixed(2)}G
          </p>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${gforcePercentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full bg-gradient-to-r ${
                landingGforce < 1.5 ? 'from-emerald-600 to-emerald-500' :
                landingGforce < 2.0 ? 'from-amber-600 to-amber-500' :
                'from-red-600 to-red-500'
              }`}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Ideal: &lt;1.5G
          </p>
        </motion.div>
      </div>

      {/* Landing Quality Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="p-4 bg-slate-900 rounded-lg border border-slate-700"
      >
        <p className="text-sm font-semibold text-white mb-1">Landungsqualitäts-Analyse</p>
        <p className="text-xs text-slate-500 mb-3">Basierend auf G-Kraft beim Landen ({landingGforce.toFixed(2)} G)</p>
        
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`w-5 h-5 text-${quality.color}-400`} />
          <span className={`font-bold text-${quality.color}-400`}>{quality.label}</span>
          <span className="text-slate-500 ml-2">({landingGforce.toFixed(2)} G)</span>
        </div>

        {effectiveLandingType && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700">
            <div>
              <p className="text-xs text-slate-500 mb-1">Score-Auswirkung</p>
              <p className={`font-mono font-bold ${
                effectiveScoreChange > 0 ? 'text-emerald-400' :
                effectiveScoreChange < 0 ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {effectiveScoreChange > 0 ? '+' : ''}{effectiveScoreChange} Punkte
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Finanzielle Auswirkung</p>
              {effectiveFinancialImpact > 0 ? (
                <p className="font-mono font-bold text-emerald-400">
                  +${effectiveFinancialImpact.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                </p>
              ) : effectiveFinancialImpact < 0 ? (
                <p className="font-mono font-bold text-red-400">
                  -${Math.abs(effectiveFinancialImpact).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                </p>
              ) : (
                <p className="text-slate-400">$0</p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </Card>
  );
}