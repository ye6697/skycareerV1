import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import { Loader2, PlaneTakeoff, PlaneLanding, Wind, Thermometer, AlertCircle, CheckCircle, Mountain, ChevronRight, Download } from 'lucide-react';

// Cache fetched profiles
const profileCache = {};

const FALLBACK_PROFILE = {
  label: 'Generic', short: 'GEN',
  vStallClean: 120, vStallFull: 100,
  typicalMTOW: 70000, typicalMLW: 60000,
  v1_mtow: 135, vr_mtow: 148, v2_mtow: 157,
  vref_mlw: 130, vapp_mlw: 140,
  todr_sea: 2000, ldr_sea: 1400,
  takeoffFlaps: 'Flaps 5', landingFlaps: 'Flaps FULL',
};

// ─── Calculation helpers ───
function calcDensityAltitude(elevationFt, tempC) {
  const isaTemp = 15 - (elevationFt / 1000) * 2;
  return elevationFt + ((tempC - isaTemp) * 120);
}

function calcPressureCorrection(qnh) {
  return (1013 - qnh) * 30;
}

function calcRunwayCorrection(slopePct, headwindKts) {
  let factor = 1;
  factor += (slopePct || 0) * 0.05;
  if (headwindKts > 0) factor -= headwindKts * 0.015;
  if (headwindKts < 0) factor += Math.abs(headwindKts) * 0.025;
  return Math.max(0.5, factor);
}

/**
 * V-Speed calculation: V1, VR, V2 scale with sqrt(weight ratio) from MTOW reference.
 * The LLM provides V1/VR/V2 at MTOW. We adjust for actual weight.
 * V1 < VR < V2 must always hold. We enforce separation.
 */
function calcTakeoffSpeeds(profile, actualWeightKg) {
  const mtow = profile.typicalMTOW || 70000;
  const w = actualWeightKg || mtow;
  const ratio = Math.sqrt(w / mtow);
  
  let v1 = Math.round(profile.v1_mtow * ratio);
  let vr = Math.round(profile.vr_mtow * ratio);
  let v2 = Math.round(profile.v2_mtow * ratio);
  
  // Enforce V1 < VR < V2 with minimum 3kt separation
  if (vr <= v1) vr = v1 + 3;
  if (v2 <= vr) v2 = vr + 5;
  
  return { v1, vr, v2 };
}

function calcLandingSpeeds(profile, actualWeightKg) {
  const mlw = profile.typicalMLW || profile.typicalMTOW * 0.85;
  const w = actualWeightKg || mlw;
  const ratio = Math.sqrt(w / mlw);
  
  let vref = Math.round(profile.vref_mlw * ratio);
  let vapp = Math.round(profile.vapp_mlw * ratio);
  
  // Enforce VAPP > VREF
  if (vapp <= vref) vapp = vref + 5;
  
  return { vref, vapp };
}

// ─── EFB sub-components ───
function VSpeedTape({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1 h-8 rounded-full ${color}`} />
      <div>
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-mono font-black tabular-nums ${color.replace('bg-', 'text-').replace('/80', '')}`}>{value}</span>
          <span className="text-[10px] text-slate-600">KT</span>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value, unit, status }) {
  const colors = { ok: 'text-emerald-400', warn: 'text-amber-400', danger: 'text-red-400', neutral: 'text-slate-200' };
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-sm font-bold tabular-nums ${colors[status] || colors.neutral}`}>{value}</span>
        {unit && <span className="text-[10px] text-slate-600">{unit}</span>}
      </div>
    </div>
  );
}

function ParamInput({ label, value, onChange, placeholder, unit, icon: Icon }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3 text-slate-600" />} {label}
      </Label>
      <div className="relative">
        <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="bg-slate-950 border-slate-700/50 text-white text-sm font-mono h-8 pr-10 focus:border-cyan-500/50 focus:ring-cyan-500/20" />
        {unit && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-mono">{unit}</span>}
      </div>
    </div>
  );
}

function RwyConditionPicker({ value, onChange }) {
  const options = [
    { key: 'dry', label: 'DRY', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
    { key: 'wet', label: 'WET', color: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
    { key: 'contaminated', label: 'CONT', color: 'border-red-500/40 bg-red-500/10 text-red-400' },
  ];
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">RWY COND</Label>
      <div className="flex gap-1">
        {options.map(o => (
          <button key={o.key} onClick={() => onChange(o.key)}
            className={`flex-1 text-[10px] font-bold py-1.5 rounded border transition-all ${
              value === o.key ? o.color : 'bg-slate-950 text-slate-600 border-slate-800 hover:border-slate-600'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBar({ adequate, margin, marginPct, type }) {
  if (adequate) {
    const isGood = parseInt(marginPct) > 20;
    return (
      <div className={`flex items-center gap-2 p-2.5 rounded border ${isGood ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isGood ? 'text-emerald-400' : 'text-amber-400'}`} />
        <div>
          <p className={`text-xs font-bold ${isGood ? 'text-emerald-400' : 'text-amber-400'}`}>{type === 'takeoff' ? 'T/O' : 'LDG'} ADEQUATE</p>
          <p className="text-[10px] text-slate-500">+{margin.toLocaleString()} M MARGIN ({marginPct}%)</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-2.5 rounded border bg-red-500/5 border-red-500/20">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <div>
        <p className="text-xs font-bold text-red-400">RWY TOO SHORT</p>
        <p className="text-[10px] text-slate-500">{Math.abs(margin).toLocaleString()} M DEFICIT</p>
      </div>
    </div>
  );
}


import { useLanguage } from "@/components/LanguageContext";
import { t as tr } from "@/components/i18n/translations";

export default function TakeoffLandingCalculator({ aircraft, contract, xplaneData, simbriefData }) {
  const { lang } = useLanguage();
  const [tab, setTab] = useState('takeoff');
  const [profile, setProfile] = useState(FALLBACK_PROFILE);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSource, setProfileSource] = useState('fallback');

  // Input state
  const [weight, setWeight] = useState('');
  const [tempC, setTempC] = useState('');
  const [elevFt, setElevFt] = useState('');
  const [qnh, setQnh] = useState('');
  const [wind, setWind] = useState('');
  const [rwyLength, setRwyLength] = useState('');
  const [slopePct, setSlopePct] = useState('0');
  const [rwyCondition, setRwyCondition] = useState('dry');

  const [ldgWeight, setLdgWeight] = useState('');
  const [ldgElevFt, setLdgElevFt] = useState('');
  const [ldgTempC, setLdgTempC] = useState('');
  const [ldgQnh, setLdgQnh] = useState('');
  const [ldgWind, setLdgWind] = useState('');
  const [ldgRwyLength, setLdgRwyLength] = useState('');
  const [ldgSlopePct, setLdgSlopePct] = useState('0');
  const [ldgRwyCondition, setLdgRwyCondition] = useState('dry');

  const [autoFilled, setAutoFilled] = useState(false);
  const [simbriefFilled, setSimbriefFilled] = useState(false);

  // Auto-fill from SimBrief data if available (runway info etc.)
  useEffect(() => {
    if (!simbriefData || simbriefFilled) return;
    setSimbriefFilled(true);
    
    // SimBrief provides planned weights and runway info
    if (simbriefData.fuel_plan?.trip_fuel_kg) {
      // Estimate TOW from SimBrief if available
      const tripFuel = simbriefData.fuel_plan.trip_fuel_kg || 0;
      const reserveFuel = simbriefData.fuel_plan.reserve_fuel_kg || 0;
      // We don't have exact ZFW from SimBrief basic API, but can use as hint
    }
    
    // Set departure runway label if available
    if (simbriefData.departure_runway) {
      // Could be used to look up runway length in future
    }
    if (simbriefData.arrival_runway) {
      // Could be used to look up runway length in future
    }

    // Set cruise altitude info
    if (simbriefData.cruise_altitude) {
      // Info available for display
    }
  }, [simbriefData, simbriefFilled]);

  // ─── Autofill: only on button click, one-time ───
  const handleAutoFill = useCallback(() => {
    if (!xplaneData) return;
    const xp = xplaneData;
    if (xp.total_weight_kg && xp.total_weight_kg > 0) {
      setWeight(String(Math.round(xp.total_weight_kg)));
      setLdgWeight(String(Math.round(xp.total_weight_kg * 0.92)));
    }
    if (xp.oat_c !== null && xp.oat_c !== undefined) {
      setTempC(String(Math.round(xp.oat_c)));
      setLdgTempC(String(Math.round(xp.oat_c)));
    }
    if (xp.ground_elevation_ft && xp.ground_elevation_ft > -1000) {
      setElevFt(String(Math.round(xp.ground_elevation_ft)));
      setLdgElevFt(String(Math.round(xp.ground_elevation_ft)));
    }
    if (xp.baro_setting && xp.baro_setting > 900) {
      setQnh(String(Math.round(xp.baro_setting)));
      setLdgQnh(String(Math.round(xp.baro_setting)));
    }
    if (xp.wind_speed_kts !== null && xp.wind_speed_kts !== undefined) {
      setWind(String(Math.round(xp.wind_speed_kts)));
      setLdgWind(String(Math.round(xp.wind_speed_kts)));
    }
    // Autofill runway lengths from SimBrief data
    if (simbriefData?.departure_rwy_length_m) {
      setRwyLength(String(simbriefData.departure_rwy_length_m));
    }
    if (simbriefData?.arrival_rwy_length_m) {
      setLdgRwyLength(String(simbriefData.arrival_rwy_length_m));
    }
    setAutoFilled(true);
  }, [xplaneData, simbriefData]);

  // ─── Fetch realistic profile from LLM based on X-Plane ICAO type ───
  const fetchProfileForICAO = useCallback(async (icaoCode) => {
    if (!icaoCode || icaoCode.length < 2) return;
    const key = icaoCode.toUpperCase().trim();
    
    if (profileCache[key]) {
      setProfile(profileCache[key]);
      setProfileSource(key);
      return;
    }

    setProfileLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an aviation performance engineer with access to aircraft performance manuals. Given the X-Plane 12 aircraft ICAO type designator "${key}", provide REALISTIC performance data.

CRITICAL RULES:
1. V1, VR, V2 MUST be DIFFERENT values. V1 < VR < V2 always. Typical gaps: V1 is ~5-15kt below VR, V2 is ~7-15kt above VR.
2. VREF and VAPP must be different. VAPP = VREF + 5 to 10kt.
3. Use REAL published values from the aircraft's FCOM/POH/AFM. Not estimates.
4. All speeds in KIAS, distances in meters, weights in kg.

Examples of CORRECT V-speed relationships:
- B738 MTOW: V1=142, VR=150, V2=157
- A320 MTOW: V1=143, VR=148, V2=157  
- C172 MTOW: V1=N/A, VR=55, V2=65 (for single engine: V1=VR-5)
- B789 MTOW: V1=155, VR=168, V2=176
- AT76 MTOW: V1=107, VR=113, V2=120

Return these fields:
- label: Full aircraft name
- short: ICAO code
- vStallClean: VS1 clean stall speed KIAS
- vStallFull: VS0 full flap stall speed KIAS
- typicalMTOW: Maximum Takeoff Weight kg
- typicalMLW: Maximum Landing Weight kg
- v1_mtow: V1 decision speed at MTOW sea level ISA (MUST be less than vr_mtow)
- vr_mtow: VR rotation speed at MTOW sea level ISA (MUST be between v1 and v2)
- v2_mtow: V2 takeoff safety speed at MTOW sea level ISA (MUST be greater than vr_mtow)
- vref_mlw: VREF at MLW (approach reference speed)
- vapp_mlw: VAPP at MLW (VREF + additive, MUST be > vref_mlw)
- todr_sea: Takeoff Distance Required at MTOW, sea level, ISA, dry runway (meters)
- ldr_sea: Landing Distance Required at MLW, sea level, ISA, dry runway (meters)
- takeoffFlaps: Recommended takeoff flap setting (e.g. "CONF 1+F", "Flaps 5", "Flaps 10°")
- landingFlaps: Recommended landing flap setting (e.g. "CONF FULL", "Flaps 30", "Flaps FULL")`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          label: { type: "string" },
          short: { type: "string" },
          vStallClean: { type: "number" },
          vStallFull: { type: "number" },
          typicalMTOW: { type: "number" },
          typicalMLW: { type: "number" },
          v1_mtow: { type: "number", description: "V1 at MTOW, MUST be less than vr_mtow" },
          vr_mtow: { type: "number", description: "VR at MTOW, MUST be between v1 and v2" },
          v2_mtow: { type: "number", description: "V2 at MTOW, MUST be greater than vr_mtow" },
          vref_mlw: { type: "number", description: "VREF at MLW" },
          vapp_mlw: { type: "number", description: "VAPP at MLW, must be > vref_mlw" },
          todr_sea: { type: "number" },
          ldr_sea: { type: "number" },
          takeoffFlaps: { type: "string" },
          landingFlaps: { type: "string" }
        },
        required: ["label", "short", "vStallClean", "vStallFull", "typicalMTOW", "typicalMLW", "v1_mtow", "vr_mtow", "v2_mtow", "vref_mlw", "vapp_mlw", "todr_sea", "ldr_sea", "takeoffFlaps", "landingFlaps"]
      }
    });

    if (result && result.vr_mtow) {
      // Enforce correct ordering even if LLM messes up
      let v1 = result.v1_mtow;
      let vr = result.vr_mtow;
      let v2 = result.v2_mtow;
      if (v1 >= vr) v1 = vr - 6;
      if (v2 <= vr) v2 = vr + 7;
      
      let vref = result.vref_mlw;
      let vapp = result.vapp_mlw;
      if (vapp <= vref) vapp = vref + 5;

      const newProfile = {
        label: result.label || key,
        short: result.short || key,
        vStallClean: result.vStallClean,
        vStallFull: result.vStallFull,
        typicalMTOW: result.typicalMTOW,
        typicalMLW: result.typicalMLW || result.typicalMTOW * 0.85,
        v1_mtow: v1,
        vr_mtow: vr,
        v2_mtow: v2,
        vref_mlw: vref,
        vapp_mlw: vapp,
        todr_sea: result.todr_sea,
        ldr_sea: result.ldr_sea,
        takeoffFlaps: result.takeoffFlaps,
        landingFlaps: result.landingFlaps,
      };
      profileCache[key] = newProfile;
      setProfile(newProfile);
      setProfileSource(key);
    }
    setProfileLoading(false);
  }, []);

  // Auto-fetch profile when ICAO code arrives from X-Plane
  const lastFetchedIcao = React.useRef('');
  useEffect(() => {
    const icao = xplaneData?.aircraft_icao?.toUpperCase()?.trim();
    if (icao && icao.length >= 2 && icao !== lastFetchedIcao.current) {
      lastFetchedIcao.current = icao;
      fetchProfileForICAO(icao);
    }
  }, [xplaneData?.aircraft_icao, fetchProfileForICAO]);

  // ─── Calculations ───
  const conditionFactor = { dry: 1.0, wet: 1.15, contaminated: 1.4 };

  const takeoffCalc = useMemo(() => {
    const w = parseFloat(weight) || profile.typicalMTOW;
    const t = parseFloat(tempC) || 15;
    const e = parseFloat(elevFt) || 0;
    const q = parseFloat(qnh) || 1013;
    const hw = parseFloat(wind) || 0;
    const rwy = parseFloat(rwyLength) || 3000;
    const sl = parseFloat(slopePct) || 0;

    const da = calcDensityAltitude(e + calcPressureCorrection(q), t);
    const wf = w / (profile.typicalMTOW || 70000);
    const rwCorr = calcRunwayCorrection(sl, hw);
    const cndFactor = conditionFactor[rwyCondition] || 1;
    const daFactor = 1 + (Math.max(0, da) / 1000) * 0.07;
    const todr = Math.round(profile.todr_sea * wf * daFactor * rwCorr * cndFactor);

    const speeds = calcTakeoffSpeeds(profile, w);
    const margin = rwy - todr;
    const adequate = margin > 0;
    const marginPct = ((margin / rwy) * 100).toFixed(0);
    return { todr, da: Math.round(da), speeds, margin, adequate, marginPct, rwy };
  }, [weight, tempC, elevFt, qnh, wind, rwyLength, slopePct, rwyCondition, profile]);

  const landingCalc = useMemo(() => {
    const mlw = profile.typicalMLW || profile.typicalMTOW * 0.85;
    const w = parseFloat(ldgWeight) || mlw;
    const t = parseFloat(ldgTempC) || 15;
    const e = parseFloat(ldgElevFt) || 0;
    const q = parseFloat(ldgQnh) || 1013;
    const hw = parseFloat(ldgWind) || 0;
    const rwy = parseFloat(ldgRwyLength) || 3000;
    const sl = parseFloat(ldgSlopePct) || 0;

    const da = calcDensityAltitude(e + calcPressureCorrection(q), t);
    const wf = w / mlw;
    const rwCorr = calcRunwayCorrection(-sl, hw);
    const cndFactor = conditionFactor[ldgRwyCondition] || 1;
    const daFactor = 1 + (Math.max(0, da) / 1000) * 0.05;
    const ldr = Math.round(profile.ldr_sea * wf * daFactor * rwCorr * cndFactor);

    const speeds = calcLandingSpeeds(profile, w);
    const margin = rwy - ldr;
    const adequate = margin > 0;
    const marginPct = ((margin / rwy) * 100).toFixed(0);
    return { ldr, da: Math.round(da), speeds, margin, adequate, marginPct, rwy };
  }, [ldgWeight, ldgTempC, ldgElevFt, ldgQnh, ldgWind, ldgRwyLength, ldgSlopePct, ldgRwyCondition, profile]);

  const hasXPlaneData = xplaneData && (xplaneData.total_weight_kg > 0 || xplaneData.oat_c !== undefined);

  return (
    <Card className="bg-slate-950 border-slate-800 overflow-hidden shadow-2xl">
      {/* EFB Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] font-bold text-cyan-400 tracking-widest">{tr('perf_calculator', lang)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {profileLoading && (
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] px-2 py-0.5">
              <Loader2 className="w-3 h-3 animate-spin mr-1" /> LOADING...
            </Badge>
          )}
          {profileSource !== 'fallback' && !profileLoading && (
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] font-mono px-2 py-0.5">
              {profile.label}
            </Badge>
          )}
          {aircraft?.registration && (
            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] px-2 py-0.5">
              {aircraft.registration}
            </Badge>
          )}
        </div>
      </div>

      {/* Profile Info Strip */}
      {profileSource !== 'fallback' && (
        <div className="px-4 py-1.5 bg-slate-900/50 border-b border-slate-800/50 flex items-center gap-4 text-[10px] text-slate-500 font-mono overflow-x-auto">
          <span>MTOW <span className="text-slate-300">{(profile.typicalMTOW || 0).toLocaleString()} KG</span></span>
          <span>MLW <span className="text-slate-300">{(profile.typicalMLW || 0).toLocaleString()} KG</span></span>
          <span>VS0 <span className="text-slate-300">{profile.vStallFull} KT</span></span>
          <span>VS1 <span className="text-slate-300">{profile.vStallClean} KT</span></span>
        </div>
      )}

      {/* Autofill Button */}
      {hasXPlaneData && (
        <div className="px-4 py-2 border-b border-slate-800/50">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoFill}
            className="w-full bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 text-[11px] font-bold tracking-wider h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {autoFilled ? tr('autofill_again', lang) : tr('autofill_xplane', lang)}
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full bg-slate-900/50 rounded-none border-b border-slate-800 p-0 h-auto">
          <TabsTrigger value="takeoff" className="flex-1 py-2.5 rounded-none text-[11px] font-bold tracking-wider data-[state=active]:bg-transparent data-[state=active]:text-cyan-400 data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 data-[state=active]:shadow-none text-slate-500 gap-1.5">
            <PlaneTakeoff className="w-3.5 h-3.5" /> TAKEOFF
          </TabsTrigger>
          <TabsTrigger value="landing" className="flex-1 py-2.5 rounded-none text-[11px] font-bold tracking-wider data-[state=active]:bg-transparent data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 data-[state=active]:shadow-none text-slate-500 gap-1.5">
            <PlaneLanding className="w-3.5 h-3.5" /> LANDING
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAKEOFF TAB ═══ */}
        <TabsContent value="takeoff" className="p-4 space-y-4 mt-0">
          {contract && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 rounded border border-slate-800">
              <span className="text-lg font-mono font-black text-white">{contract.departure_airport}</span>
              {simbriefData?.departure_runway && (
                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] font-mono">RWY {simbriefData.departure_runway}</Badge>
              )}
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-500 uppercase">{contract.departure_city || 'DEPARTURE'}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ParamInput label="TOW" value={weight} onChange={setWeight} placeholder={String(profile.typicalMTOW)} unit="KG" />
            <ParamInput label="OAT" value={tempC} onChange={setTempC} placeholder="15" unit="°C" icon={Thermometer} />
            <ParamInput label="ELEV" value={elevFt} onChange={setElevFt} placeholder="0" unit="FT" icon={Mountain} />
            <ParamInput label="QNH" value={qnh} onChange={setQnh} placeholder="1013" unit="HPA" />
            <ParamInput label="WIND" value={wind} onChange={setWind} placeholder="0" unit="KT" icon={Wind} />
            <ParamInput label="RWY" value={rwyLength} onChange={setRwyLength} placeholder="3000" unit="M" />
            <ParamInput label="SLOPE" value={slopePct} onChange={setSlopePct} placeholder="0" unit="%" />
            <RwyConditionPicker value={rwyCondition} onChange={setRwyCondition} />
          </div>

          <div className="flex items-center gap-3 px-3 py-2 bg-cyan-500/5 border border-cyan-500/10 rounded">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">FLAPS T/O</span>
            <span className="text-sm font-mono font-black text-cyan-400">{profile.takeoffFlaps}</span>
          </div>

          <div className="bg-slate-900/60 rounded border border-slate-800 p-3">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-2">V-SPEEDS</div>
            <div className="grid grid-cols-3 gap-4">
              <VSpeedTape label="V1" value={takeoffCalc.speeds.v1} color="bg-red-400/80" />
              <VSpeedTape label="VR" value={takeoffCalc.speeds.vr} color="bg-cyan-400/80" />
              <VSpeedTape label="V2" value={takeoffCalc.speeds.v2} color="bg-emerald-400/80" />
            </div>
          </div>

          <div className="bg-slate-900/60 rounded border border-slate-800 p-3">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-2">PERFORMANCE</div>
            <DataRow label="Density Alt" value={takeoffCalc.da.toLocaleString()} unit="FT" status={takeoffCalc.da > 8000 ? 'danger' : takeoffCalc.da > 5000 ? 'warn' : 'ok'} />
            <DataRow label="TODR" value={takeoffCalc.todr.toLocaleString()} unit="M" status="neutral" />
            <DataRow label="TORA" value={takeoffCalc.rwy.toLocaleString()} unit="M" status="neutral" />
            <DataRow label="Margin" value={`${takeoffCalc.margin > 0 ? '+' : ''}${takeoffCalc.margin.toLocaleString()}`} unit={`M (${takeoffCalc.marginPct}%)`} status={takeoffCalc.adequate ? (parseInt(takeoffCalc.marginPct) > 20 ? 'ok' : 'warn') : 'danger'} />
          </div>

          <StatusBar adequate={takeoffCalc.adequate} margin={takeoffCalc.margin} marginPct={takeoffCalc.marginPct} type="takeoff" />
        </TabsContent>

        {/* ═══ LANDING TAB ═══ */}
        <TabsContent value="landing" className="p-4 space-y-4 mt-0">
          {contract && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 rounded border border-slate-800">
              <span className="text-lg font-mono font-black text-white">{contract.arrival_airport}</span>
              {simbriefData?.arrival_runway && (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-mono">RWY {simbriefData.arrival_runway}</Badge>
              )}
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-500 uppercase">{contract.arrival_city || 'ARRIVAL'}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ParamInput label="LDG WT" value={ldgWeight} onChange={setLdgWeight} placeholder={String(Math.round(profile.typicalMLW || profile.typicalMTOW * 0.85))} unit="KG" />
            <ParamInput label="OAT" value={ldgTempC} onChange={setLdgTempC} placeholder="15" unit="°C" icon={Thermometer} />
            <ParamInput label="ELEV" value={ldgElevFt} onChange={setLdgElevFt} placeholder="0" unit="FT" icon={Mountain} />
            <ParamInput label="QNH" value={ldgQnh} onChange={setLdgQnh} placeholder="1013" unit="HPA" />
            <ParamInput label="WIND" value={ldgWind} onChange={setLdgWind} placeholder="0" unit="KT" icon={Wind} />
            <ParamInput label="RWY" value={ldgRwyLength} onChange={setLdgRwyLength} placeholder="3000" unit="M" />
            <ParamInput label="SLOPE" value={ldgSlopePct} onChange={setLdgSlopePct} placeholder="0" unit="%" />
            <RwyConditionPicker value={ldgRwyCondition} onChange={setLdgRwyCondition} />
          </div>

          <div className="flex items-center gap-3 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">FLAPS LDG</span>
            <span className="text-sm font-mono font-black text-amber-400">{profile.landingFlaps}</span>
          </div>

          <div className="bg-slate-900/60 rounded border border-slate-800 p-3">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-2">APP SPEEDS</div>
            <div className="grid grid-cols-2 gap-4">
              <VSpeedTape label="VREF" value={landingCalc.speeds.vref} color="bg-amber-400/80" />
              <VSpeedTape label="VAPP" value={landingCalc.speeds.vapp} color="bg-orange-400/80" />
            </div>
          </div>

          <div className="bg-slate-900/60 rounded border border-slate-800 p-3">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-2">PERFORMANCE</div>
            <DataRow label="Density Alt" value={landingCalc.da.toLocaleString()} unit="FT" status={landingCalc.da > 8000 ? 'danger' : landingCalc.da > 5000 ? 'warn' : 'ok'} />
            <DataRow label="LDR" value={landingCalc.ldr.toLocaleString()} unit="M" status="neutral" />
            <DataRow label="LDA" value={landingCalc.rwy.toLocaleString()} unit="M" status="neutral" />
            <DataRow label="Margin" value={`${landingCalc.margin > 0 ? '+' : ''}${landingCalc.margin.toLocaleString()}`} unit={`M (${landingCalc.marginPct}%)`} status={landingCalc.adequate ? (parseInt(landingCalc.marginPct) > 20 ? 'ok' : 'warn') : 'danger'} />
          </div>

          <StatusBar adequate={landingCalc.adequate} margin={landingCalc.margin} marginPct={landingCalc.marginPct} type="landing" />
        </TabsContent>
      </Tabs>
    </Card>
  );
}