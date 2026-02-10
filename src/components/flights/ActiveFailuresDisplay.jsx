import React from 'react';
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, Cog, Gauge, Plane, CircuitBoard, Shield } from "lucide-react";

const categoryConfig = {
  engine: { label: "Triebwerk", icon: Cog, color: "text-red-400" },
  hydraulics: { label: "Hydraulik", icon: Gauge, color: "text-orange-400" },
  avionics: { label: "Avionik", icon: CircuitBoard, color: "text-blue-400" },
  airframe: { label: "Struktur", icon: Shield, color: "text-amber-400" },
  landing_gear: { label: "Fahrwerk", icon: Plane, color: "text-purple-400" },
  electrical: { label: "Elektrik", icon: Zap, color: "text-yellow-400" },
  flight_controls: { label: "Steuerung", icon: Cog, color: "text-cyan-400" },
  pressurization: { label: "Druckkabine", icon: Shield, color: "text-pink-400" },
};

const severityConfig = {
  leicht: { label: "Leicht", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  mittel: { label: "Mittel", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  schwer: { label: "Schwer", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function ActiveFailuresDisplay({ failures = [], compact = false }) {
  if (!failures || failures.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {failures.map((f, i) => {
          const sev = severityConfig[f.severity] || severityConfig.leicht;
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
        Aktive Ausfälle ({failures.length})
      </h4>
      <div className="space-y-1.5">
        {failures.map((f, i) => {
          const cat = categoryConfig[f.category] || categoryConfig.airframe;
          const sev = severityConfig[f.severity] || severityConfig.leicht;
          const Icon = cat.icon;
          return (
            <div key={i} className="flex items-center justify-between p-2 bg-slate-900/80 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${cat.color}`} />
                <span className="text-sm text-slate-200">{f.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{cat.label}</span>
                <Badge className={`${sev.color} text-xs`}>{sev.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}