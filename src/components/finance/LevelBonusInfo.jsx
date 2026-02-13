import React from 'react';
import { Card } from "@/components/ui/card";
import { Star, TrendingUp, Info } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function LevelBonusInfo({ company }) {
  const { lang } = useLanguage();
  const level = company?.level || 1;

  // Level-up bonus formula: 1000 * 1.5^(level-1) 
  // This is the one-time bonus received when reaching each level
  const calculateLevelUpBonus = (lvl) => Math.round(1000 * Math.pow(1.5, lvl - 1));

  // Show bonuses for surrounding levels
  const bonusTable = [];
  const startLevel = Math.max(1, level - 2);
  const endLevel = Math.min(100, level + 5);
  for (let l = startLevel; l <= endLevel; l++) {
    bonusTable.push({ level: l, bonus: calculateLevelUpBonus(l), isCurrent: l === level });
  }

  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-400" />
        {t('level_up_bonus_title', lang)}
      </h3>

      <div className="space-y-4">
        <div className="p-3 bg-blue-950/30 border border-blue-700/50 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            {t('level_bonus_desc', lang)} {t('formula_label', lang)}: <span className="font-mono">$1.000 × 1,5^(Level-1)</span>
          </p>
        </div>

        {/* Bonus Table */}
        <div className="space-y-1">
          {bonusTable.map(({ level: l, bonus, isCurrent }) => (
            <div 
              key={l} 
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-mono ${
                isCurrent 
                  ? 'bg-amber-500/20 border border-amber-500/30' 
                  : l < level 
                  ? 'bg-slate-900/50 text-slate-500' 
                  : 'bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {isCurrent && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                <span className={isCurrent ? 'text-amber-400 font-bold' : l < level ? 'text-slate-500' : 'text-slate-300'}>
                  Level {l}
                </span>
                {l < level && <span className="text-[10px] text-slate-600">✓ {t('received_label', lang)}</span>}
                {isCurrent && <span className="text-[10px] text-amber-400">← {t('current_label', lang)}</span>}
              </div>
              <span className={isCurrent ? 'text-amber-400 font-bold' : l < level ? 'text-slate-500' : 'text-emerald-400'}>
                ${bonus.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-500">
            {t('next_bonus_at_label', lang)} {level + 1}: <span className="text-emerald-400 font-bold">${calculateLevelUpBonus(level + 1).toLocaleString()}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}