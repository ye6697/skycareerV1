import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Star, Wind, Gauge, ArrowDown, Disc, Target } from 'lucide-react';

const colorMap = {
  red: { bar: 'from-red-600 to-red-500', text: 'text-red-400', bg: 'bg-red-500' },
  orange: { bar: 'from-orange-600 to-orange-500', text: 'text-orange-400', bg: 'bg-orange-500' },
  amber: { bar: 'from-amber-600 to-amber-500', text: 'text-amber-400', bg: 'bg-amber-500' },
  blue: { bar: 'from-blue-600 to-blue-500', text: 'text-blue-400', bg: 'bg-blue-500' },
  emerald: { bar: 'from-emerald-600 to-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500' },
};

const metricConfig = [
  { key: 'verticalSpeed', label: 'V/S Touchdown', icon: ArrowDown, unit: 'ft/min' },
  { key: 'gForce', label: 'G-Kraft', icon: Gauge, unit: 'G' },
  { key: 'flare', label: 'Flare-Technik', icon: Target, unit: '' },
  { key: 'crosswind', label: 'Seitenwind-Korrektur', icon: Wind, unit: '' },
  { key: 'braking', label: 'Bremsverhalten', icon: Disc, unit: '' },
];

function getScoreColor(score) {
  if (score >= 80) return 'emerald';
  if (score >= 60) return 'blue';
  if (score >= 40) return 'amber';
  if (score >= 20) return 'orange';
  return 'red';
}

function MetricRow({ label, icon: Icon, score, weight, delay }) {
  const color = getScoreColor(score);
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3"
    >
      <Icon className={`w-4 h-4 ${c.text} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-slate-400 truncate">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-600 font-mono">{Math.round(weight * 100)}%</span>
            <span className={`text-sm font-bold font-mono ${c.text}`}>{score}</span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, delay: delay + 0.1 }}
            className={`h-full bg-gradient-to-r ${c.bar}`}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function AdvancedLandingScore({ landingResult }) {
  if (!landingResult) return null;

  const { totalScore, grade, gradeLabel, gradeColor, scores, weights, details } = landingResult;
  const gc = colorMap[gradeColor] || colorMap.blue;

  return (
    <Card className="p-4 bg-slate-950/80 border-slate-700 overflow-hidden">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-cyan-400">
        <Star className="w-4 h-4" />
        Erweiterte Landungsbewertung
      </h3>

      {/* Grade Display */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`mb-4 p-4 rounded-lg bg-gradient-to-br ${gc.bar} text-white text-center`}
      >
        <p className="text-xs opacity-80 mb-1">Landungsnote</p>
        <p className="text-4xl font-bold font-mono">{grade}</p>
        <p className="text-sm font-semibold mt-1">{gradeLabel}</p>
        <p className="text-2xl font-mono font-bold mt-1">{totalScore}/100</p>
      </motion.div>

      {/* Metric Breakdown */}
      <div className="space-y-3 mb-4">
        {metricConfig.map((m, i) => (
          <MetricRow
            key={m.key}
            label={m.label}
            icon={m.icon}
            score={scores[m.key]}
            weight={weights[m.key]}
            delay={0.05 * i}
          />
        ))}
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700">
        <div className="text-center">
          <p className="text-[9px] text-slate-500 uppercase">Touch V/S</p>
          <p className="text-xs font-mono font-bold text-slate-300">{details.touchdownVs.toFixed(0)} ft/min</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-500 uppercase">Touch G</p>
          <p className="text-xs font-mono font-bold text-slate-300">{details.landingGForce.toFixed(2)} G</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-500 uppercase">Crosswind</p>
          <p className="text-xs font-mono font-bold text-slate-300">{details.crosswindKts.toFixed(0)} kts</p>
        </div>
      </div>
    </Card>
  );
}