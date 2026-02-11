import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlaneTakeoff, PlaneLanding, Gauge, Droplet, Wind, Thermometer,
  AlertCircle, CheckCircle, ArrowDown, ArrowUp, Mountain
} from 'lucide-react';

// ─── Aircraft Performance Database (real-world approximations) ───
const AIRCRAFT_PROFILES = {
  small_prop: {
    label: 'Kleinflugzeug (Cessna 172 class)',
    vStallClean: 48, vStallFull: 40, flapSettings: ['0°', '10°', '20°', '30°', 'FULL'],
    typicalMTOW: 1111, // kg
    refSpeed: { v1: 55, vr: 60, v2: 65 },
    vref: 65, vapp: 70,
    todr_sea: 450, // meters at sea level, MTOW
    ldr_sea: 380,
    ceilingFt: 14000,
    takeoffFlaps: '10°', landingFlaps: 'FULL',
  },
  turboprop: {
    label: 'Turboprop (ATR 72 class)',
    vStallClean: 105, vStallFull: 89, flapSettings: ['0°', '15°', '25°', '35°'],
    typicalMTOW: 22800,
    refSpeed: { v1: 110, vr: 118, v2: 125 },
    vref: 115, vapp: 120,
    todr_sea: 1300,
    ldr_sea: 1050,
    ceilingFt: 25000,
    takeoffFlaps: '15°', landingFlaps: '35°',
  },
  regional_jet: {
    label: 'Regional Jet (CRJ/E-Jet class)',
    vStallClean: 125, vStallFull: 108, flapSettings: ['0°', '1°', '5°', '20°', '30°', '45°'],
    typicalMTOW: 38790,
    refSpeed: { v1: 130, vr: 140, v2: 148 },
    vref: 132, vapp: 137,
    todr_sea: 1700,
    ldr_sea: 1350,
    ceilingFt: 41000,
    takeoffFlaps: '5°', landingFlaps: '45°',
  },
  narrow_body: {
    label: 'Narrow Body (A320/B737 class)',
    vStallClean: 135, vStallFull: 110, flapSettings: ['0°', '1', '5', '15', '25', '30', 'FULL'],
    typicalMTOW: 79000,
    refSpeed: { v1: 140, vr: 148, v2: 155 },
    vref: 137, vapp: 142,
    todr_sea: 2100,
    ldr_sea: 1500,
    ceilingFt: 39800,
    takeoffFlaps: '1+F', landingFlaps: 'FULL',
  },
  wide_body: {
    label: 'Wide Body (A330/B777 class)',
    vStallClean: 150, vStallFull: 125, flapSettings: ['0°', '1', '5', '15', '20', '25', '30'],
    typicalMTOW: 242000,
    refSpeed: { v1: 155, vr: 165, v2: 175 },
    vref: 145, vapp: 150,
    todr_sea: 2700,
    ldr_sea: 1900,
    ceilingFt: 43100,
    takeoffFlaps: '1+F', landingFlaps: 'FULL (30°)',
  },
  cargo: {
    label: 'Cargo (B747F/C-17 class)',
    vStallClean: 155, vStallFull: 130, flapSettings: ['0°', '5', '10', '20', '25', '30'],
    typicalMTOW: 412775,
    refSpeed: { v1: 160, vr: 170, v2: 180 },
    vref: 152, vapp: 157,
    todr_sea: 3100,
    ldr_sea: 2200,
    ceilingFt: 43100,
    takeoffFlaps: '10°', landingFlaps: '30°',
  },
};

// ICAO-based flap recommendations for specific aircraft types
const ICAO_FLAP_DATA = {
  // Airbus
  'A320': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A319': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A321': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A20N': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A21N': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A318': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A330': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A332': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A333': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A340': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A350': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A359': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A380': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  'A388': { takeoff: 'CONF 1+F', landing: 'CONF FULL' },
  // Boeing 737
  'B737': { takeoff: 'Flaps 5', landing: 'Flaps 30/40' },
  'B738': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B739': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B38M': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B39M': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B736': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  // Boeing 747
  'B744': { takeoff: 'Flaps 10', landing: 'Flaps 25/30' },
  'B748': { takeoff: 'Flaps 10', landing: 'Flaps 25/30' },
  'B74S': { takeoff: 'Flaps 10', landing: 'Flaps 25' },
  // Boeing 757/767
  'B752': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B753': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B762': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B763': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  // Boeing 777/787
  'B772': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B77W': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B77L': { takeoff: 'Flaps 15', landing: 'Flaps 30' },
  'B788': { takeoff: 'Flaps 5/15', landing: 'Flaps 25/30' },
  'B789': { takeoff: 'Flaps 5/15', landing: 'Flaps 25/30' },
  'B78X': { takeoff: 'Flaps 5/15', landing: 'Flaps 25/30' },
  // Embraer
  'E170': { takeoff: 'Flaps 5', landing: 'Flaps 5/FULL' },
  'E190': { takeoff: 'Flaps 5', landing: 'Flaps 5/FULL' },
  'E195': { takeoff: 'Flaps 5', landing: 'Flaps 5/FULL' },
  'E290': { takeoff: 'Flaps 2', landing: 'Flaps FULL' },
  // CRJ
  'CRJ2': { takeoff: 'Flaps 8', landing: 'Flaps 30/45' },
  'CRJ7': { takeoff: 'Flaps 8', landing: 'Flaps 30/45' },
  'CRJ9': { takeoff: 'Flaps 8', landing: 'Flaps 30/45' },
  // Turboprops
  'AT72': { takeoff: 'Flaps 15', landing: 'Flaps 35' },
  'AT76': { takeoff: 'Flaps 15', landing: 'Flaps 35' },
  'DH8D': { takeoff: 'Flaps 5/10', landing: 'Flaps 15/35' },
  'DH8C': { takeoff: 'Flaps 5/10', landing: 'Flaps 15/35' },
  // GA / Small
  'C172': { takeoff: 'Flaps 10°', landing: 'Flaps FULL' },
  'C208': { takeoff: 'Flaps 10°/20°', landing: 'Flaps FULL' },
  'BE9L': { takeoff: 'Flaps APP', landing: 'Flaps DOWN' },
  'TBM9': { takeoff: 'Flaps T/O', landing: 'Flaps LDG' },
  'PC12': { takeoff: 'Flaps 15°', landing: 'Flaps 40°' },
  'PC24': { takeoff: 'Flaps 2', landing: 'Flaps FULL' },
  // MD
  'MD11': { takeoff: 'Slats/Flaps 15', landing: 'Flaps 35/50' },
  'MD82': { takeoff: 'Flaps 11', landing: 'Flaps 28/40' },
};

// ─── Calculation helpers ───
function calcDensityAltitude(elevationFt, tempC) {
  const isaTemp = 15 - (elevationFt / 1000) * 2;
  const tempDev = tempC - isaTemp;
  return elevationFt + (tempDev * 120);
}

function calcPressureCorrection(qnh) {
  return (1013 - qnh) * 30; // ~30 ft per hPa
}

function calcWeightFactor(actualWeight, refWeight) {
  if (!refWeight || !actualWeight) return 1;
  return actualWeight / refWeight;
}

function calcRunwayCorrection(slopePct, headwindKts) {
  let factor = 1;
  factor += (slopePct || 0) * 0.05; // 5% per % uphill
  if (headwindKts > 0) factor -= headwindKts * 0.015; // ~1.5% reduction per kt headwind
  if (headwindKts < 0) factor += Math.abs(headwindKts) * 0.025; // 2.5% increase per kt tailwind
  return Math.max(0.5, factor);
}

function calcVSpeedsAdjusted(profile, weightFactor) {
  const wf = Math.sqrt(weightFactor); // V-speeds scale with sqrt of weight ratio
  return {
    v1: Math.round(profile.refSpeed.v1 * wf),
    vr: Math.round(profile.refSpeed.vr * wf),
    v2: Math.round(profile.refSpeed.v2 * wf),
    vref: Math.round(profile.vref * wf),
    vapp: Math.round(profile.vapp * wf),
  };
}

function SpeedBlock({ label, value, unit, color, desc }) {
  return (
    <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-700">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value} <span className="text-sm">{unit}</span></p>
      <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
    </div>
  );
}

function ResultRow({ label, value, status, unit }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-mono font-bold text-sm ${
        status === 'ok' ? 'text-emerald-400' : status === 'warn' ? 'text-amber-400' : status === 'danger' ? 'text-red-400' : 'text-slate-300'
      }`}>{value} {unit}</span>
    </div>
  );
}

function getFlapRecommendation(xplaneData, profile) {
  const icao = xplaneData?.aircraft_icao?.toUpperCase()?.trim();
  if (icao && ICAO_FLAP_DATA[icao]) {
    return { takeoff: ICAO_FLAP_DATA[icao].takeoff, landing: ICAO_FLAP_DATA[icao].landing, source: icao };
  }
  return { takeoff: profile.takeoffFlaps, landing: profile.landingFlaps, source: null };
}

export default function TakeoffLandingCalculator({ aircraft, contract, xplaneData }) {
  const acType = aircraft?.type || 'narrow_body';
  const profile = AIRCRAFT_PROFILES[acType] || AIRCRAFT_PROFILES.narrow_body;
  const flapRec = getFlapRecommendation(xplaneData, profile);

  const [tab, setTab] = useState('takeoff');
  const [weight, setWeight] = useState('');
  const [tempC, setTempC] = useState('15');
  const [elevFt, setElevFt] = useState('0');
  const [qnh, setQnh] = useState('1013');
  const [wind, setWind] = useState('0');
  const [rwyLength, setRwyLength] = useState('');
  const [slopePct, setSlopePct] = useState('0');
  const [rwyCondition, setRwyCondition] = useState('dry');

  // Landing-specific
  const [ldgWeight, setLdgWeight] = useState('');
  const [ldgElevFt, setLdgElevFt] = useState('0');
  const [ldgTempC, setLdgTempC] = useState('15');
  const [ldgQnh, setLdgQnh] = useState('1013');
  const [ldgWind, setLdgWind] = useState('0');
  const [ldgRwyLength, setLdgRwyLength] = useState('');
  const [ldgSlopePct, setLdgSlopePct] = useState('0');
  const [ldgRwyCondition, setLdgRwyCondition] = useState('dry');
  
  // Track whether auto-fill has been applied
  const [autoFilled, setAutoFilled] = useState(false);
  
  // Auto-fill from X-Plane live data
  React.useEffect(() => {
    if (!xplaneData || autoFilled) return;
    const xp = xplaneData;
    let didFill = false;
    
    if (xp.total_weight_kg && xp.total_weight_kg > 0) {
      setWeight(String(Math.round(xp.total_weight_kg)));
      setLdgWeight(String(Math.round(xp.total_weight_kg * 0.85)));
      didFill = true;
    }
    if (xp.oat_c !== null && xp.oat_c !== undefined) {
      setTempC(String(Math.round(xp.oat_c)));
      setLdgTempC(String(Math.round(xp.oat_c)));
      didFill = true;
    }
    if (xp.ground_elevation_ft && xp.ground_elevation_ft > -1000) {
      setElevFt(String(Math.round(xp.ground_elevation_ft)));
      didFill = true;
    }
    if (xp.baro_setting && xp.baro_setting > 900) {
      setQnh(String(Math.round(xp.baro_setting)));
      setLdgQnh(String(Math.round(xp.baro_setting)));
      didFill = true;
    }
    if (xp.wind_speed_kts !== null && xp.wind_speed_kts !== undefined) {
      // Approximate headwind component (positive = headwind assumed)
      setWind(String(Math.round(xp.wind_speed_kts)));
      setLdgWind(String(Math.round(xp.wind_speed_kts)));
      didFill = true;
    }
    if (didFill) setAutoFilled(true);
  }, [xplaneData, autoFilled]);

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
    const wf = calcWeightFactor(w, profile.typicalMTOW);
    const rwCorr = calcRunwayCorrection(sl, hw);
    const cndFactor = conditionFactor[rwyCondition] || 1;

    // TODR = base * weight factor * density altitude factor * runway correction * condition
    const daFactor = 1 + (Math.max(0, da) / 1000) * 0.07; // ~7% per 1000ft DA
    const todr = Math.round(profile.todr_sea * wf * daFactor * rwCorr * cndFactor);

    const speeds = calcVSpeedsAdjusted(profile, wf);
    const margin = rwy - todr;
    const adequate = margin > 0;
    const marginPct = ((margin / rwy) * 100).toFixed(0);

    return { todr, da: Math.round(da), speeds, margin, adequate, marginPct, rwy, wf };
  }, [weight, tempC, elevFt, qnh, wind, rwyLength, slopePct, rwyCondition, profile]);

  const landingCalc = useMemo(() => {
    const w = parseFloat(ldgWeight) || profile.typicalMTOW * 0.85;
    const t = parseFloat(ldgTempC) || 15;
    const e = parseFloat(ldgElevFt) || 0;
    const q = parseFloat(ldgQnh) || 1013;
    const hw = parseFloat(ldgWind) || 0;
    const rwy = parseFloat(ldgRwyLength) || 3000;
    const sl = parseFloat(ldgSlopePct) || 0;

    const da = calcDensityAltitude(e + calcPressureCorrection(q), t);
    const wf = calcWeightFactor(w, profile.typicalMTOW);
    const rwCorr = calcRunwayCorrection(-sl, hw); // negative slope = downhill for landing
    const cndFactor = conditionFactor[ldgRwyCondition] || 1;

    const daFactor = 1 + (Math.max(0, da) / 1000) * 0.05;
    const ldr = Math.round(profile.ldr_sea * wf * daFactor * rwCorr * cndFactor);

    const speeds = calcVSpeedsAdjusted(profile, wf);
    const margin = rwy - ldr;
    const adequate = margin > 0;
    const marginPct = ((margin / rwy) * 100).toFixed(0);

    return { ldr, da: Math.round(da), speeds, margin, adequate, marginPct, rwy, wf };
  }, [ldgWeight, ldgTempC, ldgElevFt, ldgQnh, ldgWind, ldgRwyLength, ldgSlopePct, ldgRwyCondition, profile]);

  const InputField = ({ label, value, onChange, placeholder, unit, icon: Icon }) => (
    <div>
      <Label className="text-xs text-slate-400 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </Label>
      <div className="relative mt-1">
        <Input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-slate-900 border-slate-700 text-white text-sm pr-10"
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{unit}</span>}
      </div>
    </div>
  );

  const ConditionSelector = ({ value, onChange }) => (
    <div>
      <Label className="text-xs text-slate-400">Bahnzustand</Label>
      <div className="flex gap-1 mt-1">
        {[
          { key: 'dry', label: 'Trocken', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
          { key: 'wet', label: 'Nass', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
          { key: 'contaminated', label: 'Kontaminiert', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
        ].map(c => (
          <button key={c.key} onClick={() => onChange(c.key)}
            className={`flex-1 text-xs py-1.5 rounded border ${value === c.key ? c.color : 'bg-slate-900 text-slate-500 border-slate-700'}`}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="bg-slate-800/50 border-slate-700 overflow-hidden">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full bg-slate-900 rounded-none border-b border-slate-700 p-0 h-auto">
          <TabsTrigger value="takeoff" className="flex-1 py-3 rounded-none data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400 data-[state=active]:border-b-2 data-[state=active]:border-blue-400 gap-2">
            <PlaneTakeoff className="w-4 h-4" /> Takeoff
          </TabsTrigger>
          <TabsTrigger value="landing" className="flex-1 py-3 rounded-none data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-400 gap-2">
            <PlaneLanding className="w-4 h-4" /> Landing
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAKEOFF TAB ═══ */}
        <TabsContent value="takeoff" className="p-4 space-y-4 mt-0">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge className="bg-slate-700 text-slate-300">{profile.label}</Badge>
            {xplaneData?.aircraft_icao && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">{xplaneData.aircraft_icao}</Badge>}
            {contract && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{contract.departure_airport}</Badge>}
            {autoFilled && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Live-Daten</Badge>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InputField label="Gewicht" value={weight} onChange={setWeight} placeholder={String(profile.typicalMTOW)} unit="kg" />
            <InputField label="Temperatur" value={tempC} onChange={setTempC} placeholder="15" unit="°C" icon={Thermometer} />
            <InputField label="Platzhöhe" value={elevFt} onChange={setElevFt} placeholder="0" unit="ft" icon={Mountain} />
            <InputField label="QNH" value={qnh} onChange={setQnh} placeholder="1013" unit="hPa" />
            <InputField label="Wind (+ Gegen / - Rücken)" value={wind} onChange={setWind} placeholder="0" unit="kts" icon={Wind} />
            <InputField label="Bahnlänge" value={rwyLength} onChange={setRwyLength} placeholder="3000" unit="m" />
            <InputField label="Neigung (+ bergauf)" value={slopePct} onChange={setSlopePct} placeholder="0" unit="%" />
            <ConditionSelector value={rwyCondition} onChange={setRwyCondition} />
          </div>

          {/* V-Speeds */}
          <div>
            <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">V-Speeds</h4>
            <div className="grid grid-cols-3 gap-2">
              <SpeedBlock label="V1" value={takeoffCalc.speeds.v1} unit="kts" color="text-red-400" desc="Decision" />
              <SpeedBlock label="VR" value={takeoffCalc.speeds.vr} unit="kts" color="text-blue-400" desc="Rotate" />
              <SpeedBlock label="V2" value={takeoffCalc.speeds.v2} unit="kts" color="text-emerald-400" desc="Safety" />
            </div>
          </div>

          {/* Results */}
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-0.5">
            <ResultRow label="Density Altitude" value={takeoffCalc.da.toLocaleString()} unit="ft" status={takeoffCalc.da > 8000 ? 'danger' : takeoffCalc.da > 5000 ? 'warn' : 'ok'} />
            <ResultRow label="Startstrecke (TODR)" value={takeoffCalc.todr.toLocaleString()} unit="m" status="neutral" />
            <ResultRow label="Bahnlänge verfügbar" value={takeoffCalc.rwy.toLocaleString()} unit="m" status="neutral" />
            <ResultRow label="Marge" value={`${takeoffCalc.margin > 0 ? '+' : ''}${takeoffCalc.margin.toLocaleString()}`} unit={`m (${takeoffCalc.marginPct}%)`} status={takeoffCalc.adequate ? (parseInt(takeoffCalc.marginPct) > 20 ? 'ok' : 'warn') : 'danger'} />
          </div>

          {takeoffCalc.adequate ? (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-700/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Takeoff möglich</p>
                <p className="text-xs text-emerald-300/70">Sicherheitsmarge: {takeoffCalc.margin.toLocaleString()} m</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-700/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Bahn zu kurz!</p>
                <p className="text-xs text-red-300/70">Es fehlen {Math.abs(takeoffCalc.margin).toLocaleString()} m – Gewicht reduzieren oder Alternativflughafen nutzen.</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══ LANDING TAB ═══ */}
        <TabsContent value="landing" className="p-4 space-y-4 mt-0">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge className="bg-slate-700 text-slate-300">{profile.label}</Badge>
            {xplaneData?.aircraft_icao && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">{xplaneData.aircraft_icao}</Badge>}
            {contract && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{contract.arrival_airport}</Badge>}
            {autoFilled && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Live-Daten</Badge>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InputField label="Landegewicht" value={ldgWeight} onChange={setLdgWeight} placeholder={String(Math.round(profile.typicalMTOW * 0.85))} unit="kg" />
            <InputField label="Temperatur" value={ldgTempC} onChange={setLdgTempC} placeholder="15" unit="°C" icon={Thermometer} />
            <InputField label="Platzhöhe" value={ldgElevFt} onChange={setLdgElevFt} placeholder="0" unit="ft" icon={Mountain} />
            <InputField label="QNH" value={ldgQnh} onChange={setLdgQnh} placeholder="1013" unit="hPa" />
            <InputField label="Wind (+ Gegen / - Rücken)" value={ldgWind} onChange={setLdgWind} placeholder="0" unit="kts" icon={Wind} />
            <InputField label="Bahnlänge" value={ldgRwyLength} onChange={setLdgRwyLength} placeholder="3000" unit="m" />
            <InputField label="Neigung (+ bergauf)" value={ldgSlopePct} onChange={setLdgSlopePct} placeholder="0" unit="%" />
            <ConditionSelector value={ldgRwyCondition} onChange={setLdgRwyCondition} />
          </div>

          {/* Approach Speeds */}
          <div>
            <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Approach Speeds</h4>
            <div className="grid grid-cols-2 gap-2">
              <SpeedBlock label="Vref" value={landingCalc.speeds.vref} unit="kts" color="text-amber-400" desc="Reference" />
              <SpeedBlock label="Vapp" value={landingCalc.speeds.vapp} unit="kts" color="text-orange-400" desc="Approach" />
            </div>
          </div>

          {/* Results */}
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-0.5">
            <ResultRow label="Density Altitude" value={landingCalc.da.toLocaleString()} unit="ft" status={landingCalc.da > 8000 ? 'danger' : landingCalc.da > 5000 ? 'warn' : 'ok'} />
            <ResultRow label="Landestrecke (LDR)" value={landingCalc.ldr.toLocaleString()} unit="m" status="neutral" />
            <ResultRow label="Bahnlänge verfügbar" value={landingCalc.rwy.toLocaleString()} unit="m" status="neutral" />
            <ResultRow label="Marge" value={`${landingCalc.margin > 0 ? '+' : ''}${landingCalc.margin.toLocaleString()}`} unit={`m (${landingCalc.marginPct}%)`} status={landingCalc.adequate ? (parseInt(landingCalc.marginPct) > 20 ? 'ok' : 'warn') : 'danger'} />
          </div>

          {landingCalc.adequate ? (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-700/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Landung möglich</p>
                <p className="text-xs text-emerald-300/70">Sicherheitsmarge: {landingCalc.margin.toLocaleString()} m</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-700/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-400">Bahn zu kurz!</p>
                <p className="text-xs text-red-300/70">Es fehlen {Math.abs(landingCalc.margin).toLocaleString()} m – Fuel Dump prüfen oder Alternate nutzen.</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}