import React from "react";
import { Card } from "@/components/ui/card";
import { PlaneTakeoff, PlaneLanding, Target } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import {
  computeRunwayAccuracy,
  evaluateRunwayAccuracy,
  RUNWAY_QUALITY_COLOR,
  RUNWAY_QUALITY_LABEL,
} from "@/components/flights/runwayAccuracy";

function MetricRow({ icon: Icon, title, accuracy, basePayout, lang }) {
  if (!accuracy) {
    return (
      <div className="flex items-center justify-between p-3 bg-slate-700/40 border border-slate-600/40 rounded-lg">
        <div className="flex items-center gap-2 text-slate-400">
          <Icon className="w-4 h-4" />
          <span className="text-sm">{title}</span>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {lang === "de" ? "Keine Daten" : "No data"}
        </span>
      </div>
    );
  }

  const evalResult = evaluateRunwayAccuracy(accuracy.rmsMeters, basePayout);
  const labelMap = RUNWAY_QUALITY_LABEL[lang] || RUNWAY_QUALITY_LABEL.en;
  const colorClass = RUNWAY_QUALITY_COLOR[evalResult.qualityKey] || "text-slate-300";
  const qualityLabel = labelMap[evalResult.qualityKey] || evalResult.qualityKey;
  const scoreSign = evalResult.scoreDelta > 0 ? "+" : "";
  const cashSign = evalResult.cashDelta > 0 ? "+" : evalResult.cashDelta < 0 ? "-" : "";
  const cashAbs = Math.abs(evalResult.cashDelta);

  return (
    <div className="p-3 bg-slate-700/40 border border-slate-600/40 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <Icon className="w-4 h-4" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <span className={`text-sm font-bold ${colorClass}`}>{qualityLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-slate-500 uppercase tracking-wide">
            {lang === "de" ? "Ø Abw." : "Avg dev."}
          </p>
          <p className="font-mono font-bold text-slate-200">
            {accuracy.rmsMeters.toFixed(1)} m
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-wide">Score</p>
          <p className={`font-mono font-bold ${evalResult.scoreDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {scoreSign}{evalResult.scoreDelta}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-wide">
            {lang === "de" ? "Prämie" : "Payout"}
          </p>
          <p className={`font-mono font-bold ${evalResult.cashDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {cashAbs === 0 ? "0" : `${cashSign}$${cashAbs.toLocaleString()}`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RunwayAccuracyCard({ flight }) {
  const { lang } = useLanguage();
  const telemetryHistory = flight?.xplane_data?.telemetry_history || [];
  const basePayout = Number(flight?.xplane_data?.contract_payout || flight?.revenue || 0);

  // Prefer stored values (computed at flight completion) over recomputing.
  const stored = flight?.xplane_data?.runway_accuracy || null;
  const computed = stored || computeRunwayAccuracy(telemetryHistory);

  const hasAny = !!(computed?.takeoff || computed?.landing);
  if (!hasAny) return null;

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">
          {lang === "de" ? "Centerline-Genauigkeit" : "Runway Centerline Accuracy"}
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {lang === "de"
          ? "Misst, wie genau du während des Startlaufs und der Landung die Mittellinie gehalten hast."
          : "Measures how well you held the runway centerline during takeoff roll and landing."}
      </p>
      <div className="space-y-3">
        <MetricRow
          icon={PlaneTakeoff}
          title={lang === "de" ? "Startlauf" : "Takeoff Roll"}
          accuracy={computed?.takeoff}
          basePayout={basePayout}
          lang={lang}
        />
        <MetricRow
          icon={PlaneLanding}
          title={lang === "de" ? "Landung" : "Landing"}
          accuracy={computed?.landing}
          basePayout={basePayout}
          lang={lang}
        />
      </div>
    </Card>
  );
}