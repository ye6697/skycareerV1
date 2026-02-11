import React from 'react';
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Star, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function ReputationGauge({ reputation = 50, level = 1 }) {
  const getReputationLabel = (rep) => {
    if (rep >= 90) return "Exzellent";
    if (rep >= 75) return "Sehr Gut";
    if (rep >= 60) return "Gut";
    if (rep >= 40) return "Durchschnitt";
    if (rep >= 20) return "Schlecht";
    return "Kritisch";
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
          <h3 className="font-semibold text-white">Unternehmens-Reputation</h3>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-slate-400 hover:text-white transition-colors">
                <Info className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-slate-800 border-slate-700 text-white p-4" side="bottom">
              <h4 className="text-sm font-semibold mb-2 text-blue-400">Wie wird die Reputation berechnet?</h4>
              <ul className="text-xs text-slate-300 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">+</span>
                  <span><strong>Gute Landungen</strong> – Weiche/butterweiche Landungen erhöhen die Reputation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">+</span>
                  <span><strong>Erfolgreiche Flüge</strong> – Abgeschlossene Aufträge mit hohem Score</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">+</span>
                  <span><strong>Pünktlichkeit</strong> – Aufträge innerhalb der Deadline</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">−</span>
                  <span><strong>Harte Landungen</strong> & Crashes verringern die Reputation stark</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">−</span>
                  <span><strong>Abgebrochene Aufträge</strong> – Stornierungen kosten Reputation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">−</span>
                  <span><strong>Schlechter Flug-Score</strong> – G-Kräfte, Overspeed, Stall</span>
                </li>
              </ul>
              <p className="text-[10px] text-slate-500 mt-3">Reputation beeinflusst deine Kreditwürdigkeit und freigeschaltete Aufträge.</p>
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
          animate={{ width: `${reputation}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${
            reputation >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
            reputation >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
            reputation >= 25 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
            'bg-gradient-to-r from-red-400 to-red-500'
          }`}
        />
      </div>
      
      <div className="flex items-center justify-between">
        <span className={`text-2xl font-bold ${getReputationColor(reputation)}`}>
          {reputation}%
        </span>
        <span className="text-sm text-slate-400">{getReputationLabel(reputation)}</span>
      </div>
    </Card>
  );
}