import React from 'react';
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Star, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function ReputationGauge({ reputation = 50, level = 1 }) {
  const { lang } = useLanguage();
  const safeReputation = Math.max(0, Math.min(100, Number(reputation) || 0));

  const getReputationLabel = (rep) => {
    if (rep >= 90) return t('rep_excellent', lang);
    if (rep >= 75) return t('rep_very_good', lang);
    if (rep >= 60) return t('rep_good', lang);
    if (rep >= 40) return t('rep_average', lang);
    if (rep >= 20) return t('rep_poor', lang);
    return t('rep_critical', lang);
  };

  const getReputationColor = (rep) => {
    if (rep >= 75) return "text-emerald-500";
    if (rep >= 50) return "text-blue-500";
    if (rep >= 25) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">{t('company_reputation', lang)}</h3>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-slate-400 hover:text-white transition-colors">
                <Info className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-slate-800 border-slate-700 text-white p-4" side="bottom">
              <h4 className="text-sm font-semibold mb-2 text-blue-400">{t('rep_how_calculated', lang)}</h4>
              <ul className="text-xs text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="min-w-12 font-mono text-cyan-300">Score</span>
                  <span>{t('rep_normal_formula', lang)}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="min-w-12 font-mono text-emerald-400">+3</span>
                  <span>{t('rep_score_100', lang)}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="min-w-12 font-mono text-slate-400">0</span>
                  <span>{t('rep_score_85', lang)}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="min-w-12 font-mono text-red-400">-1</span>
                  <span>{t('rep_score_80', lang)}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="min-w-12 font-mono text-red-400">-7</span>
                  <span>{t('rep_score_50', lang)}</span>
                </li>
                <li className="flex items-start gap-2 border-t border-slate-700 pt-2">
                  <span className="min-w-12 font-mono text-red-400">-10</span>
                  <span>{t('rep_crash_wrong_airport_exact', lang)}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="min-w-12 font-mono text-red-400">-5</span>
                  <span>{t('rep_cancelled_exact', lang)}</span>
                </li>
              </ul>
              <p className="text-[10px] text-slate-400 mt-3">{t('rep_clamped', lang)}</p>
              <p className="text-[10px] text-slate-500 mt-3">{t('rep_affects', lang)}</p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 bg-amber-100 rounded-full">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span className="text-sm font-bold text-amber-700">Level {level}</span>
        </div>
      </div>

      <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safeReputation}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${
            safeReputation >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
            safeReputation >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
            safeReputation >= 25 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
            'bg-gradient-to-r from-red-400 to-red-500'
          }`}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${getReputationColor(safeReputation)}`}>
          {Math.round(safeReputation)}%
        </span>
        <span className="text-sm text-slate-400">{getReputationLabel(safeReputation)}</span>
      </div>
    </Card>
  );
}
