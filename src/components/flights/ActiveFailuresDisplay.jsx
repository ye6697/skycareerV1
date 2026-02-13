import React from 'react';
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, Cog, Gauge, Plane, CircuitBoard, Shield } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

const categoryIcons = {
  engine: { icon: Cog, color: "text-red-400" },
  hydraulics: { icon: Gauge, color: "text-orange-400" },
  avionics: { icon: CircuitBoard, color: "text-blue-400" },
  airframe: { icon: Shield, color: "text-amber-400" },
  landing_gear: { icon: Plane, color: "text-purple-400" },
  electrical: { icon: Zap, color: "text-yellow-400" },
  flight_controls: { icon: Cog, color: "text-cyan-400" },
  pressurization: { icon: Shield, color: "text-pink-400" },
};

const categoryKeys = {
  engine: 'af_engine', hydraulics: 'af_hydraulics', avionics: 'af_avionics',
  airframe: 'af_airframe', landing_gear: 'af_landing_gear', electrical: 'af_electrical',
  flight_controls: 'af_flight_controls', pressurization: 'af_pressurization',
};

const severityKeys = {
  leicht: { key: 'af_minor', color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  mittel: { key: 'af_moderate', color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  schwer: { key: 'af_severe', color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function ActiveFailuresDisplay({ failures = [], compact = false }) {
  const { lang } = useLanguage();
  if (!failures || failures.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {failures.map((f, i) => {
          const sev = severityKeys[f.severity] || severityKeys.leicht;
          return (
            <Badge key={i} className={`${sev.color} text-xs`}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              {f.name}
            </Badge>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-red-300 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        {t('af_active_failures', lang)} ({failures.length})
      </h4>
      <div className="space-y-1.5">
        {failures.map((f, i) => {
          const catConf = categoryIcons[f.category] || categoryIcons.airframe;
          const sev = severityKeys[f.severity] || severityKeys.leicht;
          const Icon = catConf.icon;
          const catKey = categoryKeys[f.category] || 'af_airframe';
          return (
            <div key={i} className="flex items-center justify-between p-2 bg-slate-900/80 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${catConf.color}`} />
                <span className="text-sm text-slate-200">{f.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{t(catKey, lang)}</span>
                <Badge className={`${sev.color} text-xs`}>{t(sev.key, lang)}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}