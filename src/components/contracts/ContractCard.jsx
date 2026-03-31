import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Plane,
  Package,
  Users,
  MapPin,
  Clock,
  DollarSign,
  ArrowRight,
  Star } from
"lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function ContractCard({ contract, onAccept, onView, isAccepting }) {
  const { lang } = useLanguage();
  const typeConfig = {
    passenger: { icon: Users, color: "blue", label: t('passenger', lang) },
    cargo: { icon: Package, color: "orange", label: t('cargo', lang) },
    charter: { icon: Star, color: "purple", label: t('charter', lang) },
    emergency: { icon: Clock, color: "red", label: t('priority_contract', lang) }
  };

  const difficultyConfig = {
    easy: { color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", label: lang === 'de' ? "Einfach" : "Easy" },
    medium: { color: "bg-blue-500/20 text-blue-300 border-blue-500/40", label: lang === 'de' ? "Mittel" : "Medium" },
    hard: { color: "bg-orange-500/20 text-orange-300 border-orange-500/40", label: lang === 'de' ? "Schwer" : "Hard" },
    extreme: { color: "bg-red-500/20 text-red-300 border-red-500/40", label: lang === 'de' ? "Extrem" : "Extreme" }
  };

  const config = typeConfig[contract.type] || typeConfig.passenger;
  const difficulty = difficultyConfig[contract.difficulty] || difficultyConfig.medium;
  const TypeIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}>

      <Card className="overflow-hidden bg-slate-900/90 border border-cyan-900/40 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.12)] transition-all duration-300">
        <div className={`h-1.5 bg-gradient-to-r ${
        config.color === "blue" ? "from-blue-400 to-blue-600" :
        config.color === "orange" ? "from-orange-400 to-orange-600" :
        config.color === "purple" ? "from-purple-400 to-purple-600" :
        "from-red-400 to-red-600"}`
        } />
        
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
              config.color === "blue" ? "bg-blue-100" :
              config.color === "orange" ? "bg-orange-100" :
              config.color === "purple" ? "bg-purple-100" :
              "bg-red-100"}`
              }>
                <TypeIcon className={`w-5 h-5 ${
                config.color === "blue" ? "text-blue-600" :
                config.color === "orange" ? "text-orange-600" :
                config.color === "purple" ? "text-purple-600" :
                "text-red-600"}`
                } />
              </div>
              <div>
                <h3 className="font-semibold text-cyan-100">{contract.title}</h3>
                <p className="text-sm text-cyan-500">{config.label}</p>
              </div>
            </div>
            <Badge className={`${difficulty.color} border`}>{difficulty.label}</Badge>
          </div>

          <div className="flex items-center gap-2 mb-4 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 rounded-lg border border-cyan-900/30">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-cyan-100 font-medium">{contract.departure_airport}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 rounded-lg border border-cyan-900/30">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="font-mono font-medium">{contract.arrival_airport}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <Plane className="w-4 h-4 text-slate-400" />
              <span>{contract.distance_nm?.toLocaleString() || "---"} NM</span>
            </div>
            {contract.type === "passenger" &&
            <div className="flex items-center gap-2 text-slate-300">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{contract.passenger_count} {lang === 'de' ? 'Passagiere' : 'Passengers'}</span>
              </div>
            }
            {contract.type === "cargo" &&
            <div className="flex items-center gap-2 text-slate-300">
                <Package className="w-4 h-4 text-slate-400" />
                <span>{contract.cargo_weight_kg?.toLocaleString()} kg</span>
              </div>
            }
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <div>
              <p className="text-sm text-cyan-500">{lang === 'de' ? 'Vergütung' : 'Payout'}</p>
              <p className="text-xl font-bold text-emerald-400">
                ${contract.payout?.toLocaleString()}
              </p>
              {contract.bonus_potential > 0 &&
              <p className="text-xs text-amber-400">
                  +${contract.bonus_potential?.toLocaleString()} {lang === 'de' ? 'Bonus möglich' : 'bonus possible'}
                </p>
              }
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onView?.(contract)} className="border-cyan-800 text-cyan-200 hover:bg-cyan-950/40">
                {lang === 'de' ? 'Details' : 'Details'}
              </Button>
              {contract.status === "available" &&
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => onAccept?.(contract)}
                disabled={isAccepting}>

                  {lang === 'de' ? 'Annehmen' : 'Accept'}
                </Button>
              }
            </div>
          </div>
        </div>
      </Card>
    </motion.div>);

}
