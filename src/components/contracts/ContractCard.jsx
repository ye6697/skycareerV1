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

export default function ContractCard({ contract, onAccept, onView, isAccepting }) {
  const typeConfig = {
    passenger: { icon: Users, color: "blue", label: "Passagiere" },
    cargo: { icon: Package, color: "orange", label: "Fracht" },
    charter: { icon: Star, color: "purple", label: "Charter" },
    emergency: { icon: Clock, color: "red", label: "Notfall" }
  };

  const difficultyConfig = {
    easy: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Einfach" },
    medium: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Mittel" },
    hard: { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Schwer" },
    extreme: { color: "bg-red-100 text-red-700 border-red-200", label: "Extrem" }
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

      <Card className="overflow-hidden bg-slate-800 border border-slate-700 hover:border-slate-600 hover:shadow-lg transition-all duration-300">
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
                <h3 className="font-semibold text-white">{contract.title}</h3>
                <p className="text-sm text-slate-400">{config.label}</p>
              </div>
            </div>
            <Badge className={`${difficulty.color} border`}>{difficulty.label}</Badge>
          </div>

          <div className="flex items-center gap-2 mb-4 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-lg">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-50 font-medium">{contract.departure_airport}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <div className="bg-slate-900 text-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
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
                <span>{contract.passenger_count} Passagiere</span>
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
              <p className="text-sm text-slate-400">Vergütung</p>
              <p className="text-xl font-bold text-emerald-600">
                ${contract.payout?.toLocaleString()}
              </p>
              {contract.bonus_potential > 0 &&
              <p className="text-xs text-amber-600">
                  +${contract.bonus_potential?.toLocaleString()} Bonus möglich
                </p>
              }
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onView?.(contract)}>
                Details
              </Button>
              {contract.status === "available" &&
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => onAccept?.(contract)}
                disabled={isAccepting}>

                  Annehmen
                </Button>
              }
            </div>
          </div>
        </div>
      </Card>
    </motion.div>);

}