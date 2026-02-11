import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlaneTakeoff, PlaneLanding, Gauge, Wind, Thermometer,
  AlertCircle, CheckCircle, Mountain, ChevronRight
} from 'lucide-react';

// ─── Aircraft Performance Database (real-world approximations) ───
const AIRCRAFT_PROFILES = {
  small_prop: {
    label: 'Cessna 172 class', short: 'SEP',
    vStallClean: 48, vStallFull: 40, flapSettings: ['0°', '10°', '20°', '30°', 'FULL'],
    typicalMTOW: 1111,
    refSpeed: { v1: 55, vr: 60, v2: 65 },
    vref: 65, vapp: 70,
    todr_sea: 450, ldr_sea: 380, ceilingFt: 14000,
    takeoffFlaps: '10°', landingFlaps: 'FULL',
  },
  turboprop: {
    label: 'ATR 72 class', short: 'TP',
    vStallClean: 105, vStallFull: 89, flapSettings: ['0°', '15°', '25°', '35°'],
    typicalMTOW: 22800,
    refSpeed: { v1: 110, vr: 118, v2: 125 },
    vref: 115, vapp: 120,
    todr_sea: 1300, ldr_sea: 1050, ceilingFt: 25000,
    takeoffFlaps: '15°', landingFlaps: '35°',
  },
  regional_jet: {
    label: 'CRJ/E-Jet class', short: 'RJ',
    vStallClean: 125, vStallFull: 108, flapSettings: ['0°', '1°', '5°', '20°', '30°', '45°'],
    typicalMTOW: 38790,
    refSpeed: { v1: 130, vr: 140, v2: 148 },
    vref: 132, vapp: 137,
    todr_sea: 1700, ldr_sea: 1350, ceilingFt: 41000,
    takeoffFlaps: '5°', landingFlaps: '45°',
  },
  narrow_body: {
    label: 'A320/B737 class', short: 'NB',
    vStallClean: 135, vStallFull: 110, flapSettings: ['0°', '1', '5', '15', '25', '30', 'FULL'],
    typicalMTOW: 79000,
    refSpeed: { v1: 140, vr: 148, v2: 155 },
    vref: 137, vapp: 142,
    todr_sea: 2100, ldr_sea: 1500, ceilingFt: 39800,
    takeoffFlaps: '1+F', landingFlaps: 'FULL',
  },
  wide_body: {
    label: 'A330/B777 class', short: 'WB',
    vStallClean: 150, vStallFull: 125, flapSettings: ['0°', '1', '5', '15', '20', '25', '30'],
    typicalMTOW: 242000,
    refSpeed: { v1: 155, vr: 165, v2: 175 },
    vref: 145, vapp: 150,
    todr_sea: 2700, ldr_sea: 1900, ceilingFt: 43100,
    takeoffFlaps: '1+F', landingFlaps: 'FULL (30°)',
  },
  cargo: {
    label: 'B747F/C-17 class', short: 'CARGO',
    vStallClean: 155, vStallFull: 130, flapSettings: ['0°', '5', '10', '20', '25', '30'],
    typicalMTOW: 412775,
    refSpeed: { v1: 160, vr: 170, v2: 180 },
    vref: 152, vapp: 157,
    todr_sea: 3100, ldr_sea: 2200, ceilingFt: 43100,
    takeoffFlaps: '10°', landingFlaps: '30°',
  },
};

const ICAO_FLAP_DATA = {
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
  'B737': { takeoff: 'Flaps 5', landing: 'Flaps 30/40' },
  'B738': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B739': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B38M': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B39M': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B736': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B744': { takeoff: 'Flaps 10', landing: 'Flaps 25/30' },
  'B748': { takeoff: 'Flaps 10', landing: 'Flaps 25/30' },
  'B74S': { takeoff: 'Flaps 10', landing: 'Flaps 25' },
  'B752': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B753': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B762': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B763': { takeoff: 'Flaps 5', landing: 'Flaps 30' },
  'B772': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B77W': { takeoff: 'Flaps 5/15', landing: 'Flaps 30' },
  'B77L': { takeoff: 'Flaps 15', landing: 'Flaps 30' },
  'B788': { takeoff: 'Flaps 5/15', landing: 'Flaps 25/30' },
  'B789': { takeoff: 'Flaps 5/15', landing: 'Flaps 25/30' },
  'B78X': { takeoff: 'Flaps 5/15', landing: 'Flaps 25/30' },
  'E170': { takeoff: 'Flaps 5', landing: 'Flaps 5/FULL' },
  'E190': { takeoff: 'Flaps 5', landing: 'Flaps 5/FULL' },
  'E195': { takeoff: 'Flaps 5', landing: 'Flaps 5/FULL' },
  'E290': { takeoff: 'Flaps 2', landing: 'Flaps FULL' },
  'CRJ2': { takeoff: 'Flaps 8', landing: 'Flaps 30/45' },
  'CRJ7': { takeoff: 'Flaps 8', landing: 'Flaps 30/45' },
  'CRJ9': { takeoff: 'Flaps 8', landing: 'Flaps 30/45' },
  'AT72': { takeoff: 'Flaps 15', landing: 'Flaps 35' },
  'AT76': { takeoff: 'Flaps 15', landing: 'Flaps 35' },
  'DH8D': { takeoff: 'Flaps 5/10', landing: 'Flaps 15/35' },
  'DH8C': { takeoff: 'Flaps 5/10', landing: 'Flaps 15/35' },
  'C172': { takeoff: 'Flaps 10°', landing: 'Flaps FULL' },
  'C208': { takeoff: 'Flaps 10°/20°', landing: 'Flaps FULL' },
  'BE9L': { takeoff: 'Flaps APP', landing: 'Flaps DOWN' },
  'TBM9': { takeoff: 'Flaps T/O', landing: 'Flaps LDG' },
  'PC12': { takeoff: 'Flaps 15°', landing: 'Flaps 40°' },
  'PC24': { takeoff: 'Flaps 2', landing: 'Flaps FULL' },
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
  return (1013 - qnh) * 30;
}

function calcWeightFactor(actualWeight, refWeight) {
  if (!refWeight || !actualWeight) return 1;
  return actualWeight / refWeight;
}

function calcRunwayCorrection(slopePct, headwindKts) {
  let factor = 1;
  factor += (slopePct || 0) * 0.05;
  if (headwindKts > 0) factor -= headwindKts * 0.015;
  if (headwindKts < 0) factor += Math.abs(headwindKts) * 0.025;
  return Math.max(0.5, factor);
}

function calcVSpeedsAdjusted(profile, weightFactor) {
  const wf = Math.sqrt(weightFactor);
  return {
    v1: Math.round(profile.refSpeed.v1 * wf),
    vr: Math.round(profile.refSpeed.vr * wf),
    v2: Math.round(profile.refSpeed.v2 * wf),
    vref: Math.round(profile.vref * wf),
    vapp: Math.round(profile.vapp * wf),
  };
}

function getFlapRecommendation(xplaneData, profile) {
  const icao = xplaneData?.aircraft_icao?.toUpperCase()?.trim();
  if (icao && ICAO_FLAP_DATA[icao]) {
    return { takeoff: ICAO_FLAP_DATA[icao].takeoff, landing: ICAO_FLAP_DATA[icao].landing, source: icao };
  }
  return { takeoff: profile.takeoffFlaps, landing: profile.landingFlaps, source: null };
}

// ─── EFB-style sub-components ───

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
  const colors = {
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    danger: 'text-red-400',
    neutral: 'text-slate-200',
  };
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-sm font-bold tabular-nums ${colors[status] || colors.neutral}`}>
          {value}
        </span>
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
        <Input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-slate-950 border-slate-700/50 text-white text-sm font-mono h-8 pr-10 focus:border-cyan-500/50 focus:ring-cyan-500/20"
        />
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
      <div className={`flex items-center gap-2 p-2.5 rounded border ${
        isGood ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'
      }`}>
        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isGood ? 'text-emerald-400' : 'text-amber-400'}`} />
        <div>
          <p className={`text-xs font-bold ${isGood ? 'text-emerald-400' : 'text-amber-400'}`}>
            {type === 'takeoff' ? 'T/O' : 'LDG'} ADEQUATE
          </p>
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

  const [ldgWeight, setLdgWeight] = useState('');
  const [ldgElevFt, setLdgElevFt] = useState('0');
  const [ldgTempC, setLdgTempC] = useState('15');
  const [ldgQnh, setLdgQnh] = useState('1013');
  const [ldgWind, setLdgWind] = useState('0');
  const [ldgRwyLength, setLdgRwyLength] = useState('');
  const [ldgSlopePct, setLdgSlopePct] = useState('0');
  const [ldgRwyCondition, setLdgRwyCondition] = useState('dry');
  
  const [autoFilled, setAutoFilled] = useState(false);
  
  // Continuously update from X-Plane live data
  React.useEffect(() => {
    if (!xplaneData) return;
    const xp = xplaneData;
    
    // Always update live values (weight, temp, wind, qnh, elevation)
    if (xp.total_weight_kg && xp.total_weight_kg > 0) {
      setWeight(String(Math.round(xp.total_weight_kg)));
      // Estimate landing weight: current weight minus ~15% for fuel burn
      setLdgWeight(String(Math.round(xp.total_weight_kg * 0.92)));
    }
    if (xp.oat_c !== null && xp.oat_c !== undefined) {
      setTempC(String(Math.round(xp.oat_c)));
      setLdgTempC(String(Math.round(xp.oat_c)));
    }
    if (xp.ground_elevation_ft && xp.ground_elevation_ft > -1000) {
      setElevFt(String(Math.round(xp.ground_elevation_ft)));
    }
    if (xp.baro_setting && xp.baro_setting > 900) {
      setQnh(String(Math.round(xp.baro_setting)));
      setLdgQnh(String(Math.round(xp.baro_setting)));
    }
    if (xp.wind_speed_kts !== null && xp.wind_speed_kts !== undefined) {
      setWind(String(Math.round(xp.wind_speed_kts)));
      setLdgWind(String(Math.round(xp.wind_speed_kts)));
    }
    if (!autoFilled) setAutoFilled(true);
  }, [xplaneData]);

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

    const daFactor = 1 + (Math.max(0, da) / 1000) * 0.07;
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
    const rwCorr = calcRunwayCorrection(-sl, hw);
    const cndFactor = conditionFactor[ldgRwyCondition] || 1;

    const daFactor = 1 + (Math.max(0, da) / 1000) * 0.05;
    const ldr = Math.round(profile.ldr_sea * wf * daFactor * rwCorr * cndFactor);

    const speeds = calcVSpeedsAdjusted(profile, wf);
    const margin = rwy - ldr;
    const adequate = margin > 0;
    const marginPct = ((margin / rwy) * 100).toFixed(0);

    return { ldr, da: Math.round(da), speeds, margin, adequate, marginPct, rwy, wf };
  }, [ldgWeight, ldgTempC, ldgElevFt, ldgQnh, ldgWind, ldgRwyLength, ldgSlopePct, ldgRwyCondition, profile]);

  return (
    <Card className="bg-slate-950 border-slate-800 overflow-hidden shadow-2xl">
      {/* EFB Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] font-bold text-cyan-400 tracking-widest">PERF CALCULATOR</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {xplaneData?.aircraft_icao && (
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] font-mono px-2 py-0.5">
              {xplaneData.aircraft_icao}
            </Badge>
          )}
          {aircraft?.name && (
            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] px-2 py-0.5">
              {aircraft.name} ({aircraft.registration || profile.short})
            </Badge>
          )}
          {autoFilled && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
              LIVE DATA
            </Badge>
          )}
        </div>
      </div>

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
          {/* Airport Info */}
          {contract && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 rounded border border-slate-800">
              <span className="text-lg font-mono font-black text-white">{contract.departure_airport}</span>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-500 uppercase">{contract.departure_city || 'DEPARTURE'}</span>
            </div>
          )}

          {/* Input Grid */}
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

          {/* Flap Config */}
          <div className="flex items-center gap-3 px-3 py-2 bg-cyan-500/5 border border-cyan-500/10 rounded">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">FLAPS T/O</span>
            <span className="text-sm font-mono font-black text-cyan-400">{flapRec.takeoff}</span>
            {flapRec.source && <span className="text-[10px] text-slate-600 ml-auto">SRC: {flapRec.source}</span>}
          </div>

          {/* V-Speeds */}
          <div className="bg-slate-900/60 rounded border border-slate-800 p-3">
            <div className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mb-2">V-SPEEDS</div>
            <div className="grid grid-cols-3 gap-4">
              <VSpeedTape label="V1" value={takeoffCalc.speeds.v1} color="bg-red-400/80" />
              <VSpeedTape label="VR" value={takeoffCalc.speeds.vr} color="bg-cyan-400/80" />
              <VSpeedTape label="V2" value={takeoffCalc.speeds.v2} color="bg-emerald-400/80" />
            </div>
          </div>

          {/* Results */}
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
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-500 uppercase">{contract.arrival_city || 'ARRIVAL'}</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ParamInput label="LDG WT" value={ldgWeight} onChange={setLdgWeight} placeholder={String(Math.round(profile.typicalMTOW * 0.85))} unit="KG" />
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
            <span className="text-sm font-mono font-black text-amber-400">{flapRec.landing}</span>
            {flapRec.source && <span className="text-[10px] text-slate-600 ml-auto">SRC: {flapRec.source}</span>}
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