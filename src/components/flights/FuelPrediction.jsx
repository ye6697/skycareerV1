import React from "react";
import { Card } from "@/components/ui/card";
import { Fuel, PlaneLanding, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

export default function FuelPrediction({
  flightData,
  flightStartTime,
  distanceInfo,
  flight,
  existingFlight,
  aircraft = null,
  xplaneRawData = null
}) {
  const { lang } = useLanguage();
  const storedXpd = (flight || existingFlight)?.xplane_data || {};
  const xpd = { ...storedXpd, ...(xplaneRawData || {}) };
  const normalizePercentLike = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    if (n <= 1.5) return Math.max(0, Math.min(100, n * 100));
    return Math.max(0, Math.min(100, n));
  };
  const readThrustLeverPct = (point) => {
    const lever1 = normalizePercentLike(
      point?.thrust_lever1_pct ??
      point?.thrustLever1Pct ??
      point?.throttle1_pct ??
      point?.throttle1Pct ??
      point?.engine1_load_pct ??
      point?.engine1LoadPct
    );
    const lever2 = normalizePercentLike(
      point?.thrust_lever2_pct ??
      point?.thrustLever2Pct ??
      point?.throttle2_pct ??
      point?.throttle2Pct ??
      point?.engine2_load_pct ??
      point?.engine2LoadPct
    );
    const direct = normalizePercentLike(
      point?.thrust_lever_pct ??
      point?.thrustLeverPct ??
      point?.throttle_pct ??
      point?.throttlePct ??
      point?.engine_load_pct ??
      point?.engineLoadPct
    );
    if (Number.isFinite(direct)) return direct;
    if (Number.isFinite(lever1) && Number.isFinite(lever2)) return (lever1 + lever2) / 2;
    if (Number.isFinite(lever1)) return lever1;
    if (Number.isFinite(lever2)) return lever2;
    return NaN;
  };
  const toAircraftToken = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric !== 0 : fallback;
  };
  const toFiniteNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const resolveAircraftIcao = (...values) => {
    for (const value of values) {
      const s = toAircraftToken(value);
      if (!s || s === "UNKNOWN" || s === "NA" || s === "NAN") continue;
      if (/PMDG/.test(s) && /(737|738|739|700|800|900)/.test(s)) {
        if (/739|900/.test(s)) return "B739";
        if (/700/.test(s)) return "B737";
        return "B738";
      }
      if (/B38M|B737MAX8|BOEING7378|B737800|737800|B738/.test(s)) return "B738";
      if (/B39M|B737MAX9|BOEING7379|B737900|737900|B739/.test(s)) return "B739";
      if (/B737|737NG|737/.test(s)) return "B737";
      if (/A20N|A320NEO|AIRBUSA320|A320/.test(s)) return "A320";
      if (/A21N|A321NEO|AIRBUSA321|A321/.test(s)) return "A321";
      if (/A19N|A319NEO|AIRBUSA319|A319/.test(s)) return "A319";
      if (/B78X|B789|BOEING7879|B787900|787900/.test(s)) return "B789";
      if (/B788|BOEING7878|B787800|787800/.test(s)) return "B788";
      if (/^[A-Z][A-Z0-9]{2,4}$/.test(s) && /\d/.test(s)) return s;
    }
    return "";
  };

  const AIRCRAFT_FUEL_BURN_KGPH = {
    B737: 2450,
    B738: 2600,
    B739: 2750,
    A319: 2350,
    A320: 2500,
    A321: 2850,
    B788: 5200,
    B789: 5600,
  };

  const CATEGORY_FUEL_BURN_KGPH = {
    small_prop: 60,
    turboprop: 260,
    regional_jet: 1300,
    narrow_body: 2500,
    wide_body: 5600,
    cargo: 3000,
  };

  const initialFuelKg = Number(xpd.initial_fuel_kg || 0);
  const currentFuelKg = Number(flightData.fuelKg || xpd.fuel_kg || xpd.last_valid_fuel_kg || 0);
  const effectiveInitialFuelKg = initialFuelKg > 0 ? initialFuelKg : currentFuelKg;
  const fuelUsedSoFar = Math.max(0, effectiveInitialFuelKg - currentFuelKg);
  const elapsedHours = flightStartTime ? (Date.now() - flightStartTime) / 3600000 : 0;
  const derivedBurnRateKgPerHour = elapsedHours > 0.08 ? (fuelUsedSoFar / elapsedHours) : 0;
  const backendBurnRateKgPerHour = Number(xpd.fuel_burn_rate_kgph || 0);
  const directFlowBurnRateCandidatesKgph = [
    toFiniteNumber(xpd.fuel_flow_total_kgph),
    toFiniteNumber(xpd.fuel_flow_kgph),
    toFiniteNumber(xpd.fuel_burn_kgph),
    toFiniteNumber(xpd.fuelBurnRateKgph),
    toFiniteNumber(xpd.fuel_flow_total_lph) / 1.25,
    toFiniteNumber(xpd.fuel_flow_lph) / 1.25,
    toFiniteNumber(xpd.fuel_flow_total_pph) * 0.45359237,
    toFiniteNumber(xpd.fuel_flow_pph) * 0.45359237,
    (toFiniteNumber(xpd.engine1_fuel_flow_pph) + toFiniteNumber(xpd.engine2_fuel_flow_pph)) * 0.45359237,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const directFlowBurnRateKgPerHour = directFlowBurnRateCandidatesKgph.length > 0
    ? Math.max(...directFlowBurnRateCandidatesKgph)
    : 0;
  const aircraftBurnRateLitersPerHour = Number(aircraft?.fuel_consumption_per_hour || 0);
  const aircraftBurnRateKgPerHour = aircraftBurnRateLitersPerHour > 0 ? (aircraftBurnRateLitersPerHour / 1.25) : 0;
  const resolvedAircraftIcao = resolveAircraftIcao(
    xpd.aircraft_icao,
    xpd.aircraftIcao,
    xpd.atc_model,
    xpd.atcModel,
    xpd.atc_type,
    xpd.atcType,
    aircraft?.name,
    aircraft?.model
  );
  const mappedBurnRateKgPerHour = Number(AIRCRAFT_FUEL_BURN_KGPH[resolvedAircraftIcao] || 0);
  const categoryBurnRateKgPerHour = Number(
    CATEGORY_FUEL_BURN_KGPH[String(aircraft?.aircraft_type || aircraft?.type || "").toLowerCase()] || 0
  );
  const baselineBurnRateKgPerHour = mappedBurnRateKgPerHour > 0
    ? mappedBurnRateKgPerHour
    : (aircraftBurnRateKgPerHour > 0
        ? aircraftBurnRateKgPerHour
        : categoryBurnRateKgPerHour);
  const thrustLeverPctNow = readThrustLeverPct(xpd);
  const isOnGroundNow = parseBool(
    xpd?.on_ground ?? xpd?.onGround ?? xpd?.sim_on_ground ?? xpd?.isOnGround,
    false
  );
  const enginesRunningNow = (
    parseBool(xpd?.engines_running, false) ||
    parseBool(xpd?.engine1_running, false) ||
    parseBool(xpd?.engine2_running, false) ||
    (Number.isFinite(thrustLeverPctNow) && thrustLeverPctNow > 2)
  );
  const isJetLikeAircraft = (
    baselineBurnRateKgPerHour >= 1800 ||
    /^(B7|B78|B77|A3)/.test(resolvedAircraftIcao || "")
  );
  const thrustRatio = Number.isFinite(thrustLeverPctNow) ? Math.max(0, Math.min(1, thrustLeverPctNow / 100)) : 0;
  const modeledBurnRateKgPerHour = (baselineBurnRateKgPerHour > 0 && enginesRunningNow)
    ? baselineBurnRateKgPerHour * (0.12 + (0.88 * thrustRatio))
    : 0;
  const minGroundBurnKgPerHour = baselineBurnRateKgPerHour > 0
    ? Math.max(
        (isJetLikeAircraft && enginesRunningNow) ? 180 : 30,
        baselineBurnRateKgPerHour * (isJetLikeAircraft ? 0.08 : 0.06)
      )
    : ((isJetLikeAircraft && enginesRunningNow) ? 180 : 20);
  const minAirBurnKgPerHour = baselineBurnRateKgPerHour > 0
    ? Math.max(isJetLikeAircraft ? 550 : 80, baselineBurnRateKgPerHour * 0.2)
    : (isJetLikeAircraft ? 550 : 120);
  const minReasonableKgPerHour = isOnGroundNow ? minGroundBurnKgPerHour : minAirBurnKgPerHour;
  const maxReasonableKgPerHour = baselineBurnRateKgPerHour > 0
    ? Math.max(12000, baselineBurnRateKgPerHour * 3.5)
    : 12000;
  const isPlausibleRate = (rate) => (
    Number.isFinite(rate) &&
    rate >= minReasonableKgPerHour &&
    rate <= maxReasonableKgPerHour
  );
  const pickFirstPlausibleRate = (...rates) => rates.find((rate) => isPlausibleRate(rate)) || 0;
  const burnRateKgPerHour = isOnGroundNow
    ? pickFirstPlausibleRate(
        directFlowBurnRateKgPerHour,
        modeledBurnRateKgPerHour,
        derivedBurnRateKgPerHour,
        backendBurnRateKgPerHour,
        baselineBurnRateKgPerHour
      )
    : pickFirstPlausibleRate(
        directFlowBurnRateKgPerHour,
        backendBurnRateKgPerHour,
        derivedBurnRateKgPerHour,
        modeledBurnRateKgPerHour,
        baselineBurnRateKgPerHour
      );
  const burnRateLitersPerHour = burnRateKgPerHour > 0 ? (burnRateKgPerHour * 1.25) : 0;
  const groundSpeed = Number(flightData.speed || xpd.speed || 0) || 200;
  const remainingNm = Number(distanceInfo?.remainingNm || 0);
  const fuelPercentNow = Number(flightData.fuel || xpd.fuel_percentage || 0);

  // Estimate: cruise burn for remaining distance + descent (lower burn for the final leg).
  const descentNm = Math.min(40, remainingNm * 0.15);
  const cruiseNm = remainingNm - descentNm;
  const cruiseHours = groundSpeed > 50 ? (cruiseNm / groundSpeed) : 0;
  const descentHours = groundSpeed > 50 ? (descentNm / (groundSpeed * 0.7)) : 0;
  const fuelNeeded = (cruiseHours * burnRateKgPerHour) + (descentHours * burnRateKgPerHour * 0.6);
  const fuelAtArrival = currentFuelKg - fuelNeeded;
  const fuelAtArrivalPct = effectiveInitialFuelKg > 0 ? ((fuelAtArrival / effectiveInitialFuelKg) * 100) : 0;

  const showPrediction =
    currentFuelKg > 0 &&
    effectiveInitialFuelKg >= 1;

  const isLow = fuelAtArrival < (effectiveInitialFuelKg * 0.05);
  const isCritical = fuelAtArrival < 0;
  const color = isCritical ? "text-red-400" : isLow ? "text-amber-400" : "text-emerald-400";
  const bgColor = isCritical
    ? "bg-red-900/20 border-red-800/50"
    : isLow
      ? "bg-amber-900/20 border-amber-800/50"
      : "bg-emerald-900/20 border-emerald-800/50";

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
          <Fuel className="w-5 h-5 text-amber-400" />
          {t("fuel_title", lang)}
        </h3>
        <span className="text-amber-400 font-mono">{Math.round(Math.max(0, fuelPercentNow))}%</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-slate-800 rounded text-center">
          <p className="text-xs text-slate-400">{t("percent", lang)}</p>
          <p className="text-lg font-mono font-bold text-amber-400">
            {Math.round(Math.max(0, fuelPercentNow))}%
          </p>
        </div>
        <div className="p-2 bg-slate-800 rounded text-center">
          <p className="text-xs text-slate-400">{t("remaining", lang)}</p>
          <p className="text-lg font-mono font-bold text-amber-400">
            {Math.round(Math.max(0, currentFuelKg)).toLocaleString()} kg
          </p>
        </div>
      </div>

      {showPrediction && (
        <div className={`mt-3 p-3 rounded-lg border ${bgColor}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-mono uppercase">
              {lang === "de" ? "Prognose bei Ankunft" : "Est. at Arrival"}
            </span>
            <PlaneLanding className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-mono font-bold ${color}`}>
              {isCritical ? "! " : ""}{Math.round(Math.max(0, fuelAtArrival)).toLocaleString()} kg
            </span>
            <span className={`text-sm font-mono ${color}`}>
              {Math.round(Math.max(0, fuelAtArrivalPct))}%
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 font-mono">
            <span>BURN {Math.round(burnRateLitersPerHour)} L/h</span>
            <span>{lang === "de" ? "inkl. Descent" : "incl. descent"}</span>
          </div>
          {isCritical && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {lang === "de" ? "Treibstoff reicht nicht bis zum Ziel!" : "Fuel insufficient for destination!"}
            </div>
          )}
        </div>
      )}

      {fuelPercentNow < 3 && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {t("fuel_emergency", lang)}
        </div>
      )}
    </Card>
  );
}
