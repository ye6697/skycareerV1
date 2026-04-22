import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Clock3,
  MapPin,
  Package,
  Star,
  Users,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const TYPE_META = {
  passenger: {
    icon: Users,
    colorClass: "from-cyan-400 via-sky-400 to-blue-500",
  },
  cargo: {
    icon: Package,
    colorClass: "from-amber-400 via-orange-400 to-orange-600",
  },
  charter: {
    icon: Star,
    colorClass: "from-fuchsia-400 via-violet-500 to-purple-600",
  },
  emergency: {
    icon: Clock3,
    colorClass: "from-red-400 via-rose-500 to-red-700",
  },
};

function getTypeLabel(type, lang) {
  if (lang === "de") {
    if (type === "passenger") return "Passagier";
    if (type === "cargo") return "Fracht";
    if (type === "charter") return "Charter";
    if (type === "emergency") return "Notfall";
  }

  if (type === "passenger") return "Passenger";
  if (type === "cargo") return "Cargo";
  if (type === "charter") return "Charter";
  if (type === "emergency") return "Emergency";
  return "Contract";
}

function getDifficultyLabel(level, lang) {
  const de = lang === "de";
  if (level === "easy") return de ? "Einfach" : "Easy";
  if (level === "medium") return de ? "Mittel" : "Medium";
  if (level === "hard") return de ? "Schwer" : "Hard";
  if (level === "extreme") return de ? "Extrem" : "Extreme";
  return de ? "Mittel" : "Medium";
}

function getDifficultyClass(level) {
  if (level === "easy") return "border-emerald-700/40 bg-emerald-900/30 text-emerald-200";
  if (level === "medium") return "border-blue-700/40 bg-blue-900/30 text-blue-200";
  if (level === "hard") return "border-orange-700/40 bg-orange-900/30 text-orange-200";
  if (level === "extreme") return "border-rose-700/40 bg-rose-900/30 text-rose-200";
  return "border-slate-700/40 bg-slate-900/30 text-slate-200";
}

export default function ContractCard({
  contract,
  onAccept,
  onView,
  isAccepting,
  selected = false,
  onSelect,
  disabled = false,
}) {
  const { lang } = useLanguage();
  const meta = TYPE_META[contract.type] || TYPE_META.passenger;
  const Icon = meta.icon;
  const payout = Math.round(contract.payout || 0);
  const bonus = Math.round(contract.bonus_potential || 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <article
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(contract)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect?.(contract);
          }
        }}
        className={`relative overflow-hidden rounded-xl border bg-slate-950/90 p-4 text-left transition ${
          selected
            ? "border-cyan-400/70 shadow-[0_0_28px_rgba(34,211,238,.2)]"
            : "border-cyan-900/40 hover:border-cyan-700/60"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${meta.colorClass}`} />

        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-lg border border-cyan-900/50 bg-slate-900/80 p-1.5">
              <Icon className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-mono uppercase tracking-wide text-cyan-300/80">
                {getTypeLabel(contract.type, lang)}
              </p>
              <h3 className="truncate text-sm font-semibold text-cyan-100">
                {contract.title || (lang === "de" ? "Vertrag" : "Contract")}
              </h3>
            </div>
          </div>
          <Badge className={`text-[10px] font-mono uppercase ${getDifficultyClass(contract.difficulty)}`}>
            {getDifficultyLabel(contract.difficulty, lang)}
          </Badge>
        </div>

        <div className="mb-3 rounded-lg border border-cyan-900/40 bg-slate-900/70 p-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="inline-flex items-center gap-1 text-cyan-100">
              <MapPin className="h-3.5 w-3.5 text-cyan-300" />
              {contract.departure_airport || "---"}
            </span>
            <span className="text-slate-500">{"->"}</span>
            <span className="inline-flex items-center gap-1 text-amber-200">
              <MapPin className="h-3.5 w-3.5 text-amber-300" />
              {contract.arrival_airport || "---"}
            </span>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-slate-700/60 bg-slate-900/60 p-2">
            <p className="font-mono uppercase tracking-wide text-slate-400">
              {lang === "de" ? "Distanz" : "Distance"}
            </p>
            <p className="mt-0.5 font-semibold text-cyan-100">
              {(contract.distance_nm || 0).toLocaleString()} NM
            </p>
          </div>
          <div className="rounded-md border border-slate-700/60 bg-slate-900/60 p-2">
            <p className="font-mono uppercase tracking-wide text-slate-400">
              {lang === "de" ? "Nutzlast" : "Payload"}
            </p>
            <p className="mt-0.5 font-semibold text-cyan-100">
              {contract.type === "cargo"
                ? `${(contract.cargo_weight_kg || 0).toLocaleString()} kg`
                : `${contract.passenger_count || 0} ${lang === "de" ? "PAX" : "PAX"}`}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-2.5">
          <p className="text-[10px] font-mono uppercase tracking-wide text-emerald-300/80">
            {lang === "de" ? "Auszahlung" : "Payout"}
          </p>
          <p className="text-lg font-bold text-emerald-300">${payout.toLocaleString()}</p>
          {bonus > 0 && (
            <p className="text-[11px] text-amber-300">
              +${bonus.toLocaleString()} {lang === "de" ? "Bonus moeglich" : "bonus possible"}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onView?.(contract);
            }}
            className="h-8 border-cyan-800/60 bg-slate-900 text-xs font-mono uppercase text-cyan-100 hover:bg-cyan-950/30"
          >
            <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
            {lang === "de" ? "Details" : "Details"}
          </Button>

          {contract.status === "available" ? (
            <Button
              type="button"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onAccept?.(contract);
              }}
              disabled={isAccepting || disabled}
              className="h-8 bg-cyan-600 text-xs font-mono uppercase text-slate-950 hover:bg-cyan-500"
            >
              {lang === "de" ? "Annehmen" : "Accept"}
            </Button>
          ) : (
            <Badge className="border-amber-700/40 bg-amber-900/30 text-xs text-amber-200">
              {lang === "de" ? "Nicht verfuegbar" : "Unavailable"}
            </Badge>
          )}
        </div>
      </article>
    </motion.div>
  );
}
