import React from 'react';
import { Card } from "@/components/ui/card";
import { Brain, Heart, Target, Zap } from "lucide-react";

const ATTR_CONFIG = [
  { key: 'nerve', label: 'Nervenstärke', icon: Brain, color: 'text-purple-400', barColor: 'bg-purple-500' },
  { key: 'passenger_handling', label: 'Passagier-Umgang', icon: Heart, color: 'text-pink-400', barColor: 'bg-pink-500' },
  { key: 'precision', label: 'Präzision', icon: Target, color: 'text-blue-400', barColor: 'bg-blue-500' },
  { key: 'efficiency', label: 'Effizienz', icon: Zap, color: 'text-amber-400', barColor: 'bg-amber-500' },
];

export default function CrewAttributes({ attributes = {} }) {
  return (
    <Card className="p-6 bg-slate-800 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5 text-purple-400" />
        Crew-Attribute
      </h3>
      <div className="space-y-3">
        {ATTR_CONFIG.map(attr => {
          const val = attributes[attr.key] || 50;
          const Icon = attr.icon;
          return (
            <div key={attr.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-300 flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${attr.color}`} />
                  {attr.label}
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
      <p className="text-[10px] text-slate-600 mt-3">Attribute verbessern sich langsam durch Flugstunden und schneller durch Training.</p>
    </Card>
  );
}