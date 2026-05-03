import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plane, MapPin, ArrowRight, GraduationCap, Play, Target,
  Users, Package, DollarSign, AlertTriangle, Award, Activity,
} from "lucide-react";

// Detect type-rating training contracts via the __TR__:Model marker stored
// in the briefing field by the TypeRatings flow.
function getTrModelName(contract) {
  const m = String(contract?.briefing || "").match(/__TR__:(.+)/);
  return m ? m[1].trim() : null;
}

export default function ActiveFlightCard({
  contract,
  flight = null,
  lang = "en",
  onPrepare,
  onCancel,
  isCancelling = false,
}) {
  const trModelName = getTrModelName(contract);
  const isTr = !!trModelName;
  const isInProgress = contract.status === "in_progress";
  const distance = Number(contract.distance_nm || 0);
  const payout = Number(contract.payout || 0);

  // Visual theme: TR = amber/training, normal = cyan/operations.
  const theme = isTr
    ? {
        accent: "amber",
        gradient: "from-amber-950/40 via-slate-900 to-slate-900",
        border: "border-amber-500/40",
        glow: "shadow-[0_0_25px_rgba(245,158,11,0.15)]",
        topBar: "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600",
        iconBg: "bg-amber-500/15 border-amber-500/40",
        iconColor: "text-amber-300",
        icon: GraduationCap,
        labelText: lang === "de" ? "Type-Rating Training" : "Type-Rating Training",
        labelColor: "text-amber-300",
        priceColor: "text-amber-300",
      }
    : {
        accent: "cyan",
        gradient: "from-cyan-950/30 via-slate-900 to-slate-900",
        border: isInProgress ? "border-blue-500/50" : "border-cyan-500/40",
        glow: isInProgress ? "shadow-[0_0_25px_rgba(59,130,246,0.18)]" : "shadow-[0_0_15px_rgba(34,211,238,0.10)]",
        topBar: isInProgress
          ? "bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-pulse"
          : "bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500",
        iconBg: "bg-cyan-500/15 border-cyan-500/40",
        iconColor: "text-cyan-300",
        icon: Plane,
        labelText: lang === "de" ? "Auftrag" : "Contract",
        labelColor: "text-cyan-400",
        priceColor: "text-emerald-400",
      };

  const Icon = theme.icon;
  const statusBadge = isInProgress ? (
    <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono uppercase tracking-wider">
      <Activity className="w-3 h-3 mr-1 animate-pulse" />
      {lang === "de" ? "Im Flug" : "In Flight"}
    </Badge>
  ) : isTr ? (
    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono uppercase tracking-wider">
      <GraduationCap className="w-3 h-3 mr-1" />
      {lang === "de" ? "Training" : "Training"}
    </Badge>
  ) : (
    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono uppercase tracking-wider">
      <Target className="w-3 h-3 mr-1" />
      {lang === "de" ? "Bereit" : "Ready"}
    </Badge>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.25 }}
    >
      <Card
        className={`relative overflow-hidden bg-gradient-to-br ${theme.gradient} border ${theme.border} ${theme.glow} backdrop-blur-sm`}
      >
        {/* Top accent bar */}
        <div className={`h-0.5 ${theme.topBar}`} />

        {/* Decorative corner glow for TR */}
        {isTr && (
          <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
        )}

        <div className="p-4 sm:p-5">
          {/* Header row */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg border ${theme.iconBg} flex items-center justify-center`}
            >
              <Icon className={`w-5 h-5 ${theme.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`text-[9px] font-mono uppercase tracking-[0.22em] ${theme.labelColor}`}
                >
                  {theme.labelText}
                </span>
                {statusBadge}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white truncate leading-tight">
                {contract.title}
              </h3>
              {isTr && (
                <p className="text-xs text-amber-300/80 font-mono mt-0.5 truncate">
                  <Plane className="w-3 h-3 inline mr-1" />
                  {trModelName}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-lg sm:text-xl font-bold font-mono ${theme.priceColor}`}>
                ${payout.toLocaleString()}
              </p>
              {contract.bonus_potential > 0 && (
                <p className="text-[10px] font-mono text-amber-400">
                  +${Number(contract.bonus_potential).toLocaleString()} {lang === "de" ? "Bonus" : "bonus"}
                </p>
              )}
            </div>
          </div>

          {/* Route + metrics */}
          <div className="rounded-md bg-slate-950/50 border border-slate-800/60 px-3 py-2 mb-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-mono">
              <span className="flex items-center gap-1 text-slate-200 font-semibold">
                <MapPin className="w-3 h-3 text-cyan-400" />
                {contract.departure_airport}
              </span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="flex items-center gap-1 text-slate-200 font-semibold">
                <MapPin className="w-3 h-3 text-cyan-400" />
                {contract.arrival_airport}
              </span>
              <span className="text-slate-600 ml-auto">|</span>
              <span className="text-slate-400 text-[11px]">{distance} NM</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-slate-400">
              {contract.passenger_count > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {contract.passenger_count} PAX
                </span>
              )}
              {contract.cargo_weight_kg > 0 && (
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {contract.cargo_weight_kg} kg
                </span>
              )}
              {contract.difficulty && (
                <span className="flex items-center gap-1 capitalize">
                  <Award className="w-3 h-3" />
                  {contract.difficulty}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              variant="outline"
              size="sm"
              className="h-8 text-[11px] font-mono uppercase border-red-900/50 bg-red-950/30 text-red-300 hover:bg-red-900/50 hover:text-red-200"
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {isCancelling
                ? lang === "de" ? "Storniere..." : "Cancelling..."
                : lang === "de" ? "Stornieren" : "Cancel"}
            </Button>
            {isInProgress ? (
              <Link to={createPageUrl(`FlightTracker?contractId=${contract.id}`)}>
                <Button
                  size="sm"
                  className="h-8 text-[11px] font-mono uppercase bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  <Plane className="w-3 h-3 mr-1" />
                  {lang === "de" ? "Verfolgen" : "Track"}
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={onPrepare}
                className={`h-8 text-[11px] font-mono uppercase font-bold shadow-md ${
                  isTr
                    ? "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-500/30"
                    : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/30"
                }`}
              >
                <Play className="w-3 h-3 mr-1" />
                {isTr
                  ? lang === "de" ? "Training starten" : "Start training"
                  : lang === "de" ? "Vorbereiten" : "Prepare"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}