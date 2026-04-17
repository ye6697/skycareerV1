import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaneTakeoff, PlaneLanding, Target, RefreshCw, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";
import {
  RUNWAY_QUALITY_COLOR,
  RUNWAY_QUALITY_LABEL,
} from "@/components/flights/runwayAccuracy";

function MetricRow({ icon: Icon, title, accuracy, lang }) {
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

  const labelMap = RUNWAY_QUALITY_LABEL[lang] || RUNWAY_QUALITY_LABEL.en;
  const qualityKey = accuracy.qualityKey || "acceptable";
  const colorClass = RUNWAY_QUALITY_COLOR[qualityKey] || "text-slate-300";
  const qualityLabel = labelMap[qualityKey] || qualityKey;
  const scoreDelta = Number(accuracy.scoreDelta || 0);
  const cashDelta = Number(accuracy.cashDelta || 0);
  const scoreSign = scoreDelta > 0 ? "+" : "";
  const cashSign = cashDelta > 0 ? "+" : cashDelta < 0 ? "-" : "";
  const cashAbs = Math.abs(cashDelta);

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
            {Number(accuracy.rmsMeters || 0).toFixed(1)} m
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-wide">Score</p>
          <p className={`font-mono font-bold ${scoreDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {scoreSign}{scoreDelta}
          </p>
        </div>
        <div>
          <p className="text-slate-500 uppercase tracking-wide">
            {lang === "de" ? "Prämie" : "Payout"}
          </p>
          <p className={`font-mono font-bold ${cashDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {cashAbs === 0 ? "0" : `${cashSign}$${cashAbs.toLocaleString()}`}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RunwayAccuracyCard({ flight }) {
  const { lang } = useLanguage();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [result, setResult] = React.useState(flight?.xplane_data?.runway_accuracy || null);
  const applied = !!flight?.xplane_data?.runway_accuracy_applied;

  // If the flight changes, re-sync local result with stored data.
  React.useEffect(() => {
    setResult(flight?.xplane_data?.runway_accuracy || null);
    setError(null);
  }, [flight?.id, flight?.xplane_data?.runway_accuracy_applied]);

  const handleCompute = async () => {
    if (!flight?.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("recomputeRunwayAccuracy", { flight_id: flight.id });
      const data = res?.data || {};
      if (data.status === "ok" || data.status === "no_data" || data.status === "no_runway") {
        // Pull latest data from DB to avoid stale payload.
        const updated = await base44.entities.Flight.filter({ id: flight.id });
        setResult(updated?.[0]?.xplane_data?.runway_accuracy || null);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const hasAny = !!(result?.takeoff || result?.landing);

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">
            {lang === "de" ? "Centerline-Genauigkeit" : "Runway Centerline Accuracy"}
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCompute}
          disabled={busy}
          className="h-7 px-2 text-[10px] font-mono uppercase border-cyan-800 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40"
        >
          {busy ? (
            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {lang === "de" ? "Berechne..." : "Computing..."}</>
          ) : (
            <><RefreshCw className="w-3 h-3 mr-1" /> {applied ? (lang === "de" ? "Neu berechnen" : "Recompute") : (lang === "de" ? "Berechnen" : "Compute")}</>
          )}
        </Button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {lang === "de"
          ? "Misst, wie genau du während des Startlaufs und der Landung die Mittellinie gehalten hast."
          : "Measures how well you held the runway centerline during takeoff roll and landing."}
      </p>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      {!applied && !busy && !hasAny && (
        <p className="text-xs text-slate-400">
          {lang === "de"
            ? 'Noch nicht berechnet. Klicke auf "Berechnen".'
            : 'Not computed yet. Click "Compute".'}
        </p>
      )}

      {applied && !hasAny && result?.unavailable_reason && (
        <div className="p-3 bg-slate-700/40 border border-slate-600/40 rounded-lg">
          <p className="text-xs text-slate-300 mb-1">
            {lang === "de"
              ? "Centerline-Genauigkeit nicht verfügbar für diesen Flug."
              : "Centerline accuracy not available for this flight."}
          </p>
          <p className="text-[11px] text-slate-500">
            {lang === "de"
              ? "Benötigt wird hochfrequente Telemetrie mit on-ground-Flag. Ältere Flüge oder Flüge ohne aktives Plugin haben diese Daten nicht. Kein Score-/Cash-Abzug angewendet."
              : "Requires high-frequency telemetry with on-ground flag. Older flights or flights without an active plugin don't have this data. No score/cash penalty applied."}
          </p>
        </div>
      )}

      {hasAny && (
        <div className="space-y-3">
          <MetricRow
            icon={PlaneTakeoff}
            title={lang === "de" ? "Startlauf" : "Takeoff Roll"}
            accuracy={result?.takeoff}
            lang={lang}
          />
          <MetricRow
            icon={PlaneLanding}
            title={lang === "de" ? "Landung" : "Landing"}
            accuracy={result?.landing}
            lang={lang}
          />
        </div>
      )}
    </Card>
  );
}