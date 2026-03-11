import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Loader2, PlaneTakeoff, PlaneLanding, Download, RefreshCw, CheckCircle, AlertCircle, Plane, Wind, Thermometer } from 'lucide-react';
import { useLanguage } from "@/components/LanguageContext";

function DataRow({ label, value, unit, highlight }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
      <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-sm font-bold tabular-nums ${highlight ? 'text-cyan-300' : 'text-slate-200'}`}>{value ?? '—'}</span>
        {unit && <span className="text-[10px] text-slate-600">{unit}</span>}
      </div>
    </div>
  );
}

function VSpeedCard({ label, value, color, sub }) {
  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-lg border ${color} min-w-0`}>
      <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{label}</span>
      <span className={`text-3xl font-mono font-black tabular-nums mt-0.5 ${color.includes('cyan') ? 'text-cyan-300' : color.includes('emerald') ? 'text-emerald-300' : color.includes('amber') ? 'text-amber-300' : color.includes('orange') ? 'text-orange-300' : 'text-red-300'}`}>
        {value ?? '—'}
      </span>
      {sub && <span className="text-[9px] text-slate-600 mt-0.5">{sub}</span>}
    </div>
  );
}

export default function TakeoffLandingCalculator({ simbriefData, xplaneData }) {
  const { lang } = useLanguage();

  const [simData, setSimData] = useState(null); // raw data from X-Plane/MSFS
  const [simLoading, setSimLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const calcRef = useRef(false);

  // Use xplaneData prop if available (from parent), else fetch
  const loadFromSim = useCallback(async () => {
    setSimLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getSimData', {});
      const d = res?.data;
      if (d && !d.error) {
        // Normalize the data through our normalizer to catch any alias fields
        const normalized = normalizeSimData(d);
        setSimData(normalized || d);
      } else {
        setError(lang === 'de' ? (d?.error || 'Keine Sim-Verbindung. X-Plane/MSFS verbinden.') : (d?.error || 'No sim connection. Connect X-Plane/MSFS first.'));
      }
    } catch (e) {
      setError(lang === 'de' ? 'Keine Sim-Verbindung. Bitte Plugin starten.' : 'No sim connection. Please start the plugin.');
    }
    setSimLoading(false);
  }, [lang]);

  // Normalize raw sim data from any simulator (X-Plane 12, MSFS 2020/2024)
  const normalizeSimData = (raw) => {
    if (!raw) return null;
    const pick = (...vals) => { for (const v of vals) { if (v !== undefined && v !== null && v !== '') return v; } return null; };

    // Weight: try kg first, then convert from lbs
    let total_weight_kg = pick(raw.total_weight_kg, raw.gross_weight_kg, raw.weight_kg);
    if (!total_weight_kg) {
      const lbs = pick(raw.total_weight_lbs, raw.gross_weight_lbs, raw.weight_lbs, raw.total_weight_pounds, raw.gross_weight_pounds);
      if (lbs) total_weight_kg = lbs * 0.453592;
    }

    // Temperature
    const oat_c = pick(raw.oat_c, raw.oat, raw.outside_air_temp_c, raw.temperature_c, raw.ambient_temperature, raw.outside_temperature, raw.temperature, raw.ambient_temp_c);

    // QNH/Baro
    let baro_setting = pick(raw.baro_setting, raw.qnh, raw.altimeter_setting, raw.baro, raw.baro_hpa);
    if (!baro_setting) {
      const inHg = pick(raw.kohlsman_setting_hg, raw.altimeter_setting_hg, raw.baro_setting_inhg);
      if (inHg) baro_setting = inHg * 33.8639;
    }

    // Wind
    let wind_speed_kts = pick(raw.wind_speed_kts, raw.wind_speed, raw.windspeed_kts, raw.ambient_wind_speed, raw.wind_velocity);
    if (!wind_speed_kts && raw.ambient_wind_x !== undefined && raw.ambient_wind_z !== undefined) {
      wind_speed_kts = Math.sqrt(raw.ambient_wind_x ** 2 + raw.ambient_wind_z ** 2) * 1.94384;
    }
    const wind_dir = pick(raw.wind_direction, raw.wind_dir, raw.wind_heading, raw.ambient_wind_direction, raw.wind_deg);

    return {
      ...raw,
      aircraft_icao: pick(raw.aircraft_icao),
      total_weight_kg,
      oat_c,
      baro_setting,
      wind_speed_kts,
      wind_dir,
      ground_elevation_ft: pick(raw.ground_elevation_ft, raw.elevation_ft, raw.airport_elevation_ft, raw.ground_altitude),
    };
  };

  // Use xplaneData prop directly if passed - update continuously with latest sim data
  useEffect(() => {
    if (xplaneData) {
      const normalized = normalizeSimData(xplaneData);
      if (normalized && (normalized.total_weight_kg > 0 || normalized.oat_c !== undefined || normalized.aircraft_icao)) {
        setSimData(prev => {
          // Only update if key values changed to avoid excessive re-renders
          if (!prev) return normalized;
          if (prev.aircraft_icao !== normalized.aircraft_icao ||
              Math.abs((prev.total_weight_kg || 0) - (normalized.total_weight_kg || 0)) > 50 ||
              Math.abs((prev.oat_c || 0) - (normalized.oat_c || 0)) > 1 ||
              Math.abs((prev.baro_setting || 0) - (normalized.baro_setting || 0)) > 1 ||
              Math.abs((prev.wind_speed_kts || 0) - (normalized.wind_speed_kts || 0)) > 2) {
            return normalized;
          }
          return prev;
        });
      }
    }
  }, [xplaneData]);

  const calculate = useCallback(async () => {
    if (calcRef.current) return;
    calcRef.current = true;
    setCalculating(true);
    setError(null);
    setResults(null);

    // Build context from sim + simbrief
    const sd = simData || {};
    const sb = simbriefData || {};

    const aircraftType = sd.aircraft_icao || sb.aircraft_icao || sb.raw_general?.icao_airline || 'unknown';
    const weightKg = sd.total_weight_kg || sb.tow_kg || null;
    const oatC = sd.oat_c ?? 15;
    const elevFt = sd.ground_elevation_ft ?? sd.altitude ?? 0;
    const qnh = sd.baro_setting ?? 1013;
    const windKts = sd.wind_speed_kts ?? 0;
    const windDir = sd.wind_dir ?? 0;
    const depRwyLength = sb.departure_rwy_length_m || null;
    const arrRwyLength = sb.arrival_rwy_length_m || null;
    const depRwy = sb.departure_runway || null;
    const arrRwy = sb.arrival_runway || null;
    const depAirport = sb.departure_airport || null;
    const arrAirport = sb.arrival_airport || null;
    const depElev = sb.departure_elevation_ft ?? elevFt;
    const arrElev = sb.arrival_elevation_ft ?? 0;
    const ldwKg = sb.ldw_kg || (weightKg ? Math.round(weightKg * 0.88) : null);

    const prompt = `You are an airline performance engineer. Calculate REAL V-speeds and performance data.

Aircraft type: ${aircraftType}
Takeoff weight: ${weightKg ? weightKg + ' kg' : 'estimate from aircraft MTOW'}
Landing weight: ${ldwKg ? ldwKg + ' kg' : 'estimate from aircraft MLW'}
OAT at departure: ${oatC}°C
Departure airport elevation: ${Math.round(depElev)} ft
QNH: ${qnh} hPa
Wind: ${Math.round(windKts)} kts from ${Math.round(windDir)}°
Departure runway: ${depRwy || 'unknown'}, length: ${depRwyLength ? depRwyLength + ' m' : 'unknown'}
Arrival airport: ${arrAirport || 'unknown'}, elevation: ${Math.round(arrElev)} ft
Arrival runway: ${arrRwy || 'unknown'}, length: ${arrRwyLength ? arrRwyLength + ' m' : 'unknown'}

Based on the actual aircraft performance manual (FCOM/AFM/POH), provide:
- V1, VR, V2 for the given takeoff conditions
- VREF, VAPP for landing
- Takeoff flap setting
- Landing flap setting  
- TODR (takeoff distance required in meters)
- LDR (landing distance required in meters)
- Whether runway is adequate for takeoff and landing
- Any critical warnings (overweight, hot/high airport, short runway, etc.)

Return precise values. V1 < VR < V2 always. VAPP > VREF always.`;

    const schema = {
      type: "object",
      properties: {
        aircraft_name: { type: "string" },
        // Takeoff
        v1: { type: "number" },
        vr: { type: "number" },
        v2: { type: "number" },
        takeoff_flaps: { type: "string" },
        todr_m: { type: "number" },
        tora_m: { type: "number" },
        takeoff_margin_m: { type: "number" },
        takeoff_adequate: { type: "boolean" },
        density_altitude_ft: { type: "number" },
        // Landing
        vref: { type: "number" },
        vapp: { type: "number" },
        landing_flaps: { type: "string" },
        ldr_m: { type: "number" },
        lda_m: { type: "number" },
        landing_margin_m: { type: "number" },
        landing_adequate: { type: "boolean" },
        // Weights
        tow_kg: { type: "number" },
        ldw_kg: { type: "number" },
        // Warnings
        warnings: { type: "array", items: { type: "string" } }
      },
      required: ["v1","vr","v2","takeoff_flaps","todr_m","vref","vapp","landing_flaps","ldr_m","takeoff_adequate","landing_adequate"]
    };

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: schema
    });

    if (res && res.vr) {
      // Enforce ordering
      let v1 = res.v1, vr = res.vr, v2 = res.v2;
      if (v1 >= vr) v1 = vr - 6;
      if (v2 <= vr) v2 = vr + 7;
      let vref = res.vref, vapp = res.vapp;
      if (vapp <= vref) vapp = vref + 5;

      setResults({ ...res, v1, vr, v2, vref, vapp,
        dep_airport: depAirport, dep_rwy: depRwy,
        arr_airport: arrAirport, arr_rwy: arrRwy,
        oat: oatC, wind: windKts, windDir, qnh
      });
    } else {
      setError(lang === 'de' ? 'Berechnung fehlgeschlagen. Flugzeugtyp unbekannt.' : 'Calculation failed. Aircraft type unknown.');
    }

    setCalculating(false);
    calcRef.current = false;
  }, [simData, simbriefData, lang]);

  const hasSimData = !!simData;
  const hasSimbriefData = !!simbriefData;

  return (
    <Card className="bg-slate-950 border-slate-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-bold text-amber-400 tracking-widest uppercase">EFB Performance Calculator</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasSimbriefData && (
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
              SimBrief: {simbriefData.departure_airport}→{simbriefData.arrival_airport}
              {simbriefData.tow_kg ? ` | TOW ${Math.round(simbriefData.tow_kg/1000)}t` : ''}
            </Badge>
          )}
          {hasSimData && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
              <Plane className="w-3 h-3 mr-1" />{simData.aircraft_icao || 'SIM'}
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Step 1: Load from Sim */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Step 1 — Load from Simulator</div>
          <Button
            onClick={loadFromSim}
            disabled={simLoading}
            className="w-full h-9 text-xs font-bold bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-800/60 gap-2"
          >
            {simLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : <><Download className="w-4 h-4" /> Load from X-Plane / MSFS</>}
          </Button>

          {hasSimData && simData.weight_estimated && (
            <div className="flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-700/30 rounded text-[10px] text-blue-400">
              <span>ℹ {lang === 'de'
                ? `Gewicht geschätzt aus OEW + Fuel (${simData.aircraft_icao}): ~${Math.round(simData.total_weight_kg).toLocaleString()} kg. OAT/QNH nutzt Standardwerte.`
                : `Weight estimated from OEW + Fuel (${simData.aircraft_icao}): ~${Math.round(simData.total_weight_kg).toLocaleString()} kg. OAT/QNH uses defaults.`
              }</span>
            </div>
          )}
          {hasSimData && !simData.total_weight_kg && !simData.oat_c && !simData.baro_setting && (
            <div className="flex items-start gap-2 p-2 bg-amber-900/20 border border-amber-700/30 rounded text-[10px] text-amber-400">
              <span>⚠ {lang === 'de'
                ? 'Keine Performance-Daten vom Simulator (GWT/OAT/QNH). Die Berechnung nutzt Standardwerte bzw. SimBrief-Daten falls verfügbar.'
                : 'No performance data from simulator (GWT/OAT/QNH). Calculation will use defaults or SimBrief data if available.'
              }</span>
            </div>
          )}
          {hasSimData && (
            <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-900/60 rounded-lg border border-slate-800 text-[10px] font-mono">
              <div className="flex flex-col items-center bg-slate-950 rounded p-1.5">
                <span className="text-slate-600">ACFT</span>
                <span className="text-emerald-400 font-bold">{simData.aircraft_icao || '?'}</span>
              </div>
              <div className="flex flex-col items-center bg-slate-950 rounded p-1.5">
                <span className="text-slate-600">GWT</span>
                <span className="text-cyan-300 font-bold">{simData.total_weight_kg ? Math.round(simData.total_weight_kg).toLocaleString() : '?'} kg</span>
              </div>
              <div className="flex flex-col items-center bg-slate-950 rounded p-1.5">
                <span className="text-slate-600">OAT</span>
                <span className="text-amber-300 font-bold">{simData.oat_c != null ? Math.round(simData.oat_c) : '?'}°C</span>
              </div>
              <div className="flex flex-col items-center bg-slate-950 rounded p-1.5">
                <span className="text-slate-600">QNH</span>
                <span className="text-slate-200 font-bold">{simData.baro_setting ? Math.round(simData.baro_setting) : '?'} hPa</span>
              </div>
              <div className="flex flex-col items-center bg-slate-950 rounded p-1.5">
                <span className="text-slate-600">WIND</span>
                <span className="text-slate-200 font-bold">
                  {(simData.wind_dir ?? simData.wind_direction) != null ? Math.round(simData.wind_dir ?? simData.wind_direction) : '?'}°/{simData.wind_speed_kts != null ? Math.round(simData.wind_speed_kts) : '?'}kt
                </span>
              </div>
              <div className="flex flex-col items-center bg-slate-950 rounded p-1.5">
                <span className="text-slate-600">ELEV</span>
                <span className="text-slate-200 font-bold">{simData.ground_elevation_ft ? Math.round(simData.ground_elevation_ft) : '?'} ft</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Calculate */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Step 2 — Calculate Performance</div>
          <Button
            onClick={calculate}
            disabled={calculating || (!hasSimData && !hasSimbriefData)}
            className="w-full h-10 text-xs font-bold bg-amber-900/40 text-amber-400 border border-amber-700/50 hover:bg-amber-800/60 gap-2"
          >
            {calculating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculating via AI...</>
              : <><RefreshCw className="w-4 h-4" /> Calculate V-Speeds & Performance</>
            }
          </Button>
          {!hasSimData && !hasSimbriefData && (
            <p className="text-[10px] text-slate-600 text-center">Load sim data or connect SimBrief first</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {/* Aircraft & Airport Info */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-cyan-400 font-bold">{results.aircraft_name || simData?.aircraft_icao || simbriefData?.aircraft_icao}</span>
              {results.dep_airport && <span className="text-slate-400">{results.dep_airport}{results.dep_rwy ? ` / ${results.dep_rwy}` : ''} → {results.arr_airport}{results.arr_rwy ? ` / ${results.arr_rwy}` : ''}</span>}
            </div>

            {/* Warnings */}
            {results.warnings?.length > 0 && (
              <div className="space-y-1">
                {results.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-700/30 rounded text-[10px] text-amber-400">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {w}
                  </div>
                ))}
              </div>
            )}

            {/* Weights */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-600 uppercase">TOW</span>
                <p className="text-sm font-mono font-bold text-white">{results.tow_kg ? Math.round(results.tow_kg).toLocaleString() : '—'} kg</p>
              </div>
              <div className="p-2 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-600 uppercase">LDW</span>
                <p className="text-sm font-mono font-bold text-white">{results.ldw_kg ? Math.round(results.ldw_kg).toLocaleString() : '—'} kg</p>
              </div>
            </div>

            {/* TAKEOFF V-SPEEDS */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Takeoff</span>
                <span className="text-[10px] text-slate-600 font-mono">FLAPS: {results.takeoff_flaps}</span>
                {results.takeoff_adequate
                  ? <Badge className="ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />RWY OK</Badge>
                  : <Badge className="ml-auto bg-red-500/10 text-red-400 border-red-500/20 text-[9px]"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />RWY SHORT</Badge>
                }
              </div>
              <div className="grid grid-cols-3 gap-2">
                <VSpeedCard label="V1" value={results.v1} color="bg-red-900/20 border-red-900/40" sub="Decision" />
                <VSpeedCard label="VR" value={results.vr} color="bg-cyan-900/20 border-cyan-900/40" sub="Rotation" />
                <VSpeedCard label="V2" value={results.v2} color="bg-emerald-900/20 border-emerald-900/40" sub="Safety" />
              </div>
              <div className="bg-slate-900/60 rounded border border-slate-800 p-2.5">
                <DataRow label="TODR" value={results.todr_m ? results.todr_m.toLocaleString() : '—'} unit="M" />
                {results.tora_m && <DataRow label="TORA" value={results.tora_m.toLocaleString()} unit="M" />}
                {results.takeoff_margin_m != null && <DataRow label="Margin" value={(results.takeoff_margin_m >= 0 ? '+' : '') + Math.round(results.takeoff_margin_m).toLocaleString()} unit="M" highlight />}
                <DataRow label="Density Alt" value={results.density_altitude_ft ? Math.round(results.density_altitude_ft).toLocaleString() : '—'} unit="FT" />
              </div>
            </div>

            {/* LANDING */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <PlaneLanding className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Landing</span>
                <span className="text-[10px] text-slate-600 font-mono">FLAPS: {results.landing_flaps}</span>
                {results.landing_adequate
                  ? <Badge className="ml-auto bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />RWY OK</Badge>
                  : <Badge className="ml-auto bg-red-500/10 text-red-400 border-red-500/20 text-[9px]"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />RWY SHORT</Badge>
                }
              </div>
              <div className="grid grid-cols-2 gap-2">
                <VSpeedCard label="VREF" value={results.vref} color="bg-amber-900/20 border-amber-900/40" sub="Reference" />
                <VSpeedCard label="VAPP" value={results.vapp} color="bg-orange-900/20 border-orange-900/40" sub="Approach" />
              </div>
              <div className="bg-slate-900/60 rounded border border-slate-800 p-2.5">
                <DataRow label="LDR" value={results.ldr_m ? results.ldr_m.toLocaleString() : '—'} unit="M" />
                {results.lda_m && <DataRow label="LDA" value={results.lda_m.toLocaleString()} unit="M" />}
                {results.landing_margin_m != null && <DataRow label="Margin" value={(results.landing_margin_m >= 0 ? '+' : '') + Math.round(results.landing_margin_m).toLocaleString()} unit="M" highlight />}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}