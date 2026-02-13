import React from 'react';
import { Card } from "@/components/ui/card";
import { Brain, Heart, Target, Zap } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

const ATTR_KEYS = [
  { key: 'nerve', tKey: 'nerve_strength', icon: Brain, color: 'text-purple-400', barColor: 'bg-purple-500' },
  { key: 'passenger_handling', tKey: 'passenger_handling', icon: Heart, color: 'text-pink-400', barColor: 'bg-pink-500' },
  { key: 'precision', tKey: 'precision', icon: Target, color: 'text-blue-400', barColor: 'bg-blue-500' },
  { key: 'efficiency', tKey: 'efficiency', icon: Zap, color: 'text-amber-400', barColor: 'bg-amber-500' },
];

export default function CrewAttributes({ attributes = {} }) {
  const { lang } = useLanguage();
  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5 text-purple-400" />
        {t('crew_attributes', lang)}
      </h3>
      <div className="space-y-3">
        {ATTR_KEYS.map(attr => {
          const val = attributes[attr.key] || 50;
          const Icon = attr.icon;
          return (
            <div key={attr.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-300 flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${attr.color}`} />
                  {t(attr.tKey, lang)}
                </span>
                <span className={`text-sm font-mono font-bold ${attr.color}`}>{Math.round(val)}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2">
                <div className={`h-full rounded-full ${attr.barColor} transition-all`} style={{ width: `${val}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-600 mt-3">{t('attrs_improve_hint', lang)}</p>
    </Card>
  );
}