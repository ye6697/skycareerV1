import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getAirportCoords } from "@/utils/airportCoordinates";
import { Plane, PlaneTakeoff, PlaneLanding, MapPin, Clock, Fuel, Gauge, ArrowUp, Star, DollarSign, CheckCircle2, AlertTriangle, Timer, Activity, Wrench, Cog, CircuitBoard, Shield, Zap, Wind, Info } from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";
import FlightCompletionAnimation from "@/components/flights/FlightCompletionAnimation";
import FlightMapIframe from "@/components/flights/FlightMapIframe";
import FuelPrediction from "@/components/flights/FuelPrediction";
import TakeoffLandingCalculator from "@/components/flights/TakeoffLandingCalculator";
import SimBriefImport from "@/components/flights/SimBriefImport";
import WeatherDisplay from "@/components/flights/WeatherDisplay";
import ActiveFailuresDisplay from "@/components/flights/ActiveFailuresDisplay";
import { generatePassengerComments } from "@/components/flights/generatePassengerComments";
import { deriveLandingMetricsFromTelemetry } from "@/components/flights/landingMetrics";
import { calculateDeadlineMinutes } from "@/components/flights/aircraftSpeedLookup";
import { buildFailuresFromEventFlags, sanitizeFailureList } from "@/components/flights/failureUtils";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calculateInsuranceForFlight, resolveAircraftInsurance } from "@/lib/insurance";
import { MAINTENANCE_CATEGORY_KEYS, calculateCategoryRepairCost, normalizeMaintenanceCategoryMap, resolvePermanentWearCategories } from "@/lib/maintenance";
import { recoverLandingBonus } from "@/components/flights/landingBonusRecovery"; import { processAchievementsAfterFlight } from "@/components/achievements/processAchievementsAfterFlight";
const ENGINE_FULL_THRUST_THRESHOLD_PCT = 98;
const ENGINE_FULL_THRUST_STEP_SECONDS = 3;
const ENGINE_PARTIAL_THRUST_STEP_SECONDS = 150;
const ENGINE_WEAR_PER_STEP = 0.1;
const ENGINE_HIGH_G_THRESHOLD = 1.6;
const ENGINE_HIGH_G_MULTIPLIER = 1.4;
const ENGINE_HARD_LANDING_G_THRESHOLD = 1.45;
const ENGINE_HARD_LANDING_G_MULTIPLIER = 1.2;
const HIGH_G_FORCE_ENGINE_EVENT_WEAR = 0.6;
const HARD_LANDING_ENGINE_EVENT_WEAR = 1.1;

const LANDING_GEAR_EXP_FACTOR = 1.25;
const LANDING_GEAR_EXP_MULTIPLIER = 5;
const AIRFRAME_HIGH_G_THRESHOLD = 1.35;
const AIRFRAME_HIGH_G_MULTIPLIER = 2.2;
const AVIONICS_HIGH_G_THRESHOLD = 1.4;
const AVIONICS_HIGH_G_MULTIPLIER = 2.8;
const AVIONICS_LANDING_G_THRESHOLD = 1.3;
const AVIONICS_LANDING_G_MULTIPLIER = 2.2;
const HYDRAULICS_LANDING_IMPACT_FACTOR = 0.35;
const ELECTRICAL_ENGINE_HEAT_PER_HOUR = 0.6;
const ELECTRICAL_CONTROL_INPUT_FACTOR = 0.15;
const FLIGHT_CONTROLS_INPUT_MULTIPLIER = 6;
const PRESSURIZATION_HIGH_ALT_PER_HOUR = 0.7;
const OVERSPEED_AIRFRAME_WEAR = 6;
const OVERSPEED_AVIONICS_WEAR = 4;
const OVERSPEED_ELECTRICAL_WEAR = 5;
const OVERSTRESS_AIRFRAME_WEAR = 6;
const HIGH_G_FORCE_AIRFRAME_EVENT_WEAR = 3;
const HIGH_G_FORCE_AVIONICS_EVENT_WEAR = 1.5;
const OVERSTRESS_MAINTENANCE_PERCENT = 1.5;
const OVERSPEED_MAINTENANCE_PERCENT = 2.2;
const FAILURE_POPUP_VISIBLE_MS = 9000;
const AUTO_FAILURE_MIN_TOTAL_WEAR_PCT = 60;
const AUTO_FAILURE_GLOBAL_COOLDOWN_MS = 4 * 60 * 1000;
const AUTO_FAILURE_CATEGORY_COOLDOWN_MS = 10 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const deterministicFailureRoll = (seed) => {
  const text = String(seed || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0) / 4294967295;
};

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
};

const readEngineLoadPct = (point) => firstFiniteNumber(
  point?.eng,
  point?.engine_load_pct,
  point?.engineLoadPct,
  point?.engine_load,
  point?.engineLoad,
);

const normalizePercentLike = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  if (n <= 1.5) return clamp(n * 100, 0, 100);
  return clamp(n, 0, 100);
};

const readThrustLeverPct = (point) => {
  const lever1 = normalizePercentLike(firstFiniteNumber(
    point?.thrust_lever1_pct,
    point?.thrustLever1Pct,
    point?.throttle1_pct,
    point?.throttle1Pct,
    point?.throttle_1_pct,
    point?.eng1_throttle_pct,
    point?.engine1_load_pct,
    point?.engine1LoadPct,
  ));
  const lever2 = normalizePercentLike(firstFiniteNumber(
    point?.thrust_lever2_pct,
    point?.thrustLever2Pct,
    point?.throttle2_pct,
    point?.throttle2Pct,
    point?.throttle_2_pct,
    point?.eng2_throttle_pct,
    point?.engine2_load_pct,
    point?.engine2LoadPct,
  ));
  const direct = normalizePercentLike(firstFiniteNumber(
    point?.thr,
    point?.thrust_lever_pct,
    point?.thrustLeverPct,
    point?.throttle_pct,
    point?.throttlePct,
    point?.throttle,
  ));
  if (Number.isFinite(direct)) return direct;
  if (Number.isFinite(lever1) && Number.isFinite(lever2)) return (lever1 + lever2) / 2;
  if (Number.isFinite(lever1)) return lever1;
  if (Number.isFinite(lever2)) return lever2;
  return normalizePercentLike(readEngineLoadPct(point));
};

const readAltitudeFt = (point) => firstFiniteNumber(
  point?.alt,
  point?.altitude,
  point?.altitude_ft,
  point?.altitudeFt,
);

const readTelemetryPointTimestampMs = (point) => {
  const iso = point?.t || point?.timestamp || point?.created_date || null;
  const ms = Date.parse(String(iso || ""));
  return Number.isFinite(ms) ? ms : NaN;
};

const filterTelemetryHistoryForSession = (telemetryHistory, sessionStartMs) => {
  const history = Array.isArray(telemetryHistory) ? telemetryHistory : [];
  if (!Number.isFinite(sessionStartMs)) return history;
  const minTs = sessionStartMs - 5000;
  return history.filter((point) => {
    const ptMs = readTelemetryPointTimestampMs(point);
    return Number.isFinite(ptMs) && ptMs >= minTs;
  });
};

const calcConditionSecondsFromTelemetry = ({
  telemetryHistory,
  predicate,
  sampleCapSeconds = 20,
  currentSampleValue,
}) => {
  const history = Array.isArray(telemetryHistory) ? telemetryHistory : [];
  if (history.length < 2) return 0;

  let seconds = 0;
  for (let i = 1; i < history.length; i += 1) {
    const prevPt = history[i - 1] || {};
    const curPt = history[i] || {};
    const prevTs = Date.parse(String(prevPt.t || ""));
    const curTs = Date.parse(String(curPt.t || ""));
    if (!Number.isFinite(prevTs) || !Number.isFinite(curTs) || curTs <= prevTs) continue;

    const dtSec = clamp((curTs - prevTs) / 1000, 0, sampleCapSeconds);
    if (dtSec <= 0) continue;

    if (predicate(curPt, prevPt)) {
      seconds += dtSec;
    }
  }

  const lastPt = history[history.length - 1] || {};
  const lastTs = Date.parse(String(lastPt.t || ""));
  if (Number.isFinite(lastTs) && Number.isFinite(currentSampleValue)) {
    const nowMs = Date.now();
    if (nowMs > lastTs) {
      const dtSec = clamp((nowMs - lastTs) / 1000, 0, sampleCapSeconds);
      if (dtSec > 0 && predicate({ value: currentSampleValue }, lastPt)) {
        seconds += dtSec;
      }
    }
  }

  return seconds;
};

const readEffectiveThrustPct = (curPt, prevPt) => {
  const curLever = firstFiniteNumber(curPt?.value, readThrustLeverPct(curPt));
  const prevLever = readThrustLeverPct(prevPt);
  return Number.isFinite(curLever) ? curLever : prevLever;
};

const calcEngineThrustProfileSeconds = (telemetryHistory, currentThrustLeverPct) => {
  const knownSeconds = calcConditionSecondsFromTelemetry({
    telemetryHistory,
    currentSampleValue: currentThrustLeverPct,
    predicate: (curPt, prevPt) => Number.isFinite(readEffectiveThrustPct(curPt, prevPt)),
  });

  if (knownSeconds <= 0) {
    return { fullSeconds: 0, knownSeconds: 0 };
  }

  const fullSeconds = calcConditionSecondsFromTelemetry({
    telemetryHistory,
    currentSampleValue: currentThrustLeverPct,
    predicate: (curPt, prevPt) => {
      const effectiveLever = readEffectiveThrustPct(curPt, prevPt);
      return Number.isFinite(effectiveLever) && effectiveLever >= ENGINE_FULL_THRUST_THRESHOLD_PCT;
    },
  });

  return {
    fullSeconds: clamp(fullSeconds, 0, knownSeconds),
    knownSeconds,
  };
};

const calcEngineWearFromThrustProfile = (fullThrustSeconds, totalFlightSeconds, knownThrustSeconds = null) => {
  const totalSeconds = Math.max(0, Number(totalFlightSeconds || 0));
  const knownSeconds = Math.max(0, Number(knownThrustSeconds ?? totalSeconds) || 0);
  const fullSeconds = clamp(Number(fullThrustSeconds || 0), 0, knownSeconds);
  const nonFullSeconds = Math.max(0, knownSeconds - fullSeconds);
  const fullSteps = Math.floor(fullSeconds / ENGINE_FULL_THRUST_STEP_SECONDS);
  const nonFullSteps = Math.floor(nonFullSeconds / ENGINE_PARTIAL_THRUST_STEP_SECONDS);
  const fullWear = fullSteps * ENGINE_WEAR_PER_STEP;
  const nonFullWear = nonFullSteps * ENGINE_WEAR_PER_STEP;
  return {
    knownSeconds,
    fullSeconds,
    nonFullSeconds,
    fullSteps,
    nonFullSteps,
    fullWear,
    nonFullWear,
    totalWear: fullWear + nonFullWear,
  };
};

const calcEngineWearFromHighG = (maxGForce) => {
  return Math.max(0, Number(maxGForce || 1) - ENGINE_HIGH_G_THRESHOLD) * ENGINE_HIGH_G_MULTIPLIER;
};

const calcEngineWearFromHardLanding = (landingGForce) => {
  return Math.max(0, Number(landingGForce || 0) - ENGINE_HARD_LANDING_G_THRESHOLD) * ENGINE_HARD_LANDING_G_MULTIPLIER;
};

const calcLandingGearWearFromLandingG = (landingGForce) => {
  const g = Math.max(0, Number(landingGForce || 0));
  if (g <= 1) return 0;
  return Math.expm1((g - 1) * LANDING_GEAR_EXP_FACTOR) * LANDING_GEAR_EXP_MULTIPLIER;
};

const calcAirframeWearFromHighG = (maxGForce) => {
  return Math.max(0, Number(maxGForce || 1) - AIRFRAME_HIGH_G_THRESHOLD) * AIRFRAME_HIGH_G_MULTIPLIER;
};

const calcAvionicsWearFromHighG = (maxGForce) => {
  return Math.max(0, Number(maxGForce || 1) - AVIONICS_HIGH_G_THRESHOLD) * AVIONICS_HIGH_G_MULTIPLIER;
};

const calcAvionicsWearFromLandingG = (landingGForce) => {
  return Math.max(0, Number(landingGForce || 0) - AVIONICS_LANDING_G_THRESHOLD) * AVIONICS_LANDING_G_MULTIPLIER;
};

const calcHydraulicsWearFromLandingImpact = (landingImpactWear) => {
  return Math.max(0, Number(landingImpactWear || 0)) * HYDRAULICS_LANDING_IMPACT_FACTOR;
};

const calcElectricalWearFromEngineHighLoadSeconds = (highLoadSeconds) => {
  return (Math.max(0, Number(highLoadSeconds || 0)) / 3600) * ELECTRICAL_ENGINE_HEAT_PER_HOUR;
};

const calcElectricalWearFromControlInput = (maxControlInput) => {
  return clamp(Number(maxControlInput || 0), 0, 1) * ELECTRICAL_CONTROL_INPUT_FACTOR;
};

const calcFlightControlsWearFromControlInput = (maxControlInput) => {
  return clamp(Number(maxControlInput || 0), 0, 1) * FLIGHT_CONTROLS_INPUT_MULTIPLIER;
};

const calcPressurizationWearFromHighAltSeconds = (highAltitudeSeconds) => {
  return (Math.max(0, Number(highAltitudeSeconds || 0)) / 3600) * PRESSURIZATION_HIGH_ALT_PER_HOUR;
};

export default function FlightTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const resolveUserCompanyId = React.useCallback((user) => (
    user?.company_id
    || user?.data?.company_id
    || user?.company?.id
    || user?.data?.company?.id
    || null
  ), []);

  const [flightPhase, setFlightPhase] = useState('preflight');
  const [viewMode, setViewMode] = useState('fplan');
  const [flight, setFlight] = useState(null);
  const [flightStartTime, setFlightStartTime] = useState(null);
  const [flightDurationSeconds, setFlightDurationSeconds] = useState(0);
  const [processedGLevels, setProcessedGLevels] = useState(new Set());
  const [isCompletingFlight, setIsCompletingFlight] = useState(false);
  const [showAutoCompleteOverlay, setShowAutoCompleteOverlay] = useState(false);
  const [completedFlightForAnim, setCompletedFlightForAnim] = useState(null);
  const [flightStartedAt, setFlightStartedAt] = useState(null);
  const [emergencyLanding, setEmergencyLanding] = useState(false);
  const [engineHighLoadSecondsLive, setEngineHighLoadSecondsLive] = useState(0);
  const [engineKnownThrustSecondsLive, setEngineKnownThrustSecondsLive] = useState(0);
  const [highAltitudeSecondsLive, setHighAltitudeSecondsLive] = useState(0);
  const flightDataRef = React.useRef(null);
  const autoCompleteTimeoutRef = useRef(null);
  const lastAutoFailureTsRef = useRef(null);
  const lastAutoFailureAcceptedAtRef = useRef(0);
  const lastAutoFailureAcceptedByCategoryRef = useRef({});
  const defaultFlightEvents = { tailstrike: false, stall: false, overstress: false, overspeed: false, flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false, crash: false, harsh_controls: false, high_g_force: false, hard_landing: false, wrong_airport: false, failure_engine: false, failure_electrical: false, failure_avionics: false, failure_landing_gear: false, failure_airframe: false };
  const buildRestoredFlightData = React.useCallback((sourceFlight) => {
    const xpd = sourceFlight?.xplane_data || {};
    const events = {
      ...defaultFlightEvents,
      ...((xpd.events && typeof xpd.events === 'object') ? xpd.events : {}),
    };
    return {
      altitude: Number(xpd.altitude || 0),
      speed: Number(xpd.speed || 0),
      verticalSpeed: Number(xpd.vertical_speed || 0),
      heading: Number(xpd.heading || 0),
      fuel: Number(xpd.fuel_percentage || 100),
      fuelKg: Number(xpd.fuel_kg || xpd.last_valid_fuel_kg || 0),
      gForce: Number(xpd.g_force || 1.0),
      maxGForce: Math.max(1.0, Number(xpd.max_g_force || xpd.g_force || 1.0)),
      landingGForce: Number(xpd.landing_g_force || 0),
      landingVs: Math.abs(Number(xpd.touchdown_vspeed || 0)),
      landingType: xpd.landing_type || null,
      landingScoreChange: Number(xpd.landing_score_change || 0),
      landingMaintenanceCost: Number(xpd.landing_maintenance_cost || 0),
      landingBonus: Number(xpd.landing_bonus || 0),
      flightScore: Number(xpd.flight_score || xpd.final_score || 100),
      maintenanceCost: Number(xpd.maintenance_cost || 0),
      reputation: xpd.reputation || 'EXCELLENT',
      latitude: Number(xpd.latitude || 0),
      longitude: Number(xpd.longitude || 0),
      events,
      maxControlInput: Number(xpd.max_control_input || xpd.control_input || 0),
      departure_lat: Number(xpd.departure_lat || 0),
      departure_lon: Number(xpd.departure_lon || 0),
      arrival_lat: Number(xpd.arrival_lat || 0),
      arrival_lon: Number(xpd.arrival_lon || 0),
      wasAirborne: !!(xpd.was_airborne || xpd.completion_armed),
      previousSpeed: Number(xpd.speed || 0),
    };
  }, [defaultFlightEvents]);
  const [failurePopup, setFailurePopup] = useState(null);
  const failurePopupTimerRef = React.useRef(null);
  const showFailurePopup = React.useCallback((message) => {
    if (!message) return;
    if (failurePopupTimerRef.current) {
      clearTimeout(failurePopupTimerRef.current);
    }
    setFailurePopup({ id: Date.now(), message });
    failurePopupTimerRef.current = setTimeout(() => {
      setFailurePopup(null);
      failurePopupTimerRef.current = null;
    }, FAILURE_POPUP_VISIBLE_MS);
  }, []);
  useEffect(() => {
    return () => {
      if (failurePopupTimerRef.current) {
        clearTimeout(failurePopupTimerRef.current);
      }
    };
  }, []);
  const [flightData, setFlightData] = useState({
    altitude: 0, speed: 0, verticalSpeed: 0, heading: 0,
    fuel: 100, fuelKg: 0, gForce: 1.0, maxGForce: 1.0,
    landingGForce: 0, landingVs: 0, landingType: null,
    landingScoreChange: 0, landingMaintenanceCost: 0, landingBonus: 0,
    flightScore: 100, maintenanceCost: 0, reputation: 'EXCELLENT',
    latitude: 0, longitude: 0,
    events: { ...defaultFlightEvents },
    maxControlInput: 0, departure_lat: 0, departure_lon: 0,
    arrival_lat: 0, arrival_lon: 0, wasAirborne: false, previousSpeed: 0
  });

  const maintenanceCategoryConfig = useMemo(() => ([
    { key: 'engine', icon: Cog, label: lang === 'de' ? 'Triebwerk' : 'Engine' },
    { key: 'hydraulics', icon: Gauge, label: lang === 'de' ? 'Hydraulik' : 'Hydraulics' },
    { key: 'avionics', icon: CircuitBoard, label: lang === 'de' ? 'Avionik' : 'Avionics' },
    { key: 'airframe', icon: Shield, label: lang === 'de' ? 'Struktur' : 'Airframe' },
    { key: 'landing_gear', icon: Plane, label: lang === 'de' ? 'Fahrwerk' : 'Landing Gear' },
    { key: 'electrical', icon: Zap, label: lang === 'de' ? 'Elektrik' : 'Electrical' },
    { key: 'flight_controls', icon: Wind, label: lang === 'de' ? 'Steuerflächen' : 'Flight Controls' },
    { key: 'pressurization', icon: Shield, label: lang === 'de' ? 'Druckkabine' : 'Pressurization' },
  ]), [lang]);

  const liveMaintenanceCategories = useMemo(() => {
    if (flightPhase === 'preflight' || !flightDataRef.current) return [];
    const ev = flightDataRef.current.events || {};
    const baseWear = (flightDurationSeconds / 3600) * 0.5;
    const flightWear = {
      engine: baseWear,
      hydraulics: baseWear,
      avionics: baseWear,
      airframe: baseWear,
      landing_gear: baseWear,
      electrical: baseWear,
      flight_controls: baseWear,
      pressurization: baseWear,
    };

    const currentLiveData = flightDataRef.current || flightData;
    const reasons = {};
    const addReason = (category, reason) => {
      reasons[category] = reasons[category] || [];
      reasons[category].push(reason);
    };

    const landingG = Number(currentLiveData.landingGForce || 0);
    const engineThrustWear = calcEngineWearFromThrustProfile(engineHighLoadSecondsLive, flightDurationSeconds, engineKnownThrustSecondsLive);
    if (engineThrustWear.totalWear > 0 || engineThrustWear.knownSeconds > 0) {
      flightWear.engine += engineThrustWear.totalWear;
      addReason(
        'engine',
        lang === 'de'
          ? `Vollschub ${(engineThrustWear.fullSeconds / 60).toFixed(1)} min (+${engineThrustWear.fullWear.toFixed(1)}%), Teilschub ${(engineThrustWear.nonFullSeconds / 60).toFixed(1)} min (+${engineThrustWear.nonFullWear.toFixed(1)}%)`
          : `Full thrust ${(engineThrustWear.fullSeconds / 60).toFixed(1)} min (+${engineThrustWear.fullWear.toFixed(1)}%), partial thrust ${(engineThrustWear.nonFullSeconds / 60).toFixed(1)} min (+${engineThrustWear.nonFullWear.toFixed(1)}%)`
      );
    }

    const engineHighGWear = calcEngineWearFromHighG(currentLiveData.maxGForce);
    if (engineHighGWear > 0) {
      flightWear.engine += engineHighGWear;
      addReason(
        'engine',
        lang === 'de'
          ? `High-G ${Number(currentLiveData.maxGForce || 1).toFixed(2)}G (+${engineHighGWear.toFixed(2)}%)`
          : `High-G ${Number(currentLiveData.maxGForce || 1).toFixed(2)}G (+${engineHighGWear.toFixed(2)}%)`
      );
    }

    const engineHardLandingWear = calcEngineWearFromHardLanding(landingG);
    if (engineHardLandingWear > 0) {
      flightWear.engine += engineHardLandingWear;
      addReason(
        'engine',
        lang === 'de'
          ? `Landing-G ${landingG.toFixed(2)} (+${engineHardLandingWear.toFixed(2)}%)`
          : `Landing G ${landingG.toFixed(2)} (+${engineHardLandingWear.toFixed(2)}%)`
      );
    }

    const landingImpactWear = calcLandingGearWearFromLandingG(landingG);
    const avionicsLandingWear = calcAvionicsWearFromLandingG(landingG);
    if (landingImpactWear > 0) {
      const hydraulicLandingWear = calcHydraulicsWearFromLandingImpact(landingImpactWear);
      flightWear.landing_gear += landingImpactWear;
      flightWear.hydraulics += hydraulicLandingWear;
      addReason(
        'landing_gear',
        lang === 'de'
          ? `Landing G ${landingG.toFixed(2)}`
          : `Landing G ${landingG.toFixed(2)}`
      );
      if (hydraulicLandingWear > 0) {
        addReason(
          'hydraulics',
          lang === 'de'
            ? `Hydraulik-Shock durch Landing G ${landingG.toFixed(2)}`
            : `Hydraulic shock from landing G ${landingG.toFixed(2)}`
        );
      }
    }
    if (avionicsLandingWear > 0) {
      flightWear.avionics += avionicsLandingWear;
      addReason(
        'avionics',
        lang === 'de'
          ? `Landing-Impact ${landingG.toFixed(2)}G`
          : `Landing impact ${landingG.toFixed(2)}G`
      );
    }

    if (highAltitudeSecondsLive > 0) {
      const pressureWear = calcPressurizationWearFromHighAltSeconds(highAltitudeSecondsLive);
      flightWear.pressurization += pressureWear;
      addReason(
        'pressurization',
        lang === 'de'
          ? `Höhenzeit >10k ft: ${(highAltitudeSecondsLive / 60).toFixed(1)} min`
          : `High-alt time >10k ft: ${(highAltitudeSecondsLive / 60).toFixed(1)} min`
      );
    }

    const controlInputPct = clamp(Number(currentLiveData.maxControlInput || 0), 0, 1);
    const controlInputWear = calcFlightControlsWearFromControlInput(controlInputPct);
    if (controlInputWear > 0) {
      const hydraulicsFromControls = controlInputWear * 0.35;
      flightWear.flight_controls += controlInputWear;
      flightWear.hydraulics += hydraulicsFromControls;
      flightWear.electrical += calcElectricalWearFromControlInput(controlInputPct);
      addReason(
        'flight_controls',
        lang === 'de'
          ? `Steuerausschläge max ${(controlInputPct * 100).toFixed(0)}%`
          : `Control input peak ${(controlInputPct * 100).toFixed(0)}%`
      );
      addReason(
        'hydraulics',
        lang === 'de'
          ? `Hydrauliklast durch Controls ${(controlInputPct * 100).toFixed(0)}%`
          : `Hydraulic load from controls ${(controlInputPct * 100).toFixed(0)}%`
      );
    }

    const gStressWear = calcAirframeWearFromHighG(currentLiveData.maxGForce);
    const avionicsHighGWear = calcAvionicsWearFromHighG(currentLiveData.maxGForce);
    if (gStressWear > 0) {
      flightWear.airframe += gStressWear;
      addReason('airframe', `Peak G ${Number(currentLiveData.maxGForce || 1).toFixed(2)}`);
    }
    if (avionicsHighGWear > 0) {
      flightWear.avionics += avionicsHighGWear;
      addReason('avionics', `High-G ${Number(currentLiveData.maxGForce || 1).toFixed(2)}G`);
    }

    const electricalEngineHeatWear = calcElectricalWearFromEngineHighLoadSeconds(engineHighLoadSecondsLive);
    if (electricalEngineHeatWear > 0) {
      flightWear.electrical += electricalEngineHeatWear;
      addReason(
        'electrical',
        lang === 'de'
          ? `Dauerlast-Temperatur ${(engineHighLoadSecondsLive / 60).toFixed(1)} min`
          : `Sustained high-load heat ${(engineHighLoadSecondsLive / 60).toFixed(1)} min`
      );
    }

    if (ev.tailstrike) {
      flightWear.airframe += 10;
      addReason('airframe', lang === 'de' ? 'Tailstrike' : 'Tailstrike');
    }
    if (ev.overstress) {
      flightWear.airframe += OVERSTRESS_AIRFRAME_WEAR;
      addReason('airframe', lang === 'de' ? 'Strukturlast' : 'Structural stress');
    }
    if (ev.overspeed) {
      flightWear.airframe += OVERSPEED_AIRFRAME_WEAR;
      flightWear.avionics += OVERSPEED_AVIONICS_WEAR;
      flightWear.electrical += OVERSPEED_ELECTRICAL_WEAR;
      addReason('airframe', lang === 'de' ? 'Overspeed-Last' : 'Overspeed stress');
      addReason('avionics', lang === 'de' ? 'Overspeed-Schock' : 'Overspeed shock');
      addReason('electrical', lang === 'de' ? 'Overspeed-Spannungsspitzen' : 'Overspeed electrical spikes');
    }
    if (ev.high_g_force) {
      flightWear.airframe += HIGH_G_FORCE_AIRFRAME_EVENT_WEAR;
      flightWear.avionics += HIGH_G_FORCE_AVIONICS_EVENT_WEAR;
      flightWear.engine += HIGH_G_FORCE_ENGINE_EVENT_WEAR;
      addReason('airframe', lang === 'de' ? 'Hohe G-Last' : 'High G load');
      addReason('avionics', lang === 'de' ? 'Hohe G-Last' : 'High G load');
      addReason('engine', lang === 'de' ? `High-G Event +${HIGH_G_FORCE_ENGINE_EVENT_WEAR}%` : `High-G event +${HIGH_G_FORCE_ENGINE_EVENT_WEAR}%`);
    }
    if (ev.hard_landing) {
      flightWear.engine += HARD_LANDING_ENGINE_EVENT_WEAR;
      addReason('landing_gear', lang === 'de' ? 'Harte Landung' : 'Hard landing');
      addReason('engine', lang === 'de' ? `Harte Landung +${HARD_LANDING_ENGINE_EVENT_WEAR}%` : `Hard landing +${HARD_LANDING_ENGINE_EVENT_WEAR}%`);
    }
    if (ev.gear_up_landing) {
      flightWear.landing_gear += 25;
      addReason('landing_gear', lang === 'de' ? 'Gear-up Landung' : 'Gear-up landing');
    }
    if (ev.flaps_overspeed) {
      flightWear.flight_controls += 10;
      addReason('flight_controls', lang === 'de' ? 'Klappen-Überspeed' : 'Flaps overspeed');
    }
    if (ev.failure_engine) addReason('engine', lang === 'de' ? 'Ausfall erkannt' : 'Failure detected');
    if (ev.failure_electrical) addReason('electrical', lang === 'de' ? 'Ausfall erkannt' : 'Failure detected');
    if (ev.failure_avionics) addReason('avionics', lang === 'de' ? 'Ausfall erkannt' : 'Failure detected');
    if (ev.failure_landing_gear) addReason('landing_gear', lang === 'de' ? 'Ausfall erkannt' : 'Failure detected');
    if (ev.failure_airframe) {
      addReason('airframe', lang === 'de' ? 'Ausfall erkannt' : 'Failure detected');
      addReason('flight_controls', lang === 'de' ? 'Flaps/Speedbrake durch Strukturausfall blockiert' : 'Flaps/speedbrake blocked by airframe failure');
    }

    if (ev.crash) {
      Object.keys(flightWear).forEach((cat) => {
        flightWear[cat] = 100;
        addReason(cat, lang === 'de' ? 'Crash' : 'Crash');
      });
    }

    const toColor = (wear) => {
      if (wear >= 80) return 'text-red-400';
      if (wear >= 60) return 'text-orange-400';
      if (wear >= 35) return 'text-amber-400';
      return 'text-emerald-400';
    };

    return maintenanceCategoryConfig
      .map((category) => {
        const addedWear = Math.max(0, Number(flightWear[category.key] || 0));
        return {
          ...category,
          existingWear: 0,
          addedWear,
          wear: addedWear,
          reasons: reasons[category.key] || [],
        };
      })
      .sort((a, b) => b.wear - a.wear)
      .map((category) => ({ ...category, colorClass: toColor(category.wear) }));
  }, [
    flightPhase,
    flightDurationSeconds,
    flightData,
    lang,
    maintenanceCategoryConfig,
    engineHighLoadSecondsLive,
    engineKnownThrustSecondsLive,
    highAltitudeSecondsLive,
  ]);

  const liveCostExplanationRef = React.useRef(null);
  const urlParams = new URLSearchParams(window.location.search);
  const contractIdFromUrl = urlParams.get('contractId');

  const { data: contract } = useQuery({
    queryKey: ['contract', contractIdFromUrl],
    queryFn: async () => {
      if (!contractIdFromUrl) return null;
      const contracts = await base44.entities.Contract.filter({ id: contractIdFromUrl });
      return contracts[0];
    },
    enabled: !!contractIdFromUrl,
    staleTime: 300000, // Contract doesn't change during flight
  });

  // Load existing flight if any
  const { data: existingFlight } = useQuery({
    queryKey: ['active-flight', contractIdFromUrl],
    queryFn: async () => {
      if (!contractIdFromUrl) return null;
      const user = await base44.auth.me();
      let companyId = resolveUserCompanyId(user);
      if (!companyId) {
        const companies = await base44.entities.Company.filter({ created_by: user.email });
        companyId = companies[0]?.id;
      }
      if (!companyId) return null;
      const flights = await base44.entities.Flight.filter({ 
        company_id: companyId,
        contract_id: contractIdFromUrl,
        status: 'in_flight'
      });
      return flights[0] || null;
    },
    enabled: !!contractIdFromUrl,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Derive the active flight ID - either from state (after startFlight) or from existingFlight query
  // This avoids the async state update delay problem
  const activeFlightId = flight?.id || existingFlight?.id;

  // Live data - real-time subscription for instant updates from backend
  const [xplaneLog, setXplaneLog] = useState(null);
  const lastXplaneTimestampRef = React.useRef(null);
  const [dataLatency, setDataLatency] = useState(null); // ms between two received updates
  const [dataAge, setDataAge] = useState(null); // ms since last data received (live ticker)
  const lastDataReceivedRef = React.useRef(null);
  const [localMapPath, setLocalMapPath] = useState([]);
  const ingestLiveXplaneData = React.useCallback((xpData, sourceDate) => {
    if (!xpData) return;
    const ts = xpData.timestamp || sourceDate;
    const prevTs = lastXplaneTimestampRef.current;
    if (ts && prevTs && ts === prevTs) return;

    const nextMs = Date.parse(ts || '');
    const prevMs = Date.parse(prevTs || '');
    // Ignore stale packets so slower channels cannot overwrite fresher telemetry.
    if (Number.isFinite(nextMs) && Number.isFinite(prevMs) && nextMs <= prevMs) return;

    lastXplaneTimestampRef.current = ts || prevTs || new Date().toISOString();
    const now = Date.now();
    if (lastDataReceivedRef.current) {
      setDataLatency(now - lastDataReceivedRef.current);
    }
    lastDataReceivedRef.current = now;
    setXplaneLog({ raw_data: xpData, created_date: sourceDate || ts || new Date().toISOString() });
  }, []);
  
  // Live ticker: shows how long ago the last data arrived (updates every 200ms)
  useEffect(() => {
    if (flightPhase === 'completed') return;
    const ticker = setInterval(() => {
      if (lastDataReceivedRef.current) {
        setDataAge(Date.now() - lastDataReceivedRef.current);
      }
    }, 100);
    return () => clearInterval(ticker);
  }, [flightPhase]);

  useEffect(() => {
    if (flightPhase === 'preflight' || flightPhase === 'completed') {
      setEngineHighLoadSecondsLive(0);
      setEngineKnownThrustSecondsLive(0);
      setHighAltitudeSecondsLive(0);
      return;
    }

    const raw = xplaneLog?.raw_data || {};
    const activeSession = flight || existingFlight;
    const sessionStartMs = Number.isFinite(Number(flightStartedAt))
      ? Number(flightStartedAt)
      : Date.parse(String(activeSession?.departure_time || activeSession?.created_date || ""));
    const history = filterTelemetryHistoryForSession(raw.telemetry_history, sessionStartMs);
    if (history.length === 0) {
      setEngineHighLoadSecondsLive(0);
      setEngineKnownThrustSecondsLive(0);
      setHighAltitudeSecondsLive(0);
      return;
    }

    const currentThrustLever = readThrustLeverPct(raw);
    const thrustProfile = calcEngineThrustProfileSeconds(history, currentThrustLever);
    setEngineHighLoadSecondsLive(thrustProfile.fullSeconds);
    setEngineKnownThrustSecondsLive(thrustProfile.knownSeconds);

    const currentAltitude = firstFiniteNumber(raw.altitude, raw.alt);
    const highAltSeconds = calcConditionSecondsFromTelemetry({
      telemetryHistory: history,
      currentSampleValue: currentAltitude,
      predicate: (curPt, prevPt) => {
        const curAlt = firstFiniteNumber(curPt?.value, readAltitudeFt(curPt));
        const prevAlt = readAltitudeFt(prevPt);
        const effectiveAlt = Number.isFinite(curAlt) ? curAlt : prevAlt;
        return Number.isFinite(effectiveAlt) && effectiveAlt >= 10000;
      },
    });
    setHighAltitudeSecondsLive(highAltSeconds);
  }, [flightPhase, xplaneLog, flight, existingFlight, flightStartedAt]);
  const { data: aircraft } = useQuery({
    queryKey: ['aircraft'],
    queryFn: async () => {
      const user = await base44.auth.me();
      let companyId = resolveUserCompanyId(user);
      if (!companyId) {
        const companies = await base44.entities.Company.filter({ created_by: user.email });
        companyId = companies[0]?.id;
      }
      return companyId ? await base44.entities.Aircraft.filter({ company_id: companyId }) : [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
  const { data: settings } = useQuery({ queryKey: ['gameSettings'], queryFn: async () => { const s = await base44.entities.GameSettings.list(); return s[0] || null; }, staleTime: 300000, refetchOnWindowFocus: false });
  useEffect(() => { const xp = xplaneLog?.raw_data || {};
    const failureTs = xp.maintenance_failure_timestamp || null;
    const failureCategory = String(xp.maintenance_failure_category || '').toLowerCase().trim();
    const failureSeverity = String(xp.maintenance_failure_severity || 'medium').toLowerCase().trim();
    if (!failureTs || !failureCategory) return;
    const activeSession = flight || existingFlight;
    const sessionStartMs = Date.parse(String(activeSession?.departure_time || activeSession?.created_date || ""));
    const failureTsMs = Date.parse(String(failureTs || ""));
    if (Number.isFinite(sessionStartMs) && Number.isFinite(failureTsMs) && failureTsMs < (sessionStartMs - 5000)) return;
    if (lastAutoFailureTsRef.current === failureTs) return;
    lastAutoFailureTsRef.current = failureTs;

    const categoryToEventKey = {
      engine: 'failure_engine',
      electrical: 'failure_electrical',
      avionics: 'failure_avionics',
      landing_gear: 'failure_landing_gear',
      airframe: 'failure_airframe',
    };
    const eventKey = categoryToEventKey[failureCategory];
    if (!eventKey) return;

    const aircraftIdForFailure = activeSession?.aircraft_id;
    const aircraftForFailure = (Array.isArray(aircraft) && aircraftIdForFailure)
      ? aircraft.find((a) => a.id === aircraftIdForFailure)
      : null;
    const dynamicCats = normalizeMaintenanceCategoryMap(aircraftForFailure?.maintenance_categories);
    const permanentCats = normalizeMaintenanceCategoryMap(aircraftForFailure?.permanent_wear_categories);
    const dynamicWear = Math.max(0, Number(dynamicCats?.[failureCategory] || 0));
    const permanentWear = Math.max(0, Number(permanentCats?.[failureCategory] || 0));
    const totalWear = dynamicWear + permanentWear;
    const severityBoost = ['critical', 'severe', 'schwer', 'kritisch'].includes(failureSeverity) ? 10 : 0;
    const minWearRequired = Math.max(35, AUTO_FAILURE_MIN_TOTAL_WEAR_PCT - severityBoost);
    if (totalWear < minWearRequired) return;

    const nowMs = Date.now();
    if (lastAutoFailureAcceptedAtRef.current > 0 && (nowMs - lastAutoFailureAcceptedAtRef.current) < AUTO_FAILURE_GLOBAL_COOLDOWN_MS) {
      return;
    }
    const lastAcceptedThisCategory = Number(lastAutoFailureAcceptedByCategoryRef.current?.[failureCategory] || 0);
    if (lastAcceptedThisCategory > 0 && (nowMs - lastAcceptedThisCategory) < AUTO_FAILURE_CATEGORY_COOLDOWN_MS) {
      return;
    }

    // Even with high wear, only some plugin-reported failures are accepted to avoid spammy failure frequency.
    let acceptanceChance = 0.18;
    if (totalWear >= 95) acceptanceChance = 0.7;
    else if (totalWear >= 85) acceptanceChance = 0.52;
    else if (totalWear >= 75) acceptanceChance = 0.38;
    else if (totalWear >= 65) acceptanceChance = 0.27;
    if (severityBoost > 0) acceptanceChance = Math.min(0.9, acceptanceChance + 0.2);
    const roll = deterministicFailureRoll(`${failureTs}|${failureCategory}|${activeSession?.id || ''}`);
    if (roll > acceptanceChance) return;

    lastAutoFailureAcceptedAtRef.current = nowMs;
    lastAutoFailureAcceptedByCategoryRef.current = {
      ...(lastAutoFailureAcceptedByCategoryRef.current || {}),
      [failureCategory]: nowMs,
    };

    const labelByCategory = {
      engine: lang === 'de' ? 'Triebwerksausfall' : 'Engine failure',
      electrical: lang === 'de' ? 'Elektrikausfall' : 'Electrical failure',
      avionics: lang === 'de' ? 'Avionik-Ausfall' : 'Avionics failure',
      landing_gear: lang === 'de' ? 'Fahrwerksausfall' : 'Landing gear failure',
      airframe: lang === 'de' ? 'Strukturausfall' : 'Airframe failure',
    };

    setFlightData((prev) => {
      const updated = {
        ...prev,
        events: {
          ...(prev.events || {}),
          [eventKey]: true,
        },
      };
      flightDataRef.current = updated;
      return updated;
    });

    const popupMessage = lang === 'de'
      ? `${labelByCategory[failureCategory]} erkannt`
      : `${labelByCategory[failureCategory]} detected`;
    showFailurePopup(popupMessage);
  }, [xplaneLog, lang, flight, existingFlight, aircraft, showFailurePopup]);

  // Initial fetch to get current flight data immediately
  useEffect(() => {
    if (flightPhase === 'completed') return;
    if (!activeFlightId) return;
    
    const fetchInitial = async () => {
      const flights = await base44.entities.Flight.filter({ id: activeFlightId });
      const currentFlight = flights[0];
      if (currentFlight?.xplane_data) {
        ingestLiveXplaneData(currentFlight.xplane_data, currentFlight.updated_date);
      }
    };
    fetchInitial();
  }, [activeFlightId, flightPhase, ingestLiveXplaneData]);

  useEffect(() => {
    setLocalMapPath([]);
    lastAutoFailureTsRef.current = null;
    lastAutoFailureAcceptedAtRef.current = 0;
    lastAutoFailureAcceptedByCategoryRef.current = {};
  }, [activeFlightId]);

  useEffect(() => {
    const xp = xplaneLog?.raw_data;
    if (!xp) return;
    const lat = Number(xp.latitude);
    const lon = Number(xp.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (Math.abs(lat) < 0.5 && Math.abs(lon) < 0.5)) return;
    setLocalMapPath((prev) => {
      const last = prev.length > 0 ? prev[prev.length - 1] : null;
      const threshold = xp.on_ground ? 0.0002 : 0.0008;
      if (last && Math.abs(last[0] - lat) < threshold && Math.abs(last[1] - lon) < threshold) {
        return prev;
      }
      const next = [...prev, [lat, lon]];
      return next.length > 2600 ? next.slice(-2600) : next;
    });
  }, [xplaneLog?.raw_data?.latitude, xplaneLog?.raw_data?.longitude, xplaneLog?.raw_data?.on_ground]);

  // Real-time subscription – receives updates instantly when backend writes new xplane_data
  useEffect(() => {
    if (flightPhase === 'completed') return;
    if (!activeFlightId) return;
    
    let lastSubEventTime = 0;
    
    // Setup subscription with automatic reconnect
    let unsubscribe = null;
    const setupSubscription = () => {
      if (unsubscribe) {
        try { unsubscribe(); } catch (_) {}
      }
      unsubscribe = base44.entities.Flight.subscribe((event) => {
        if (event.type === 'update' && event.id === activeFlightId && event.data?.xplane_data) {
          lastSubEventTime = Date.now();
          ingestLiveXplaneData(event.data.xplane_data, event.data.updated_date);
        }
      });
    };
    
    setupSubscription();
    
    // Monitor subscription health: if no events for >3s despite active flight, reconnect quickly
    const healthCheck = setInterval(() => {
      if (lastSubEventTime > 0 && (Date.now() - lastSubEventTime) > 3000) {
        setupSubscription();
      }
    }, 2000);
    
    // Polling fallback: polls at 1.0s but only when subscription isn't delivering
    let pollInFlight = false;
    const pollInterval = setInterval(async () => {
      if (pollInFlight) return;
      // Skip poll if subscription delivered very recently (< 0.9s)
      if (lastDataReceivedRef.current && (Date.now() - lastDataReceivedRef.current) < 900) return;
      pollInFlight = true;
      try {
        const flights = await base44.entities.Flight.filter({ id: activeFlightId });
        const f = flights[0];
        if (f?.xplane_data) {
          ingestLiveXplaneData(f.xplane_data, f.updated_date);
        }
      } catch (_) {}
      pollInFlight = false;
    }, 1500);
    
    return () => {
      if (unsubscribe) try { unsubscribe(); } catch (_) {}
      clearInterval(pollInterval);
      clearInterval(healthCheck);
    };
  }, [activeFlightId, flightPhase, ingestLiveXplaneData]);

  // Restore flight data and phase from existing flight
  useEffect(() => {
    if (existingFlight && !flight) {
      setFlight(existingFlight);
      setFlightPhase('takeoff');
      // DO NOT set flightStartedAt here - we WANT to process the existing xplane_data on the Flight record
      // The timestamp filter was incorrectly blocking ALL existing data
      setFlightStartedAt(null);
      setIsCompletingFlight(false);
      // Restore last known live values so reopening SkyCareer mid-flight does
      // not visually reset deadline/incidents while telemetry keeps running.
      const restoredData = buildRestoredFlightData(existingFlight);
      setFlightData(restoredData);
      flightDataRef.current = restoredData;
    }
  }, [existingFlight, flight, buildRestoredFlightData]);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const companyId = resolveUserCompanyId(user);
      if (companyId) {
        const companies = await base44.entities.Company.filter({ id: companyId });
        if (companies[0]) return companies[0];
      }
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      return companies[0];
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Faster live source: consume XPlaneLog stream directly (written every ~2s),
  // so UI does not wait for slower Flight record propagation.
  useEffect(() => {
    if (flightPhase === 'completed') return;
    if (!company?.id || !activeFlightId) return;
    const activeFl = flight || existingFlight;
    const sessionStartMs = Date.parse(String(activeFl?.departure_time || activeFl?.created_date || ""));

    const matchesActiveSession = (logEntry) => {
      const raw = logEntry?.raw_data || {};
      const logFlightId = raw?.flight_id || null;
      const logContractId = raw?.contract_id || null;

      if (logFlightId) {
        return String(logFlightId) === String(activeFlightId);
      }
      if (logContractId && contractIdFromUrl) {
        return String(logContractId) === String(contractIdFromUrl);
      }
      // Backward compatibility for older logs without IDs:
      // only accept logs from this flight session time window.
      const logTsMs = Date.parse(String(
        raw?.airborne_started_at ||
        raw?.completion_armed_at ||
        raw?.timestamp ||
        logEntry?.created_date ||
        ""
      ));
      if (Number.isFinite(sessionStartMs) && Number.isFinite(logTsMs)) {
        return logTsMs >= (sessionStartMs - 15000);
      }
      return false;
    };

    const applyLog = (logEntry) => {
      if (!logEntry?.raw_data) return;
      if (!matchesActiveSession(logEntry)) return;
      ingestLiveXplaneData(logEntry.raw_data, logEntry.created_date || logEntry.updated_date);
    };

    let unsub = null;
    let pollInFlight = false;

    const prime = async () => {
      try {
        const logs = await base44.entities.XPlaneLog.filter(
          { company_id: company.id, has_active_flight: true },
          '-created_date',
          10
        );
        const boundLog = logs.find(matchesActiveSession);
        if (boundLog) applyLog(boundLog);
      } catch (_) {}
    };
    prime();

    unsub = base44.entities.XPlaneLog.subscribe((event) => {
      if (event.type !== 'create' && event.type !== 'update') return;
      if (event.data?.company_id !== company.id) return;
      if (!event.data?.has_active_flight) return;
      applyLog(event.data);
    });

    const poll = setInterval(async () => {
      if (pollInFlight) return;
      if (lastDataReceivedRef.current && (Date.now() - lastDataReceivedRef.current) < 1200) return;
      pollInFlight = true;
      try {
        const logs = await base44.entities.XPlaneLog.filter(
          { company_id: company.id, has_active_flight: true },
          '-created_date',
          10
        );
        const boundLog = logs.find(matchesActiveSession);
        if (boundLog) applyLog(boundLog);
      } catch (_) {}
      pollInFlight = false;
    }, 1000);

    return () => {
      if (unsub) {
        try { unsub(); } catch (_) {}
      }
      clearInterval(poll);
    };
  }, [company?.id, activeFlightId, contractIdFromUrl, flightPhase, ingestLiveXplaneData, flight, existingFlight]);

  // Find the assigned aircraft for this flight
  const assignedAircraft = aircraft?.find(a => a.id === (flight?.aircraft_id || existingFlight?.aircraft_id));
  const liveMaintenanceCategoriesDisplay = useMemo(() => {
    const existingCats = assignedAircraft?.maintenance_categories || {};
    const permanentCats = assignedAircraft?.permanent_wear_categories || {};
    const toColor = (wear) => {
      if (wear >= 80) return 'text-red-400';
      if (wear >= 60) return 'text-orange-400';
      if (wear >= 35) return 'text-amber-400';
      return 'text-emerald-400';
    };

    return (Array.isArray(liveMaintenanceCategories) ? liveMaintenanceCategories : [])
      .map((category) => {
        const existingWear = Math.max(0, Number(existingCats?.[category.key] || 0));
        const permanentWear = Math.max(0, Number(permanentCats?.[category.key] || 0));
        const addedWear = Math.max(0, Number(category?.addedWear ?? category?.wear ?? 0));
        const totalWear = Math.min(100, permanentWear + existingWear + addedWear);
        return {
          ...category,
          permanentWear,
          existingWear,
          addedWear,
          wear: totalWear,
          colorClass: toColor(totalWear),
        };
      })
      .sort((a, b) => Number(b?.wear || 0) - Number(a?.wear || 0));
  }, [assignedAircraft?.maintenance_categories, assignedAircraft?.permanent_wear_categories, liveMaintenanceCategories]);

  const liveActiveFailures = useMemo(() => {
    const persisted = sanitizeFailureList(
      flight?.active_failures || existingFlight?.active_failures || [],
      lang,
      { bridgeOnly: true }
    );
    const fromEventFlags = buildFailuresFromEventFlags(flightData?.events || {}, lang);
    if (fromEventFlags.length === 0) return persisted;

    const merged = [...persisted];
    const seen = new Set(
      persisted.map((entry) => `${String(entry?.category || "")}|${String(entry?.name || "")}`),
    );
    for (const entry of fromEventFlags) {
      const dedupeKey = `${String(entry?.category || "")}|${String(entry?.name || "")}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      merged.push(entry);
    }
    return merged;
  }, [flight?.active_failures, existingFlight?.active_failures, flightData?.events, lang]);

  const liveMaintenanceCostSnapshot = useMemo(() => {
    // Repair cost is purely wear-based now: each category contributes (newValue/N) at 100% wear.
    const purchasePrice = Math.max(0, Number(assignedAircraft?.purchase_price || 0));
    const existingCats = assignedAircraft?.maintenance_categories || {};
    const byCategory = {};
    let baseTotal = 0;
    let addedTotal = 0;

    const addedByKey = {};
    if (Array.isArray(liveMaintenanceCategories)) {
      for (const category of liveMaintenanceCategories) {
        const key = category?.key;
        if (!key) continue;
        addedByKey[key] = Math.max(0, Number(category?.addedWear ?? category?.wear ?? 0));
      }
    }

    for (const cfg of maintenanceCategoryConfig) {
      const existingWear = Math.max(0, Number(existingCats?.[cfg.key] || 0));
      const addedWear = addedByKey[cfg.key] || 0;
      const base = calculateCategoryRepairCost({ wearPct: existingWear, purchasePrice });
      const totalCost = calculateCategoryRepairCost({ wearPct: existingWear + addedWear, purchasePrice });
      const added = Math.max(0, totalCost - base);
      byCategory[cfg.key] = { base, added, total: totalCost };
      baseTotal += base;
      addedTotal += added;
    }

    return {
      baseTotal,
      addedTotal,
      currentTotal: baseTotal + addedTotal,
      byCategory,
    };
  }, [
    assignedAircraft?.purchase_price,
    assignedAircraft?.maintenance_categories,
    maintenanceCategoryConfig,
    liveMaintenanceCategories,
  ]);

  const liveFlightAddedMaintenanceCost = Math.max(0, Number(liveMaintenanceCostSnapshot?.addedTotal || 0));
  const liveCurrentTotalMaintenanceCost = Math.max(0, Number(liveMaintenanceCostSnapshot?.currentTotal || 0));
  liveCostExplanationRef.current = (category) => { const wP = Math.max(0, Math.min(100, Number(category?.wear || 0))), aP = Math.max(0, Math.min(100, Number(category?.addedWear || 0))), pp = assignedAircraft?.purchase_price || 0, share = pp / Math.max(1, MAINTENANCE_CATEGORY_KEYS.length), est = share * (aP / 100), cc = liveMaintenanceCostSnapshot?.byCategory?.[category?.key] || { total: 0 }; return { title: lang === 'de' ? 'Live-Kosten' : 'Live cost', details: `${wP.toFixed(1)}% (+${aP.toFixed(1)}%)`, formula: `${pp.toLocaleString()} / ${MAINTENANCE_CATEGORY_KEYS.length} x ${wP.toFixed(1)}%`, possibleFailures: '', breakdown: `+$${Math.round(est).toLocaleString()} | $${Math.round(cc.total || 0).toLocaleString()}` }; };
  const [simbriefRoute, setSimbriefRoute] = useState(null);
  const prevContractIdRef = React.useRef(contractIdFromUrl);
  useEffect(() => { if (contractIdFromUrl !== prevContractIdRef.current) { prevContractIdRef.current = contractIdFromUrl; setSimbriefRoute(null); setXplaneLog(null); } }, [contractIdFromUrl]);
  const pickFirstValidLatLon = (pairs = []) => { for (const pair of pairs) { if (!Array.isArray(pair) || pair.length < 2) continue; const lat = Number(pair[0]), lon = Number(pair[1]); if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue; return { lat, lon, valid: true }; } return { lat: 0, lon: 0, valid: false }; };

  const queueBridgeWorkerRestart = React.useCallback(async (targetFlight) => {
    const flightId = targetFlight?.id;
    if (!flightId) return;
    const nowIso = new Date().toISOString();
    const existingXpd = targetFlight?.xplane_data || {};
    const toStoredPct = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return n > 1 ? n : (n * 100);
    };
    let restartAircraft = null;
    if (targetFlight?.aircraft_id) {
      try {
        const rows = await base44.entities.Aircraft.filter({ id: targetFlight.aircraft_id });
        restartAircraft = rows[0] || null;
      } catch (_) {
        restartAircraft = null;
      }
    }
    const currentQueue = Array.isArray(targetFlight?.bridge_command_queue)
      ? targetFlight.bridge_command_queue
      : (Array.isArray(targetFlight?.xplane_data?.bridge_command_queue)
          ? targetFlight.xplane_data.bridge_command_queue
          : []);
    const filteredQueue = currentQueue.filter((cmd) => String(cmd?.type || '').toLowerCase() !== 'worker_restart');
    const restartCommand = {
      id: `cmd-worker-restart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'worker_restart',
      simulator: 'msfs',
      created_at: nowIso,
      source: 'flight_start_auto',
      persist_until_landed: false,
    };
    const nextBridgeCommands = [...filteredQueue, restartCommand].slice(-25);

    await base44.entities.Flight.update(flightId, {
      active_failures: [],
      bridge_command_queue: nextBridgeCommands,
      xplane_data: {
        ...existingXpd,
        flight_id: targetFlight?.id || existingXpd.flight_id || null,
        contract_id: targetFlight?.contract_id || existingXpd.contract_id || null,
        was_airborne: false,
        airborne_started_at: null,
        completion_armed: false,
        completion_armed_at: null,
        touchdown_detected: false,
        touchdown_vspeed: 0,
        landing_g_force: 0,
        landing_data_locked: false,
        bridge_local_landing_locked: false,
        maintenance_failure_category: null,
        maintenance_failure_severity: null,
        maintenance_failure_timestamp: null,
        flight_path: [],
        flight_events_log: [],
        bridge_event_log: [],
        telemetry_history: [],
        ...(restartAircraft ? {
          insurance_plan: String(restartAircraft.insurance_plan || '').trim().toLowerCase() || existingXpd.insurance_plan || null,
          insurance_hourly_rate_pct: Number.isFinite(Number(restartAircraft.insurance_hourly_rate_pct))
            ? Number(restartAircraft.insurance_hourly_rate_pct)
            : (existingXpd.insurance_hourly_rate_pct ?? null),
          insurance_coverage_pct: toStoredPct(restartAircraft.insurance_maintenance_coverage_pct) ?? (existingXpd.insurance_coverage_pct ?? null),
          insurance_score_bonus_pct: toStoredPct(restartAircraft.insurance_score_bonus_pct) ?? (existingXpd.insurance_score_bonus_pct ?? null),
        } : {}),
        bridge_reset_requested_at: nowIso,
        bridge_reset_reason: 'new_flight_start',
        bridge_command_queue: nextBridgeCommands,
      },
    });
  }, []);

  const startFlightMutation = useMutation({
    mutationFn: async () => {
      // Verwende den existierenden Flight oder erstelle einen neuen (sollte nicht passieren)
      if (existingFlight) {
        return existingFlight;
      }
      
      // Fallback: Sollte nicht verwendet werden, da Flights in ActiveFlights erstellt werden
      const nowIso = new Date().toISOString();
      const restartCommand = {
        id: `cmd-worker-restart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'worker_restart',
        simulator: 'msfs',
        created_at: nowIso,
        source: 'flight_tracker_start_fallback',
        persist_until_landed: false,
      };
      const currentUser = await base44.auth.me();
      const userFailurePref = (
        typeof currentUser?.failure_triggers_enabled_user === 'boolean'
          ? currentUser.failure_triggers_enabled_user
          : (typeof currentUser?.data?.failure_triggers_enabled_user === 'boolean'
              ? currentUser.data.failure_triggers_enabled_user
              : (typeof currentUser?.failure_triggers_enabled === 'boolean'
                  ? currentUser.failure_triggers_enabled
                  : (typeof currentUser?.data?.failure_triggers_enabled === 'boolean'
                      ? currentUser.data.failure_triggers_enabled
                      : null)))
      );
      const sessionFailureTriggersEnabled = userFailurePref !== false;
      const newFlight = await base44.entities.Flight.create({
        company_id: company.id,
        contract_id: contractIdFromUrl,
        status: 'in_flight',
        departure_time: new Date().toISOString(),
        active_failures: [],
        bridge_command_queue: [restartCommand],
        xplane_data: {
          contract_id: contractIdFromUrl,
          was_airborne: false,
          airborne_started_at: null,
          completion_armed: false,
          completion_armed_at: null,
          touchdown_detected: false,
          touchdown_vspeed: 0,
          landing_g_force: 0,
          landing_data_locked: false,
          bridge_local_landing_locked: false,
          maintenance_failure_category: null,
          maintenance_failure_severity: null,
          maintenance_failure_timestamp: null,
          flight_path: [],
          flight_events_log: [],
          bridge_event_log: [],
          telemetry_history: [],
          failure_triggers_enabled: sessionFailureTriggersEnabled,
          bridge_reset_requested_at: nowIso,
          bridge_reset_reason: 'new_flight_start',
          bridge_command_queue: [restartCommand],
        },
      });
      
      return newFlight;
    },
    onSuccess: async (flightResult) => {
      try {
        await queueBridgeWorkerRestart(flightResult);
      } catch (err) {
        console.warn('Bridge worker restart command could not be queued:', err);
      }

      setFlight(flightResult);
      setFlightPhase('takeoff');
      // flightStartTime wird NICHT hier gesetzt, sondern erst beim Abheben
      setFlightStartTime(null);
      setFlightDurationSeconds(0);
      setEngineHighLoadSecondsLive(0);
      setHighAltitudeSecondsLive(0);
      setProcessedGLevels(new Set());
      setIsCompletingFlight(false);
      setShowAutoCompleteOverlay(false);
      // Merke Zeitpunkt des Flugstarts, um alte X-Plane Logs zu ignorieren
      setFlightStartedAt(Date.now());
      setXplaneLog(null);
      setLocalMapPath([]);
      setDataLatency(null);
      setDataAge(null);
      lastXplaneTimestampRef.current = null;
      lastDataReceivedRef.current = null;
      lastAutoFailureTsRef.current = null;
      lastAutoFailureAcceptedAtRef.current = 0;
      lastAutoFailureAcceptedByCategoryRef.current = {};
      
      // Reset flight data for new flight - komplett sauber
      const cleanData = {
        altitude: 0,
        speed: 0,
        verticalSpeed: 0,
        heading: 0,
        fuel: 100,
        fuelKg: 0,
        gForce: 1.0,
        maxGForce: 1.0,
        landingGForce: 0,
        landingVs: 0,
        landingScoreChange: 0,
        landingMaintenanceCost: 0,
        landingBonus: 0,
        flightScore: 100,
        maintenanceCost: 0,
        reputation: 'EXCELLENT',
        latitude: 0,
        longitude: 0,
        events: { ...defaultFlightEvents },
        maxControlInput: 0,
        departure_lat: 0,
        departure_lon: 0,
        arrival_lat: 0,
        arrival_lon: 0,
        wasAirborne: false,
        previousSpeed: 0,
        landingType: null
      };
      setFlightData(cleanData);
      flightDataRef.current = cleanData;
      
      queryClient.invalidateQueries();
    }
  });

  const cancelFlightMutation = useMutation({
    mutationFn: async () => {
      // Calculate cancellation penalty
      const penalty = contract?.payout ? contract.payout * 0.3 : 5000;
      
      // Update flight status
      if (flight) {
        await base44.entities.Flight.update(flight.id, {
          status: 'cancelled'
        });
      }
      
      // Update contract status
      await base44.entities.Contract.update(contractIdFromUrl, {
        status: 'failed'
      });
      
      // Deduct penalty from company balance
      if (company) {
        await base44.entities.Company.update(company.id, {
          balance: (company.balance || 0) - penalty,
          reputation: Math.max(0, (company.reputation || 50) - 5)
        });
      }
      
      // Create transaction record
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'other',
        amount: penalty,
        description: `Stornierungsgebühr: ${contract?.title}`,
        reference_id: contractIdFromUrl,
        date: new Date().toISOString()
      });
      
      // Free up aircraft
      if (flight?.aircraft_id) {
        await base44.entities.Aircraft.update(flight.aircraft_id, {
          status: 'available'
        });
      }
      
      return { penalty };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      navigate(createPageUrl("ActiveFlights"));
    }
  });

  const completeFlightMutation = useMutation({
   mutationFn: async () => {
     // Verhindere mehrfache Ausführung
     if (isCompletingFlight) {
       console.log('⚠️ FLUG WIRD BEREITS ABGESCHLOSSEN - ABBRUCH');
       return null;
     }
     console.log('🚀 STARTE FLUGABSCHLUSS');
     setIsCompletingFlight(true);
     
     // Use flight from state OR existingFlight from query
     const activeFlight = flight || existingFlight;
     if (!activeFlight) {
       throw new Error('Flugdaten nicht geladen');
     }
     const sessionStartMs = Date.parse(String(activeFlight?.departure_time || activeFlight?.created_date || ""));
     if (!aircraft || aircraft.length === 0) {
       throw new Error('Flugzeugdaten nicht geladen');
     }

     // Pull latest flight snapshot first so completion uses freshest touchdown values.
     let latestFlight = activeFlight;
     try {
       const latestFlights = await base44.entities.Flight.filter({ id: activeFlight.id });
       if (latestFlights?.[0]) latestFlight = latestFlights[0];
     } catch (_) {
       // no-op: fallback to current activeFlight snapshot
     }
     
     // Use the latest flightData from ref to ensure all events are captured
     let finalFlightData = flightDataRef.current || flightData;
     
     // KRITISCH: Wenn Crash erkannt wurde (egal ob im State oder via has_crashed), 
     // stelle sicher dass das crash-Event gesetzt ist
    if (finalFlightData.events && !finalFlightData.events.crash) {
      const latestXPlane = latestFlight?.xplane_data || activeFlight?.xplane_data;
      // Only trust simconnect_crash_event - persisted "crash" can be sticky/stale.
      if (!!(latestXPlane?.simconnect_crash_event || latestXPlane?.simconnectCrashEvent)) {
        finalFlightData = { ...finalFlightData, events: { ...finalFlightData.events, crash: true } };
      }
    }
     
     // Realistic cost calculations based on aviation industry
     // Use actual X-Plane fuel data: initial_fuel_kg - current fuel_kg
     const liveData = xplaneLog?.raw_data || {};
     const nonZeroNumber = (...values) => {
       for (const value of values) {
         const num = Number(value);
         if (Number.isFinite(num) && Math.abs(num) > 0) return num;
       }
       return 0;
     };
     const positiveNumber = (...values) => {
       for (const value of values) {
         const num = Number(value);
         if (Number.isFinite(num) && num > 0) return num;
       }
       return 0;
     };
     const packetTimestampInSession = (packet = {}) => {
       if (!Number.isFinite(sessionStartMs)) return true;
       const packetTs = Date.parse(String(
         packet?.touchdown_at ||
         packet?.landing_data_locked_at ||
         packet?.bridge_local_landing_locked_at ||
         packet?.completion_armed_at ||
         packet?.airborne_started_at ||
         packet?.timestamp ||
         ''
       ));
       return Number.isFinite(packetTs) && packetTs >= (sessionStartMs - 15000);
     };
     let xpData = latestFlight?.xplane_data || activeFlight?.xplane_data || {};
     const hasAnyTouchdownValues = (packet = {}) => {
       if (!packetTimestampInSession(packet)) return false;
       const vs = nonZeroNumber(packet.touchdown_vspeed);
       const g = positiveNumber(packet.landing_g_force, packet.landingGForce);
       return Math.abs(vs) > 0 || g > 0;
     };
     const localHasTouchdownValues = Math.abs(nonZeroNumber(finalFlightData.landingVs, finalFlightData.landing_vs)) > 0
       || positiveNumber(finalFlightData.landingGForce, finalFlightData.landing_g_force) > 0;
     const shouldWaitForTouchdownData =
       !localHasTouchdownValues &&
       !hasAnyTouchdownValues(xpData) &&
       !!(finalFlightData.wasAirborne || xpData.was_airborne || liveData.was_airborne) &&
       !!(xpData.on_ground || liveData.on_ground);
     if (shouldWaitForTouchdownData) {
       for (let attempt = 0; attempt < 6; attempt++) {
         try {
           const polledFlights = await base44.entities.Flight.filter({ id: activeFlight.id });
           if (polledFlights?.[0]) {
             latestFlight = polledFlights[0];
             xpData = latestFlight?.xplane_data || xpData;
             if (hasAnyTouchdownValues(xpData)) {
               break;
             }
           }
         } catch (_) {
           // continue waiting with current snapshot
         }
         if (attempt < 5) {
           await new Promise((resolve) => setTimeout(resolve, 700));
         }
       }
     }
    const xpLandingPacketInSession = packetTimestampInSession(xpData);
    const liveLandingPacketInSession = packetTimestampInSession(liveData);
    const landingDataTrusted = !!(
      (xpLandingPacketInSession && (
        xpData.touchdown_detected ||
        xpData.landing_data_locked ||
        xpData.bridge_local_landing_locked ||
        xpData.landing_data_source === 'bridge_local'
      )) ||
      (liveLandingPacketInSession && (
        liveData.touchdown_detected ||
        liveData.landing_data_locked ||
        liveData.bridge_local_landing_locked ||
        liveData.landing_data_source === 'bridge_local'
      ))
    );
    const resolvedLandingVs = nonZeroNumber(
      ...(landingDataTrusted && xpLandingPacketInSession ? [xpData.touchdown_vspeed] : []),
      ...(landingDataTrusted && liveLandingPacketInSession ? [liveData.touchdown_vspeed] : []),
      finalFlightData.landingVs,
      finalFlightData.landing_vs
    );
    const resolvedLandingG = positiveNumber(
      ...(landingDataTrusted && xpLandingPacketInSession ? [xpData.landing_g_force, xpData.landingGForce] : []),
      ...(landingDataTrusted && liveLandingPacketInSession ? [liveData.landing_g_force, liveData.landingGForce] : []),
      finalFlightData.landingGForce,
      finalFlightData.landing_g_force
    );
     finalFlightData = recoverLandingBonus({
       ...finalFlightData,
       landingVs: Math.max(0, Math.abs(Number(resolvedLandingVs || finalFlightData.landingVs || 0) || 0)),
       landingGForce: Math.max(0, Math.min(6, Number(resolvedLandingG || finalFlightData.landingGForce || 0))),
     }, contract);
     const initialFuelKg = positiveNumber(
       xpData.initial_fuel_kg,
       liveData.initial_fuel_kg
     );
     let currentFuelKg = positiveNumber(
       finalFlightData.fuelKg,
       liveData.fuel_kg,
       liveData.last_valid_fuel_kg,
       xpData.fuel_kg,
       xpData.last_valid_fuel_kg
     );
     const fuelPct = Math.max(
       0,
       Math.min(100, Number(nonZeroNumber(finalFlightData.fuel, liveData.fuel_percentage, xpData.fuel_percentage) || 0))
     );
     const pctDerivedFuelKg = (initialFuelKg > 0 && fuelPct > 0)
       ? ((initialFuelKg * fuelPct) / 100)
       : 0;
     if (initialFuelKg > 0 && pctDerivedFuelKg > 0) {
       if (currentFuelKg <= 0) {
         currentFuelKg = pctDerivedFuelKg;
       } else {
         const maxDriftKg = initialFuelKg * 0.55;
         if (Math.abs(currentFuelKg - pctDerivedFuelKg) > maxDriftKg) {
           currentFuelKg = pctDerivedFuelKg;
         }
       }
     }
     if (initialFuelKg > 0) {
       currentFuelKg = Math.min(currentFuelKg, initialFuelKg);
     }
     const fuelUsedKg = Math.max(0, initialFuelKg - currentFuelKg);
     const fuelUsed = fuelUsedKg * 1.25; // kg -> liters (Jet-A density ~0.8 kg/L, so 1kg ≈ 1.25L)
     const fuelCostPerLiter = 1.8; // $1.80 per liter for Jet-A fuel (current market rate)
     const fuelCost = fuelUsed * fuelCostPerLiter;

     // Flight hours: Use real-world time from flightStartTime, or departure_time from flight record
     let flightHours;
     if (flightStartTime) {
       const realFlightSeconds = (Date.now() - flightStartTime) / 1000;
       flightHours = realFlightSeconds / 3600; // Convert to hours
     } else if (activeFlight.departure_time) {
       const realFlightSeconds = (Date.now() - new Date(activeFlight.departure_time).getTime()) / 1000;
       flightHours = Math.max(0.01, realFlightSeconds / 3600);
     } else {
       flightHours = contract?.distance_nm ? contract.distance_nm / 450 : 2; // Fallback: Average cruise speed 450 knots
     }

     // Time efficiency bonus/penalty based on contract deadline
     // Dynamic deadline: use X-Plane aircraft ICAO if available, fallback to fleet aircraft type
     const xplaneIcao = xpData.aircraft_icao || activeFlight?.xplane_data?.aircraft_icao || null;
     const fleetType = assignedAircraft?.type || null;
     const deadlineMinutes = (contract?.distance_nm)
       ? calculateDeadlineMinutes(contract.distance_nm, xplaneIcao, fleetType)
       : (contract?.deadline_minutes || 120);
     const deadlineHours = deadlineMinutes / 60;
     let timeBonus = 0;
     let timeScoreChange = 0;
      // 3-tier deadline: on time = +5, buffer (up to 5 min over) = 0, over buffer = -20
     const bufferHours = 5 / 60; // 5 minutes buffer
     const madeDeadline = flightHours <= deadlineHours;
     const inBuffer = !madeDeadline && flightHours <= (deadlineHours + bufferHours);
     const overBuffer = flightHours > (deadlineHours + bufferHours);

     if (madeDeadline) {
        timeScoreChange = 5; // +5 score for making the deadline
     } else if (inBuffer) {
       timeScoreChange = 0; // Within 5-min buffer: no bonus, no penalty
     } else {
       timeScoreChange = -20; // Over buffer: -20 score
     }

     const crewCostPerHour = 250; // $250 per flight hour (captain + first officer)
     const crewCost = flightHours * crewCostPerHour;

     // Maintenance cost per flight hour + event-based costs
     const maintenanceCostPerHour = 400; // $400 per flight hour
     const maintenanceCost = (flightHours * maintenanceCostPerHour) + finalFlightData.maintenanceCost;

     // Landing and airport fees
     const airportFee = 150;

     // Check for crash or off-airport landing (>=10 NM from arrival airport)
      const backendCrashAtCompletion = !!(xpData.simconnect_crash_event || xpData.simconnectCrashEvent);
      const hasCrashed = backendCrashAtCompletion;
      if (finalFlightData.events?.crash !== hasCrashed) {
        finalFlightData = {
          ...finalFlightData,
          events: { ...(finalFlightData.events || {}), crash: hasCrashed }
        };
      }
      const simbriefArrival = xpData.simbrief_arrival_coords || simbriefRoute?.arrival_coords || null;
      const contractArrival = getAirportCoords(contract?.arrival_airport);
      const lastPathPoint = Array.isArray(xpData.flight_path) && xpData.flight_path.length > 0
        ? xpData.flight_path[xpData.flight_path.length - 1]
        : null;
      const arrivalPos = pickFirstValidLatLon([
        [finalFlightData.arrival_lat, finalFlightData.arrival_lon],
        [xpData.arrival_lat, xpData.arrival_lon],
        [simbriefArrival?.lat, simbriefArrival?.lon],
        [simbriefArrival?.latitude, simbriefArrival?.longitude],
        [contractArrival?.lat, contractArrival?.lon],
      ]);
      const currentPos = pickFirstValidLatLon([
        [finalFlightData.latitude, finalFlightData.longitude],
        [xpData.latitude, xpData.longitude],
        [Array.isArray(lastPathPoint) ? lastPathPoint[0] : null, Array.isArray(lastPathPoint) ? lastPathPoint[1] : null],
      ]);
      const arrivalLat = arrivalPos.lat;
      const arrivalLon = arrivalPos.lon;
      const currentLat = currentPos.lat;
      const currentLon = currentPos.lon;
      const hasArrivalCoords = arrivalPos.valid;
      const hasCurrentCoords = currentPos.valid;
      const arrivalDistanceNm = (hasArrivalCoords && hasCurrentCoords)
        ? calculateHaversineDistance(currentLat, currentLon, arrivalLat, arrivalLon)
        : 0;
      const landedTooFarFromArrival = (hasArrivalCoords && hasCurrentCoords) && arrivalDistanceNm >= 10;
      const emergencyOffAirportCompletion = landedTooFarFromArrival && !!emergencyLanding && !hasCrashed;
      const wrongAirport = !!(finalFlightData.events.wrong_airport || (landedTooFarFromArrival && !emergencyLanding));
      if (wrongAirport && !finalFlightData.events.wrong_airport) {
        finalFlightData = {
          ...finalFlightData,
          events: { ...finalFlightData.events, wrong_airport: true }
        };
      }
      const emergencyScorePenalty = emergencyOffAirportCompletion ? 30 : 0;

     // Bei Crash: KEIN Payout und KEIN Bonus
     let revenue = 0;
     let landingBonusUsed = 0;
     let landingPenaltyUsed = 0;
     // Crew bonus removed (employee system replaced by type ratings)
     let crewBonusAmount = 0;
     if (!hasCrashed && !wrongAirport) {
       if (emergencyOffAirportCompletion) {
         revenue = Math.round((contract?.payout || 0) * 0.30);
       } else {
       revenue = contract?.payout || 0;
       // Bonus/Penalty based on landing quality (G-force based)
       const landingBonus = finalFlightData.landingBonus || 0;
       const landingMaintenanceCost = finalFlightData.landingMaintenanceCost || 0;
       if (landingBonus > 0) {
         landingBonusUsed = landingBonus;
         revenue += landingBonus;
       }
       if (landingMaintenanceCost > 0) {
         landingPenaltyUsed = landingMaintenanceCost;
         revenue -= landingMaintenanceCost;
       }
       // Add time bonus + crew bonus
       revenue += timeBonus + crewBonusAmount;
       }
     }

            // Only direct costs (fuel, crew, airport) - maintenance goes to accumulated_maintenance_cost
            // Calculate depreciation based on flight hours
            let airplaneToUpdate = (aircraft || []).find(a => a.id === activeFlight.aircraft_id);
            if (activeFlight?.aircraft_id) {
              try {
                const freshAircraftRows = await base44.entities.Aircraft.filter({ id: activeFlight.aircraft_id });
                if (freshAircraftRows?.[0]) {
                  airplaneToUpdate = freshAircraftRows[0];
                }
              } catch (aircraftRefreshError) {
                console.warn('Could not refresh aircraft before insurance/depreciation calc:', aircraftRefreshError);
              }
            }
            const normalizeStoredPct = (value) => {
              const n = Number(value);
              if (!Number.isFinite(n)) return undefined;
              return n > 1 && n <= 100 ? n / 100 : n;
            };
            const sessionXpd = (flight || existingFlight)?.xplane_data || {};
            const preferredInsurancePlan = String(
              airplaneToUpdate?.insurance_plan
              || assignedAircraft?.insurance_plan
              || sessionXpd?.insurance_plan
              || ''
            ).trim().toLowerCase();
            const insuranceAircraftForCalc = {
              ...(airplaneToUpdate || {}),
              purchase_price: Number(airplaneToUpdate?.purchase_price || assignedAircraft?.purchase_price || 0),
              current_value: Number(airplaneToUpdate?.current_value || assignedAircraft?.current_value || 0),
              insurance_plan: preferredInsurancePlan || null,
              insurance_hourly_rate_pct: Number.isFinite(Number(airplaneToUpdate?.insurance_hourly_rate_pct))
                ? Number(airplaneToUpdate.insurance_hourly_rate_pct)
                : normalizeStoredPct(sessionXpd?.insurance_hourly_rate_pct),
              insurance_maintenance_coverage_pct: Number.isFinite(Number(airplaneToUpdate?.insurance_maintenance_coverage_pct))
                ? Number(airplaneToUpdate.insurance_maintenance_coverage_pct)
                : normalizeStoredPct(sessionXpd?.insurance_coverage_pct ?? sessionXpd?.insurance_maintenance_coverage_pct),
              insurance_score_bonus_pct: Number.isFinite(Number(airplaneToUpdate?.insurance_score_bonus_pct))
                ? Number(airplaneToUpdate.insurance_score_bonus_pct)
                : normalizeStoredPct(sessionXpd?.insurance_score_bonus_pct),
            };
            const resolvedInsurance = resolveAircraftInsurance(insuranceAircraftForCalc);
            const newFlightHours = (airplaneToUpdate?.total_flight_hours || 0) + flightHours;
            const depreciationPerHour = airplaneToUpdate?.depreciation_rate || 0.001;
            const newAircraftValue = Math.max(0, (airplaneToUpdate?.current_value || airplaneToUpdate?.purchase_price || 0) - (depreciationPerHour * flightHours * airplaneToUpdate?.purchase_price || 0));
            
            // Crash: -100 Punkte einmalig + 70% des Neuwertes Wartungskosten
            let crashMaintenanceCost = 0;
             if (hasCrashed) {
               crashMaintenanceCost = (airplaneToUpdate?.purchase_price || 0) * 0.7;
             }

            // Apply time bonus/penalty to final score - use the LIVE score from flightData
            // Bei Crash: Score ist IMMER 0, egal was flightData sagt
            // WICHTIG: Prüfe ob der Landing-Score schon in flightScore enthalten ist.
            // Wenn landingScoreChange gesetzt ist aber der Score noch bei 100 steht (Race Condition),
            // dann addiere den Landing-Score hier explizit.
            let adjustedFlightScore = finalFlightData.flightScore;
            const landingScoreChange = finalFlightData.landingScoreChange || 0;
            
            // Detect if landing score was NOT yet applied to flightScore
            // If flightScore is exactly 100 and we have a landing score change, it wasn't applied yet
            // Also check: if landingType is set but flightScore doesn't reflect the change
            if (landingScoreChange !== 0 && !finalFlightData._landingScoreApplied) {
              // Check if score seems like it hasn't been adjusted for landing yet
              // Simple heuristic: if no events reduced the score and it's still 100, landing wasn't applied
              const hasOtherPenalties = finalFlightData.events.tailstrike || finalFlightData.events.stall || 
                finalFlightData.events.overstress || finalFlightData.events.overspeed || 
                finalFlightData.events.flaps_overspeed || finalFlightData.events.high_g_force;
              
              if (adjustedFlightScore === 100 && !hasOtherPenalties) {
                adjustedFlightScore = Math.max(0, Math.min(100, adjustedFlightScore + landingScoreChange));
                console.log('🔧 Landing score was not applied yet, adding:', landingScoreChange, '-> new score:', adjustedFlightScore);
              }
            }
            
            const scoreWithTime = (hasCrashed || wrongAirport)
              ? 0
              : Math.max(0, Math.min(100, adjustedFlightScore + timeScoreChange - emergencyScorePenalty));

            const totalEventMaintenanceCost = finalFlightData.maintenanceCost;
            const totalMaintenanceCostWithCrash = totalEventMaintenanceCost + crashMaintenanceCost;
            const insuranceResult = calculateInsuranceForFlight({
              aircraft: insuranceAircraftForCalc,
              flightHours,
              maintenanceCost: totalMaintenanceCostWithCrash,
              companyReputation: company?.reputation || 50,
              baseScore: scoreWithTime,
            });
            const insuranceScoreBonus = Math.round(insuranceResult.scoreBonusPoints * 10) / 10;
            const scoreWithInsurance = (hasCrashed || wrongAirport)
              ? scoreWithTime
              : Math.max(0, Math.min(100, scoreWithTime + insuranceScoreBonus));
            const insuranceCost = Math.max(0, insuranceResult.insuranceCost);
            const insuranceCoveredMaintenance = Math.max(0, insuranceResult.maintenanceCovered);
            const maintenanceCostAfterInsurance = Math.max(0, insuranceResult.maintenanceAfterCoverage);
            const directCosts = fuelCost + crewCost + airportFee + insuranceCost;
            const profit = revenue - directCosts;

            // Calculate level bonus (1% per level auf den Gewinn)
            const levelBonusPercent = (company?.level || 1) * 0.01; // 1% pro Level
            const levelBonus = profit > 0 ? profit * levelBonusPercent : 0;

            console.log('🎯 SCORE:', { adj: adjustedFlightScore, time: timeScoreChange, finalBeforeInsurance: scoreWithTime, insuranceScoreBonus, final: scoreWithInsurance, crash: hasCrashed });

            // Calculate ratings based on score for database (for compatibility)
            const scoreToRating = (s) => (s / 100) * 5;

            // Fetch LATEST xplane_data from DB (local state may be stale, missing current flight_path)
            let existingXpData = activeFlight?.xplane_data || {};
            const freshFlights = await base44.entities.Flight.filter({ id: activeFlight.id });
            if (freshFlights[0]?.xplane_data) {
              existingXpData = freshFlights[0].xplane_data;
              xpData = freshFlights[0].xplane_data;
            }
            const liveXpData = xplaneLog?.raw_data || {};
            const preservedFlightPath = xpData.flight_path || finalFlightData.flight_path || existingXpData.flight_path || liveXpData.flight_path || [];
            const preservedFlightEventsLog = xpData.flight_events_log || finalFlightData.flight_events_log || existingXpData.flight_events_log || liveXpData.flight_events_log || [];
            const preservedBridgeEventLog = xpData.bridge_event_log || finalFlightData.bridge_event_log || existingXpData.bridge_event_log || liveXpData.bridge_event_log || [];
            const preservedTelemetryHistory = xpData.telemetry_history || existingXpData.telemetry_history || liveXpData.telemetry_history || [];
            const telemetryHistory = filterTelemetryHistoryForSession(preservedTelemetryHistory, sessionStartMs);
            const derivedLandingMetrics = deriveLandingMetricsFromTelemetry(telemetryHistory, activeFlight?.departure_time || activeFlight?.created_date);
            const preservedFmsWaypoints = xpData.fms_waypoints || existingXpData.fms_waypoints || liveXpData.fms_waypoints || [];
            const preservedSimbriefWaypoints = xpData.simbrief_waypoints || existingXpData.simbrief_waypoints || liveXpData.simbrief_waypoints || [];
            const preservedSimbriefRouteString = xpData.simbrief_route_string || existingXpData.simbrief_route_string || liveXpData.simbrief_route_string || null;
            const preservedSimbriefDepCoords = xpData.simbrief_departure_coords || existingXpData.simbrief_departure_coords || liveXpData.simbrief_departure_coords || null;
            const preservedSimbriefArrCoords = xpData.simbrief_arrival_coords || existingXpData.simbrief_arrival_coords || liveXpData.simbrief_arrival_coords || null;
            const existingLandingTrusted = !!(
              existingXpData.touchdown_detected ||
              existingXpData.landing_data_locked ||
              existingXpData.bridge_local_landing_locked ||
              existingXpData.landing_data_source === 'bridge_local'
            );
            const localLandingVs = Number(finalFlightData.landingVs || 0);
            const localLandingG = Number(finalFlightData.landingGForce || 0);
            const telemetryLandingVs = Number(derivedLandingMetrics?.landingVs || 0);
            const telemetryLandingG = Number(derivedLandingMetrics?.landingG || 0);
            const saveLandingTrusted = landingDataTrusted || existingLandingTrusted || localLandingVs > 0 || localLandingG > 0 || telemetryLandingVs > 0 || telemetryLandingG > 0;
            const resolvedTouchdownForSave = saveLandingTrusted
              ? (telemetryLandingVs > 0
                  ? telemetryLandingVs
                  : (localLandingVs > 0
                      ? localLandingVs
                  : Number(
                      xpData.touchdown_vspeed ||
                      liveData.touchdown_vspeed ||
                      0
                    )))
              : 0;
            const resolvedLandingGForSave = saveLandingTrusted
              ? (localLandingG > 0
                  ? localLandingG
                  : Number(
                      telemetryLandingG ||
                      xpData.landing_g_force ||
                      xpData.landingGForce ||
                      liveData.landing_g_force ||
                      liveData.landingGForce ||
                      0
                    ))
              : 0;
            const storedTouchdownVs = Math.max(0, Math.abs(Number(resolvedTouchdownForSave || 0) || 0));
            const storedLandingG = Math.max(0, Math.min(6, Number(resolvedLandingGForSave || 0)));
            const hasCrashedFinal = hasCrashed;
            const maintenanceCategories = MAINTENANCE_CATEGORY_KEYS;
            const flightDamage = maintenanceCategories.reduce((acc, key) => {
              acc[key] = 0;
              return acc;
            }, {});
            const addFlightDamage = (category, value) => {
              const n = Number(value || 0);
              if (!Number.isFinite(n) || n <= 0) return;
              flightDamage[category] = (flightDamage[category] || 0) + n;
            };

            const baseWearPerHour = 0.5;
            for (const cat of maintenanceCategories) {
              addFlightDamage(cat, baseWearPerHour * flightHours);
            }

            const latestThrustLever = readThrustLeverPct({ ...(xpData || {}), ...(liveXpData || {}) });
            const finalMaxG = Number(finalFlightData.maxGForce || 1);
            const thrustProfile = calcEngineThrustProfileSeconds(telemetryHistory, latestThrustLever);
            const highLoadSeconds = thrustProfile.fullSeconds;
            const totalFlightSeconds = Math.max(0, Number(flightHours || 0) * 3600);
            const engineThrustWear = calcEngineWearFromThrustProfile(highLoadSeconds, totalFlightSeconds, thrustProfile.knownSeconds);
            const engineHighGWear = calcEngineWearFromHighG(finalMaxG);
            const engineHardLandingWear = calcEngineWearFromHardLanding(storedLandingG);
            const finalEvents = finalFlightData.events || {};
            const engineEventWear = (finalEvents.high_g_force ? HIGH_G_FORCE_ENGINE_EVENT_WEAR : 0) + (finalEvents.hard_landing ? HARD_LANDING_ENGINE_EVENT_WEAR : 0);
            const extraEngineWear = engineThrustWear.totalWear + engineHighGWear + engineHardLandingWear + engineEventWear;
            addFlightDamage('engine', extraEngineWear);

            const finalControlInput = clamp(Number(finalFlightData.maxControlInput || 0), 0, 1);
            const landingGearImpactWear = calcLandingGearWearFromLandingG(storedLandingG);
            const avionicsLandingWear = calcAvionicsWearFromLandingG(storedLandingG);
            const airframeHighGWear = calcAirframeWearFromHighG(finalMaxG);
            const avionicsHighGWear = calcAvionicsWearFromHighG(finalMaxG);
            const controlsWear = calcFlightControlsWearFromControlInput(finalControlInput);
            const hydraulicsFromControls = controlsWear * 0.35;
            const hydraulicsFromLanding = calcHydraulicsWearFromLandingImpact(landingGearImpactWear);
            const electricalHeatWear = calcElectricalWearFromEngineHighLoadSeconds(highLoadSeconds);
            const electricalControlWear = calcElectricalWearFromControlInput(finalControlInput);
            const highAltitudeSeconds = calcConditionSecondsFromTelemetry({
              telemetryHistory,
              currentSampleValue: firstFiniteNumber(
                liveXpData?.altitude,
                liveXpData?.alt,
                xpData?.altitude,
                xpData?.alt
              ),
              predicate: (curPt, prevPt) => {
                const curAlt = firstFiniteNumber(curPt?.value, readAltitudeFt(curPt));
                const prevAlt = readAltitudeFt(prevPt);
                const effectiveAlt = Number.isFinite(curAlt) ? curAlt : prevAlt;
                return Number.isFinite(effectiveAlt) && effectiveAlt >= 10000;
              },
            });
            const pressureWear = calcPressurizationWearFromHighAltSeconds(highAltitudeSeconds);

            addFlightDamage('landing_gear', landingGearImpactWear);
            addFlightDamage('airframe', airframeHighGWear);
            addFlightDamage('avionics', avionicsHighGWear);
            addFlightDamage('avionics', avionicsLandingWear);
            addFlightDamage('flight_controls', controlsWear);
            addFlightDamage('hydraulics', hydraulicsFromControls);
            addFlightDamage('hydraulics', hydraulicsFromLanding);
            addFlightDamage('electrical', electricalHeatWear);
            addFlightDamage('electrical', electricalControlWear);
            addFlightDamage('pressurization', pressureWear);

            if (finalFlightData.events.tailstrike) addFlightDamage('airframe', 10);
            if (finalFlightData.events.overstress) addFlightDamage('airframe', OVERSTRESS_AIRFRAME_WEAR);
            if (finalFlightData.events.overspeed) {
              addFlightDamage('airframe', OVERSPEED_AIRFRAME_WEAR);
              addFlightDamage('avionics', OVERSPEED_AVIONICS_WEAR);
              addFlightDamage('electrical', OVERSPEED_ELECTRICAL_WEAR);
            }
            if (finalFlightData.events.gear_up_landing) addFlightDamage('landing_gear', 25);
            if (finalFlightData.events.high_g_force) {
              addFlightDamage('airframe', HIGH_G_FORCE_AIRFRAME_EVENT_WEAR);
              addFlightDamage('avionics', HIGH_G_FORCE_AVIONICS_EVENT_WEAR);
            }
            if (finalFlightData.events.flaps_overspeed) addFlightDamage('flight_controls', 10);

            if (hasCrashedFinal) {
              const existingCats = normalizeMaintenanceCategoryMap(airplaneToUpdate?.maintenance_categories);
              for (const cat of maintenanceCategories) {
                const currentWear = Number(existingCats[cat] || 0);
                const nonCrashFlightWear = Number(flightDamage[cat] || 0);
                const projectedWear = Math.min(100, currentWear + nonCrashFlightWear);
                addFlightDamage(cat, Math.max(0, 100 - projectedWear));
              }
            }

            const roundedFlightDamage = {};
            for (const cat of maintenanceCategories) {
              roundedFlightDamage[cat] = Number((flightDamage[cat] || 0).toFixed(2));
            }

            await base44.entities.Flight.update(activeFlight.id, {
               status: (hasCrashedFinal || wrongAirport) ? 'failed' : 'completed',
               arrival_time: new Date().toISOString(),
               flight_score: scoreWithInsurance,
               takeoff_rating: scoreToRating(scoreWithInsurance),
               flight_rating: scoreToRating(scoreWithInsurance),
               landing_rating: scoreToRating(scoreWithInsurance),
               overall_rating: scoreToRating(scoreWithInsurance),
               landing_vs: storedTouchdownVs,
               max_g_force: finalFlightData.maxGForce,
               fuel_used_liters: fuelUsed,
               fuel_cost: fuelCost,
               crew_cost: crewCost,
               maintenance_cost: (flightHours * maintenanceCostPerHour) + maintenanceCostAfterInsurance,
                flight_duration_hours: flightHours,
                revenue,
                profit,
                maintenance_damage: roundedFlightDamage,
                passenger_comments: generatePassengerComments(scoreWithInsurance, finalFlightData, lang),
                xplane_data: {
                  ...finalFlightData,
                 landing_g_force: storedLandingG,
                 touchdown_vspeed: storedTouchdownVs,
                 touchdown_detected: saveLandingTrusted && (storedTouchdownVs > 0 || storedLandingG > 0),
                 flight_path: preservedFlightPath,
                 flight_events_log: preservedFlightEventsLog,
                 bridge_event_log: preservedBridgeEventLog,
                 telemetry_history: telemetryHistory,
                 fms_waypoints: preservedFmsWaypoints,
                 simbrief_waypoints: preservedSimbriefWaypoints,
                 simbrief_route_string: preservedSimbriefRouteString,
                 simbrief_departure_coords: preservedSimbriefDepCoords,
                 simbrief_arrival_coords: preservedSimbriefArrCoords,
                 departure_lat: existingXpData.departure_lat || finalFlightData.departure_lat || 0,
                 departure_lon: existingXpData.departure_lon || finalFlightData.departure_lon || 0,
                 arrival_lat: existingXpData.arrival_lat || finalFlightData.arrival_lat || 0,
                 arrival_lon: existingXpData.arrival_lon || finalFlightData.arrival_lon || 0,
                 // Completion metadata
                 final_score: scoreWithInsurance,
                 flightHours,
                 timeScoreChange,
                 timeBonus,
                 madeDeadline,
                 deadlineMinutes,
                 totalRevenue: contract?.payout || 0,
                 landingBonus: landingBonusUsed,
                 landingPenalty: landingPenaltyUsed,
                 levelBonus: levelBonus,
                 levelBonusPercent: levelBonusPercent * 100,
                 companyLevel: company?.level || 1,
                 crewBonus: crewBonusAmount,
                 insurance_plan: resolvedInsurance.planKey,
                 insurance_hourly_cost: Math.round(insuranceResult.hourlyCost * 100) / 100,
                 insurance_cost: Math.round(insuranceCost * 100) / 100,
                 insurance_coverage_pct: Math.round(insuranceResult.maintenanceCoveragePct * 100),
                 insurance_covered_maintenance: Math.round(insuranceCoveredMaintenance * 100) / 100,
                 insurance_score_bonus_pct: Math.round(insuranceResult.scoreBonusPct * 100),
                 insurance_score_bonus_points: insuranceScoreBonus,
                 arrival_distance_nm: hasArrivalCoords && hasCurrentCoords ? Math.round(arrivalDistanceNm * 10) / 10 : null,
                 landed_too_far_from_arrival: landedTooFarFromArrival,
                  emergency_landing_declared: !!emergencyLanding,
                  emergency_off_airport_completion: emergencyOffAirportCompletion,
                  emergency_score_penalty: emergencyScorePenalty,
                  emergency_payout_factor: emergencyOffAirportCompletion ? 0.3 : 1.0,
                  events: finalFlightData.events,
                  maintenance_damage: roundedFlightDamage,
                  crashMaintenanceCost: crashMaintenanceCost
                }
              });

            // Update contract
            console.log('Aktualisiere Contract Status:', activeFlight.contract_id, (hasCrashedFinal || wrongAirport) ? 'failed' : 'completed');
            await base44.entities.Contract.update(activeFlight.contract_id, { status: (hasCrashedFinal || wrongAirport) ? 'failed' : 'completed' });

            // Maintenance/repair cost is now derived purely from wear (% of new value).
            // The legacy accumulated_maintenance_cost pool is no longer written.

            // Update aircraft with depreciation, crash status, and maintenance costs
            if (activeFlight?.aircraft_id) {
              try {
                const existingCats = normalizeMaintenanceCategoryMap(airplaneToUpdate?.maintenance_categories);
                const updatedCats = { ...existingCats };
                for (const [cat, dmg] of Object.entries(roundedFlightDamage)) {
                  updatedCats[cat] = Math.min(100, (updatedCats[cat] || 0) + dmg);
                }
                if (hasCrashed) {
                  for (const cat of Object.keys(updatedCats)) {
                    updatedCats[cat] = 100; // Everything maxed on crash
                  }
                }
                const permanentFallbackFromUsed = Math.max(
                  0,
                  Math.min(100, Number(airplaneToUpdate?.used_permanent_avg || 0))
                );
                const storedPermanentCats = normalizeMaintenanceCategoryMap(airplaneToUpdate?.permanent_wear_categories, 0);
                const listingPermanentCats = normalizeMaintenanceCategoryMap(airplaneToUpdate?.used_listing_permanent_wear_categories, 0);
                const hasStoredPermanentCats = maintenanceCategories.some((key) => Number(storedPermanentCats?.[key] || 0) > 0);
                const hasListingPermanentCats = maintenanceCategories.some((key) => Number(listingPermanentCats?.[key] || 0) > 0);
                const existingPermanentCats = hasStoredPermanentCats
                  ? storedPermanentCats
                  : (hasListingPermanentCats
                    ? listingPermanentCats
                    : resolvePermanentWearCategories(
                      airplaneToUpdate?.permanent_wear_categories,
                      permanentFallbackFromUsed
                    ));
                const updatedPermanentCats = {};
                const eventsForPermanent = finalFlightData?.events || {};
                // Permanent wear grows linearly with the wear added during this flight (1:1).
                // 100% added wear → +100% permanent wear in that category, capped at 100.
                for (const cat of maintenanceCategories) {
                  const permanent = Number(existingPermanentCats?.[cat] || 0);
                  const safePermanent = Number.isFinite(permanent) ? Math.max(0, permanent) : 0;
                  const addedWear = Math.max(0, Number(roundedFlightDamage?.[cat] || 0));
                  const nextPermanent = hasCrashed
                    ? 100
                    : Math.max(0, Math.min(100, safePermanent + addedWear));
                  updatedPermanentCats[cat] = Math.round(nextPermanent * 100) / 100;
                  if (!Number.isFinite(Number(updatedCats?.[cat]))) {
                    updatedCats[cat] = 0;
                  }
                }
                void eventsForPermanent;

                // Determine aircraft status based on updated categories
                let newAircraftStatus = 'available';
                if (hasCrashed) {
                  newAircraftStatus = 'damaged';
                } else {
                  const catVals = maintenanceCategories.map((cat) => {
                    const dynamicWear = Number(updatedCats?.[cat] || 0);
                    const permanentWear = Number(updatedPermanentCats?.[cat] || 0);
                    return Math.max(0, dynamicWear) + Math.max(0, permanentWear);
                  });
                  const maxCatWear = Math.max(...catVals);
                  const avgCatWear = catVals.reduce((a, b) => a + b, 0) / catVals.length;
                  if (maxCatWear > 75 || avgCatWear > 50) {
                    newAircraftStatus = 'maintenance';
                  }
                }

                const aircraftUpdate = {
                  status: newAircraftStatus,
                  total_flight_hours: newFlightHours,
                  current_value: hasCrashed ? 0 : Math.max(0, newAircraftValue),
                  maintenance_categories: updatedCats,
                  permanent_wear_categories: updatedPermanentCats
                };

                console.log('🛩️ AKTUALISIERE FLUGZEUG JETZT:', activeFlight.aircraft_id, aircraftUpdate);
                await base44.entities.Aircraft.update(activeFlight.aircraft_id, aircraftUpdate);
                console.log('✅ FLUGZEUG AKTUALISIERT');
               } catch (error) {
                 console.error('❌ FEHLER BEI FLUGZEUG UPDATE:', error);
                 throw error;
               }
            } else {
              console.error('❌ KEIN FLUGZEUG GEFUNDEN FÜR UPDATE:', activeFlight);
            }

            // Crew updates removed (employee system replaced by type ratings)

            // Calculate actual balance change (revenue - direct costs + level bonus)
            const actualProfit = profit + levelBonus;

            // Update company - only deduct direct costs (fuel, crew, airport)
            if (company) {
              // Reputation based on score (0-100)
              const reputationChange = (hasCrashed || wrongAirport) ? -10 : Math.round((scoreWithInsurance - 85) / 5);
              
              // XP curve: exp until Lvl 30, linear after, to keep late-game achievable
              const calculateXPForLevel = (level) => { if (level <= 30) return Math.round(100 * Math.pow(1.1, level - 1)); const b = Math.round(100 * Math.pow(1.1, 29)); return b + Math.round(b * 0.05) * (level - 30); };
              const calculateLevelUpBonus = (lvl) => { if (lvl <= 30) return Math.round(1000 * Math.pow(1.5, lvl - 1)); const b = Math.round(1000 * Math.pow(1.5, 29)); return b + Math.round(b * 0.05) * (lvl - 30); };
              const earnedXP = Math.round(scoreWithInsurance);
              let currentLevel = company.level || 1;
              let currentXP = (company.experience_points || 0) + earnedXP;
              let totalLevelUpBonus = 0;
              while (currentXP >= calculateXPForLevel(currentLevel)) {
                currentXP -= calculateXPForLevel(currentLevel);
                currentLevel++;
                // One-time exponential bonus for leveling up
                const bonus = calculateLevelUpBonus(currentLevel);
                totalLevelUpBonus += bonus;
                console.log(`🎉 LEVEL UP! Level ${currentLevel} - Bonus: $${bonus.toLocaleString()}`);
              }

              const _aL = company.active_loan || null; const _lRate = Math.max(0, Number(_aL?.monthly_payment || 0)); const _lRemB = Math.max(0, Number(_aL?.remaining || 0)); const loanPay = (_aL && _lRemB > 0 && _lRate > 0) ? Math.min(_lRate, _lRemB) : 0; const newLoanRem = Math.max(0, _lRemB - loanPay); const _cu = { balance: (company.balance || 0) + actualProfit + totalLevelUpBonus - loanPay, reputation: Math.min(100, Math.max(0, (company.reputation || 50) + reputationChange)), level: currentLevel, experience_points: currentXP, total_flights: (company.total_flights || 0) + 1, total_passengers: (company.total_passengers || 0) + (contract?.passenger_count || 0), total_cargo_kg: (company.total_cargo_kg || 0) + (contract?.cargo_weight_kg || 0) };
              if (_aL) _cu.active_loan = newLoanRem <= 0 ? null : { ..._aL, remaining: newLoanRem };
              await base44.entities.Company.update(company.id, _cu);
              if (loanPay > 0) { try { const _fr = (await base44.entities.Flight.filter({ id: activeFlight.id }))[0]; await base44.entities.Flight.update(activeFlight.id, { xplane_data: { ...(_fr?.xplane_data || {}), loan_payment: loanPay, loan_remaining_after: newLoanRem, loan_fully_paid: newLoanRem <= 0 } }); } catch (_) {} }
              await base44.entities.Transaction.create({ company_id: company.id, type: 'income', category: 'flight_revenue', amount: actualProfit, description: `Flug: ${contract?.title}${levelBonus > 0 ? ` (Levelbonus +${Math.round(levelBonus)})` : ''}`, reference_id: activeFlight?.id, date: new Date().toISOString() });
              if (loanPay > 0) { await base44.entities.Transaction.create({ company_id: company.id, type: 'expense', category: 'other', amount: loanPay, description: newLoanRem <= 0 ? 'Kreditrate (Flug) - Kredit vollständig getilgt' : `Kreditrate (Flug) - Restschuld $${Math.round(newLoanRem).toLocaleString()}`, reference_id: activeFlight?.id, date: new Date().toISOString() }); }

              // Create separate transaction for level-up bonus
              if (totalLevelUpBonus > 0) {
                await base44.entities.Transaction.create({
                  company_id: company.id,
                  type: 'income',
                  category: 'bonus',
                  amount: totalLevelUpBonus,
                  description: `Level-Up Bonus! Neues Level: ${currentLevel} (+$${totalLevelUpBonus.toLocaleString()})`,
                  reference_id: activeFlight?.id,
                  date: new Date().toISOString()
                });
              }
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            const updatedAircraft = await base44.entities.Aircraft.filter({ id: activeFlight.aircraft_id });
            console.log('✅ Aircraft nach Update:', updatedAircraft[0]);
            await queryClient.invalidateQueries({ queryKey: ['aircraft'] });
            // Evaluate achievements + grant one-time XP/cash rewards. Reads the
            // freshest company snapshot inside (after we wrote XP/balance above).
            try { const _freshC = (await base44.entities.Company.filter({ id: company.id }))[0] || company; await processAchievementsAfterFlight({ company: _freshC, flight: { id: activeFlight.id } }); } catch (achErr) { console.warn('Achievement processing failed (non-fatal):', achErr); }
            const updatedFlightFromDB = await base44.entities.Flight.filter({ id: activeFlight.id });
            return updatedFlightFromDB[0];
    },
    onSuccess: async (updatedFlight) => {
      if (!updatedFlight) { setShowAutoCompleteOverlay(false); return; }
      await queryClient.refetchQueries({ queryKey: ['aircraft'] });
      await queryClient.invalidateQueries({ queryKey: ['company'] });
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      // Show animation overlay; user clicks "Continue" to navigate to result page.
      setCompletedFlightForAnim(updatedFlight);
      setShowAutoCompleteOverlay(false);
    },
    onError: (error) => { console.error('Flight completion error:', error); setIsCompletingFlight(false); setShowAutoCompleteOverlay(false); }
  });

  useEffect(() => {
    return () => {
      if (autoCompleteTimeoutRef.current) {
        clearTimeout(autoCompleteTimeoutRef.current);
      }
    };
  }, []);

  // Update flight duration every second
  useEffect(() => {
    if (flightPhase === 'preflight' || flightPhase === 'completed' || !flightStartTime) return;
    
    const timer = setInterval(() => {
      setFlightDurationSeconds(Math.floor((Date.now() - flightStartTime) / 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [flightPhase, flightStartTime]);

  // Update flight data from X-Plane log (freeze data after landing)
  useEffect(() => {
    if (!xplaneLog?.raw_data) return;
    // Only block in preflight AND completed
    if (flightPhase === 'preflight' || flightPhase === 'completed') return;

    // Only filter by timestamp if flightStartedAt is set (from startFlightMutation, not from existingFlight restore)
    // This prevents blocking data that's already on the Flight record when restoring an existing flight
    if (flightStartedAt && xplaneLog.created_date) {
      const logTime = new Date(xplaneLog.created_date).getTime();
      if (logTime < flightStartedAt) {
        return; // Altes Log ignorieren
      }
    }

    const xp = xplaneLog.raw_data;

    const crashSignal = !!(xp.simconnect_crash_event || xp.simconnectCrashEvent);

    setFlightData(prev => {
      const currentGForce = xp.g_force || 1.0;
      const newMaxControlInput = Math.max(prev.maxControlInput, xp.control_input || 0);

      // Track airborne state for THIS contract only; ignore stale payload flags.
      const airborneEvidence = !xp.on_ground && (
        Number(xp.speed || 0) > 35 ||
        Math.abs(Number(xp.vertical_speed || 0)) > 200
      );
      const activeFlight = flight || existingFlight;
      const parseMs = (v) => {
        const ms = Date.parse(String(v || ""));
        return Number.isFinite(ms) ? ms : NaN;
      };
      const sessionStartMs = parseMs(activeFlight?.departure_time || activeFlight?.created_date);
      const backendAirborneMs = parseMs(xp.airborne_started_at || xp.completion_armed_at);
      const backendAirborneFlags = !!(xp.completion_armed || xp.was_airborne);
      const backendAirborneInSession =
        backendAirborneFlags &&
        Number.isFinite(sessionStartMs) &&
        Number.isFinite(backendAirborneMs) &&
        backendAirborneMs >= (sessionStartMs - 5000);
      const backendAirborneArmed = backendAirborneInSession || (!xp.on_ground && !!xp.completion_armed);
      // Never arm airborne from backend flags while currently on ground.
      // This blocks stale session flags from instantly completing a new flight.
      const newWasAirborne = prev.wasAirborne || airborneEvidence || (!xp.on_ground && backendAirborneArmed);

      // KRITISCH: Solange nicht abgehoben, keine Events/Kosten/Scores verarbeiten
      if (!newWasAirborne) {
        // Use current position as departure if not set yet
        const curLat = (xp.latitude !== undefined && xp.latitude !== null) ? xp.latitude : prev.latitude;
        const curLon = (xp.longitude !== undefined && xp.longitude !== null) ? xp.longitude : prev.longitude;
        
        const groundData = {
          ...prev,
          altitude: xp.altitude || prev.altitude,
          speed: xp.speed || prev.speed,
          verticalSpeed: xp.vertical_speed || prev.verticalSpeed,
          heading: xp.heading || prev.heading,
          fuel: xp.fuel_percentage || prev.fuel,
          fuelKg: xp.fuel_kg || prev.fuelKg,
          gForce: currentGForce,
          latitude: curLat,
          longitude: curLon,
          departure_lat: prev.departure_lat || xp.departure_lat || curLat || 0,
          departure_lon: prev.departure_lon || xp.departure_lon || curLon || 0,
          arrival_lat: prev.arrival_lat || xp.arrival_lat || 0,
          arrival_lon: prev.arrival_lon || xp.arrival_lon || 0,
          events: {
            tailstrike: false, stall: false, overstress: false, overspeed: false,
            flaps_overspeed: false, fuel_emergency: false, gear_up_landing: false,
            crash: false, harsh_controls: false, high_g_force: false, hard_landing: false, wrong_airport: false
          },
          wasAirborne: false,
        };
        flightDataRef.current = groundData;
        return groundData;
      }

      // Ab hier: Flugzeug WAR in der Luft - normale Verarbeitung
      const newMaxGForce = Math.max(prev.maxGForce, currentGForce);

      // Landing detection based on vertical speed
      const currentSpeed = xp.speed || 0;
      const landingDataTrusted = !!(
        xp.touchdown_detected ||
        xp.landing_data_locked ||
        xp.bridge_local_landing_locked ||
        xp.landing_data_source === 'bridge_local'
      );
      // Ensure we capture landing VS properly - preserve after landing
      const touchdownVsRaw = prev.landingType
        ? prev.landingVs  // Already landed - keep the captured value
        : ((xp.on_ground && newWasAirborne && landingDataTrusted)
            ? (xp.touchdown_vspeed || 0)
            : 0);
      const touchdownVs = Math.max(0, Math.abs(Number(touchdownVsRaw || 0) || 0));
      // Landing G-force: Capture the ACTUAL g-force at touchdown moment
      // NOT the peak g-force during the entire flight
      // Once landed (landingType set), preserve the captured value
      let landingGForceValue;
      if (prev.landingType) {
        landingGForceValue = prev.landingGForce; // Already landed - keep captured value
      } else if (xp.on_ground && newWasAirborne && landingDataTrusted) {
        // Use only measured touchdown G from backend/bridge and preserve once captured.
        const reportedLandingG = Number(xp.landing_g_force || 0);
        landingGForceValue = reportedLandingG > 0 ? Math.min(6, reportedLandingG) : Number(prev.landingGForce || 0);
      } else {
        // Still airborne (or false on_ground glitch) - do not synthesize landing G.
        landingGForceValue = 0;
      }
      const nextLandingVs = prev.landingType
        ? Number(prev.landingVs || 0)
        : ((xp.on_ground && newWasAirborne && landingDataTrusted && touchdownVs > 0)
            ? touchdownVs
            : Number(prev.landingVs || 0));

      // Landing categories based on G-force only
      let landingType = prev.landingType;
      let landingScoreChange = prev.landingScoreChange || 0;
      let landingMaintenanceCost = prev.landingMaintenanceCost || 0;
      let landingBonus = prev.landingBonus || 0;

       // Get aircraft for maintenance cost calculations (purchase price is neuwert)
       // Use flight.aircraft_id if available, otherwise try to find from aircraft list
       const aircraftId = flight?.aircraft_id;
       const currentAircraft = aircraft?.find(a => a.id === aircraftId);
       const aircraftPurchasePrice = currentAircraft?.purchase_price || 1000000; // fallback price if not found

      if (landingGForceValue > 0 && xp.on_ground && newWasAirborne && landingDataTrusted && !prev.events.crash && !prev.landingType) {
        const gForce = landingGForceValue;
        // Revenue = contract payout (Gesamteinnahmen)
        const totalRevenue = contract?.payout || 0;

        if (gForce < 1.0) {
          landingType = 'butter';
          landingScoreChange = 40;
          landingBonus = totalRevenue * 4; // 4x Gesamteinnahmen
        } else if (gForce < 1.2) {
          landingType = 'soft';
          landingScoreChange = 20;
          landingBonus = totalRevenue * 2; // 2x Gesamteinnahmen
        } else if (gForce < 1.6) {
          landingType = 'acceptable';
          landingScoreChange = 5;
          landingBonus = 0; // $0
        } else if (gForce < 2.0) {
          landingType = 'hard';
          landingScoreChange = -30;
          landingMaintenanceCost = totalRevenue * 0.25; // -25% der Gesamteinnahmen
        } else {
          landingType = 'very_hard';
          landingScoreChange = -50;
          landingMaintenanceCost = totalRevenue * 0.5; // -50% der Gesamteinnahmen
        }
      }
      
      // Gear-up landing: -35 Punkte + 15% Wartungskosten vom Neuwert
      if (xp.gear_up_landing && !prev.events.gear_up_landing) {
        landingScoreChange -= 35;
        landingMaintenanceCost += aircraftPurchasePrice * 0.15;
      }

      // Crash nur wenn tatsächlich abgehoben war
      const isCrashArmed = newWasAirborne;
      const isCrash = (landingType === 'crash' || prev.events.crash || (crashSignal && isCrashArmed)) && isCrashArmed;
      
      // Calculate score penalties - only deduct when NEW event occurs
      let baseScore = prev.flightScore;
      
      // Landungs-Score hinzufügen/abziehen (nur wenn sich landingType gerade geändert hat)
      if (landingType && !prev.landingType) {
        baseScore = Math.max(0, Math.min(100, baseScore + landingScoreChange));
      }

      // Track if high G-force event already happened
      const hadHighGEvent = prev.events.high_g_force || false;

      // Calculate maintenance cost increase based on NEW events only
      let maintenanceCostIncrease = landingMaintenanceCost;

      // Log landing quality calculations for debugging
      if (landingType && !prev.landingType) {
        console.log('🎯 LANDUNGSQUALITÄT ERKANNT:', {
          landingType,
          gForce: landingGForceValue,
          landingScoreChange,
          landingMaintenanceCost,
          landingBonus
        });
      }
      
      // Heckaufsetzer (Tailstrike): -20 Punkte + 2% des Neuwertes
      if (xp.tailstrike && !prev.events.tailstrike) {
        baseScore = Math.max(0, baseScore - 20);
        maintenanceCostIncrease += aircraftPurchasePrice * 0.02;
      }
      
      // Stall: -50 Punkte (keine Wartungskosten) - erkennen über mehrere Datarefs
      if ((xp.stall || xp.is_in_stall || xp.stall_warning || xp.override_alpha) && !prev.events.stall) {
        console.log('⚠️ STALL ERKANNT:', { stall: xp.stall, is_in_stall: xp.is_in_stall, stall_warning: xp.stall_warning, override_alpha: xp.override_alpha });
        baseScore = Math.max(0, baseScore - 50);
      }
      
      // G-Kräfte ab 1.5: -10 Punkte pro G-Stufe + Wartungskosten
      if (newMaxGForce >= 1.5) {
        // Erster Überschreitung bei 1.5G
        if (!hadHighGEvent && !prev.events.high_g_force) {
          baseScore = Math.max(0, baseScore - 10);
          maintenanceCostIncrease += aircraftPurchasePrice * 0.01;
        }
        
        const currentGLevel = Math.floor(newMaxGForce);
        const prevGLevel = Math.floor(prev.maxGForce);
        
        if (currentGLevel > prevGLevel && currentGLevel >= 2) {
          for (let gLevel = Math.max(2, prevGLevel + 1); gLevel <= currentGLevel; gLevel++) {
            if (!processedGLevels.has(gLevel)) {
              const gForceMaintenanceCost = aircraftPurchasePrice * (gLevel * 0.01);
              maintenanceCostIncrease += gForceMaintenanceCost;
              baseScore = Math.max(0, baseScore - 10);
            }
          }
        }
      }
      
      // Strukturschaden (overstress): -30 Punkte + 1.5% des Neuwertes, einmalig
      if (xp.overstress && !prev.events.overstress) {
        baseScore = Math.max(0, baseScore - 30);
        maintenanceCostIncrease += aircraftPurchasePrice * (OVERSTRESS_MAINTENANCE_PERCENT / 100);
      }
      
      // Overspeed: -15 Punkte
      if (xp.overspeed && !prev.events.overspeed) {
        baseScore = Math.max(0, baseScore - 15);
        maintenanceCostIncrease += aircraftPurchasePrice * (OVERSPEED_MAINTENANCE_PERCENT / 100);
      }
      
      // Flaps Overspeed: Score-Abzug + Wartungskosten basierend auf Settings
      // Also detect flaps overspeed from flap_ratio + speed if plugin doesn't send flaps_overspeed flag
      const airframeFailureActive = !!(prev.events.failure_airframe || xp.manual_airframe_failure_test);
      const flapsOverspeedDetected = airframeFailureActive ? false : (xp.flaps_overspeed || false);
      if (flapsOverspeedDetected && !prev.events.flaps_overspeed) {
        const flapsScorePenalty = settings?.flaps_overspeed_score_penalty || 15;
        const flapsMaintenancePercent = settings?.flaps_overspeed_maintenance_percent || 2.5;
        baseScore = Math.max(0, baseScore - flapsScorePenalty);
        maintenanceCostIncrease += aircraftPurchasePrice * (flapsMaintenancePercent / 100);
      }
      
      // Crash: -100 Punkte einmalig + 70% des Neuwertes Wartungskosten werden vom Flug berechnet
      if (isCrash && !prev.events.crash) {
        baseScore = Math.max(0, baseScore - 100);
        // Crash-Wartungskosten werden in completeFlightMutation berechnet
      }
      
      // Store departure/arrival coordinates from first X-Plane data
      // Use current lat/lon properly (don't use || which treats 0 as falsy)
      const curLat = (xp.latitude !== undefined && xp.latitude !== null) ? xp.latitude : prev.latitude;
      const curLon = (xp.longitude !== undefined && xp.longitude !== null) ? xp.longitude : prev.longitude;
      const depLat = prev.departure_lat || xp.departure_lat || 0;
      const depLon = prev.departure_lon || xp.departure_lon || 0;
      const arrLat = prev.arrival_lat || xp.arrival_lat || 0;
      const arrLon = prev.arrival_lon || xp.arrival_lon || 0;
      
      // Merge events: backend xplane_data events are authoritative (once true, always true)
      // Local detection adds to them but never overrides true->false
      const mergedEvents = {
        tailstrike: !!(xp.tailstrike || prev.events.tailstrike),
        stall: !!(xp.stall || xp.is_in_stall || xp.stall_warning || xp.override_alpha || prev.events.stall),
        overstress: !!(xp.overstress || prev.events.overstress),
        overspeed: !!(xp.overspeed || prev.events.overspeed),
        flaps_overspeed: !!(flapsOverspeedDetected || prev.events.flaps_overspeed),
        fuel_emergency: !!(xp.fuel_emergency || prev.events.fuel_emergency),
        gear_up_landing: !!(xp.gear_up_landing || prev.events.gear_up_landing),
        crash: !!isCrash,
        harsh_controls: !!(xp.harsh_controls || prev.events.harsh_controls),
        high_g_force: !!(newMaxGForce >= 1.5 || prev.events.high_g_force),
        hard_landing: !!(landingType === 'hard' || landingType === 'very_hard' || prev.events.hard_landing),
        wrong_airport: !!(prev.events.wrong_airport),
        failure_engine: !!(((newWasAirborne || xp.completion_armed) && xp.manual_engine_failure_test) || prev.events.failure_engine),
        failure_electrical: !!(((newWasAirborne || xp.completion_armed) && xp.manual_electrical_failure_test) || prev.events.failure_electrical),
        failure_avionics: !!(((newWasAirborne || xp.completion_armed) && xp.manual_avionics_failure_test) || prev.events.failure_avionics),
        failure_landing_gear: !!(((newWasAirborne || xp.completion_armed) && xp.manual_landing_gear_failure_test) || prev.events.failure_landing_gear),
        failure_airframe: !!(((newWasAirborne || xp.completion_armed) && xp.manual_airframe_failure_test) || prev.events.failure_airframe),
      };

      const newData = {
        altitude: xp.altitude || prev.altitude,
        speed: xp.speed || prev.speed,
        verticalSpeed: xp.vertical_speed || prev.verticalSpeed,
        heading: xp.heading || prev.heading,
        fuel: xp.fuel_percentage || prev.fuel,
        fuelKg: xp.fuel_kg || prev.fuelKg,
        gForce: currentGForce,
        maxGForce: newMaxGForce,
        landingGForce: landingGForceValue,
        landingVs: nextLandingVs,
        landingType: landingType,
        landingScoreChange: landingScoreChange,
        landingMaintenanceCost: landingMaintenanceCost,
        landingBonus: landingBonus,
        flightScore: baseScore,
        maintenanceCost: prev.maintenanceCost + maintenanceCostIncrease,
        reputation: xp.reputation || prev.reputation,
        latitude: curLat,
        longitude: curLon,
        departure_lat: depLat,
        departure_lon: depLon,
        arrival_lat: arrLat,
        arrival_lon: arrLon,
        events: mergedEvents,
        maxControlInput: newMaxControlInput,
        wasAirborne: newWasAirborne,
        previousSpeed: currentSpeed
      };
      flightDataRef.current = newData;
      if (newMaxGForce >= 1.5) { const cl = Math.floor(newMaxGForce); setProcessedGLevels(p => { const u = new Set(p); for (let g = 2; g <= cl; g++) u.add(g); return u; }); }
      return newData;
      });

      // Auto-detect phase - ERST wenn tatsächlich abgehoben (!on_ground)
    if (flightPhase === 'takeoff' && !xp.on_ground && xp.altitude > 10) {
      setFlightPhase('cruise');
      // Setze Flugstart-Zeit erst beim tatsächlichen Abheben
      if (!flightStartTime) {
        setFlightStartTime(Date.now());
      }
    } else if (flightPhase === 'cruise') {
      if (xp.vertical_speed < -200) {
        setFlightPhase('landing');
      }
    }

    // Landung erkannt: Flugzeug war in der Luft und ist jetzt auf dem Boden
    // Erlaube Abschluss in ALLEN aktiven Flugphasen (takeoff, cruise, landing)
    const isActivePhase = flightPhase === 'takeoff' || flightPhase === 'cruise' || flightPhase === 'landing';
    
    // Use the freshest synchronized state (ref) to avoid stale React-state races.
    const latestFlightData = flightDataRef.current || flightData;

    // flightStartTime kann null sein wenn der Flug wiederhergestellt wurde - dann setze es jetzt
    if (latestFlightData.wasAirborne && !flightStartTime) {
      setFlightStartTime(Date.now());
    }
    
    // Auto-complete trigger: require backend arming to avoid stale on_ground completions right after takeoff.
    const isReadyToComplete = xp.on_ground && latestFlightData.wasAirborne && !!xp.completion_armed;
    if (isReadyToComplete && (flightPhase === 'takeoff' || flightPhase === 'cruise' || flightPhase === 'landing') && !completeFlightMutation.isPending && !isCompletingFlight) {
      // Check distance to arrival airport (>=10 NM without emergency = failed)
      const simbriefArr = xp.simbrief_arrival_coords || xplaneLog?.raw_data?.simbrief_arrival_coords || simbriefRoute?.arrival_coords || null;
      const contractArrival = getAirportCoords(contract?.arrival_airport);
      const arrivalPos = pickFirstValidLatLon([
            [latestFlightData.arrival_lat, latestFlightData.arrival_lon],
            [xp.arrival_lat, xp.arrival_lon],
            [simbriefArr?.lat, simbriefArr?.lon],
            [simbriefArr?.latitude, simbriefArr?.longitude],
            [contractArrival?.lat, contractArrival?.lon],
          ]);
          const currentPos = pickFirstValidLatLon([
            [xp.latitude, xp.longitude],
            [latestFlightData.latitude, latestFlightData.longitude],
          ]);
      const dArr = (arrivalPos.valid && currentPos.valid)
        ? calculateHaversineDistance(currentPos.lat, currentPos.lon, arrivalPos.lat, arrivalPos.lon)
        : 0;
      if (arrivalPos.valid && currentPos.valid && dArr >= 10 && !emergencyLanding) {
        console.log(`🚨 WRONG AIRPORT (${Math.round(dArr)} NM) - FAILED`);
        setFlightData(prev => { const u = { ...prev, events: { ...prev.events, wrong_airport: true }, flightScore: 0 }; flightDataRef.current = u; return u; });
      }
      setFlightPhase('completed');
      setShowAutoCompleteOverlay(true);
      // Keep a buffer >= bridge send interval so touchdown VS/G reaches backend before completion.
      if (autoCompleteTimeoutRef.current) {
        clearTimeout(autoCompleteTimeoutRef.current);
      }
      autoCompleteTimeoutRef.current = setTimeout(() => {
        autoCompleteTimeoutRef.current = null;
        completeFlightMutation.mutate();
      }, 3200);
    }

    // Auto-complete flight on crash - NUR wenn bereits abgehoben
    if (latestFlightData.events.crash && latestFlightData.wasAirborne && isActivePhase && !completeFlightMutation.isPending && !isCompletingFlight) {
      console.log('💥 CRASH ERKANNT - Starte Flugabschluss');
      setFlightPhase('completed');
      setShowAutoCompleteOverlay(true);
      if (autoCompleteTimeoutRef.current) {
        clearTimeout(autoCompleteTimeoutRef.current);
      }
      autoCompleteTimeoutRef.current = setTimeout(() => {
        autoCompleteTimeoutRef.current = null;
        completeFlightMutation.mutate();
      }, 200);
    }
  }, [xplaneLog, flight, existingFlight, flightPhase, completeFlightMutation, flightData.altitude, flightData.wasAirborne, flightData.events.crash, flightStartedAt, flightStartTime, emergencyLanding, simbriefRoute]);

  const phaseLabels = {
    preflight: t('preflight', lang),
    takeoff: t('takeoff', lang),
    cruise: t('cruise', lang),
    landing: t('approach', lang),
    completed: t('completed', lang)
  };

  // Haversine formula to calculate distance between two coordinates
  const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateDistanceInfo = () => {
    if (!contract || flightPhase === 'preflight') return { progress: 0, remainingNm: contract?.distance_nm || 0, totalNm: contract?.distance_nm || 0 };
    const hasPos = flightData.latitude !== 0 || flightData.longitude !== 0;
    // Use SimBrief route if available
    const xpd = (flight || existingFlight)?.xplane_data || {};
    const sbWps = simbriefRoute?.waypoints || xpd.simbrief_waypoints || [];
    const sbDep = simbriefRoute?.departure_coords || xpd.simbrief_departure_coords;
    const sbArr = simbriefRoute?.arrival_coords || xpd.simbrief_arrival_coords;
    if (sbWps.length >= 2 && hasPos) {
      const pts = [];
      if (sbDep?.lat && sbDep?.lon) pts.push({ lat: +sbDep.lat, lon: +sbDep.lon });
      sbWps.forEach(wp => { const la = +wp?.lat, lo = +wp?.lon; if (Number.isFinite(la) && Number.isFinite(lo)) pts.push({ lat: la, lon: lo }); });
      if (sbArr?.lat && sbArr?.lon) pts.push({ lat: +sbArr.lat, lon: +sbArr.lon });
      if (pts.length >= 2) {
        let totalNm = 0;
        for (let i = 0; i < pts.length - 1; i++) totalNm += calculateHaversineDistance(pts[i].lat, pts[i].lon, pts[i+1].lat, pts[i+1].lon);
        let minD = Infinity, cIdx = 0, cFrac = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const sL = calculateHaversineDistance(pts[i].lat, pts[i].lon, pts[i+1].lat, pts[i+1].lon);
          if (sL < 0.1) continue;
          const dA = calculateHaversineDistance(pts[i].lat, pts[i].lon, flightData.latitude, flightData.longitude);
          const dB = calculateHaversineDistance(pts[i+1].lat, pts[i+1].lon, flightData.latitude, flightData.longitude);
          let f = (dA*dA - dB*dB + sL*sL) / (2*sL*sL); f = Math.max(0, Math.min(1, f));
          const pLat = pts[i].lat + f*(pts[i+1].lat-pts[i].lat), pLon = pts[i].lon + f*(pts[i+1].lon-pts[i].lon);
          const d = calculateHaversineDistance(flightData.latitude, flightData.longitude, pLat, pLon);
          if (d < minD) { minD = d; cIdx = i; cFrac = f; }
        }
        const cSL = calculateHaversineDistance(pts[cIdx].lat, pts[cIdx].lon, pts[cIdx+1].lat, pts[cIdx+1].lon);
        let rem = cSL * (1 - cFrac);
        for (let j = cIdx + 1; j < pts.length - 1; j++) rem += calculateHaversineDistance(pts[j].lat, pts[j].lon, pts[j+1].lat, pts[j+1].lon);
        const flown = Math.max(0, totalNm - rem);
        return { progress: Math.max(0, Math.min(100, totalNm > 0 ? (flown / totalNm) * 100 : 0)), remainingNm: Math.max(0, Math.round(rem)), totalNm: Math.round(totalNm) };
      }
    }
    // Fallback: direct line
    const hasArr = flightData.arrival_lat !== 0 || flightData.arrival_lon !== 0;
    const hasDep = flightData.departure_lat !== 0 || flightData.departure_lon !== 0;
    if (hasPos && hasArr) {
      const rem = calculateHaversineDistance(flightData.latitude, flightData.longitude, flightData.arrival_lat, flightData.arrival_lon);
      let tot = contract?.distance_nm || 0;
      if (hasDep) tot = calculateHaversineDistance(flightData.departure_lat, flightData.departure_lon, flightData.arrival_lat, flightData.arrival_lon);
      if (tot <= 0) tot = contract?.distance_nm || rem;
      return { progress: Math.max(0, Math.min(100, ((tot - rem) / tot) * 100)), remainingNm: Math.max(0, Math.round(rem)), totalNm: Math.round(tot) };
    }
    if (hasPos && hasDep && (contract?.distance_nm || 0) > 0) {
      const flown = calculateHaversineDistance(flightData.departure_lat, flightData.departure_lon, flightData.latitude, flightData.longitude);
      const tot = contract.distance_nm;
      return { progress: Math.max(0, Math.min(100, (flown / tot) * 100)), remainingNm: Math.max(0, Math.round(tot - flown)), totalNm: Math.round(tot) };
    }
    return { progress: 0, remainingNm: contract?.distance_nm || 0, totalNm: contract?.distance_nm || 0 };
  };

  const distanceInfo = calculateDistanceInfo();
  const distanceProgress = distanceInfo.progress;
  const liveXpd = (flight || existingFlight)?.xplane_data || {};
  const backendMapPath = (Array.isArray(xplaneLog?.raw_data?.flight_path) && xplaneLog.raw_data.flight_path.length > 0)
    ? xplaneLog.raw_data.flight_path
    : (Array.isArray(liveXpd.flight_path) ? liveXpd.flight_path : []);
  const mapFlightPath = (Array.isArray(backendMapPath) && backendMapPath.length >= localMapPath.length)
    ? backendMapPath
    : localMapPath;
  const mapFlightEventsLog = (() => {
    const rawLog = xplaneLog?.raw_data?.flight_events_log;
    if (Array.isArray(rawLog) && rawLog.length > 0) return rawLog;
    const xpdLog = liveXpd?.flight_events_log;
    if (Array.isArray(xpdLog) && xpdLog.length > 0) return xpdLog;
    const rawBridgeLog = xplaneLog?.raw_data?.bridge_event_log;
    if (Array.isArray(rawBridgeLog) && rawBridgeLog.length > 0) return rawBridgeLog;
    const xpdBridgeLog = liveXpd?.bridge_event_log;
    if (Array.isArray(xpdBridgeLog) && xpdBridgeLog.length > 0) return xpdBridgeLog;
    return [];
  })();

  if (flightPhase === 'preflight' && !contract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white mb-4">{t('contract_not_found', lang)}</p>
          <Button 
            onClick={() => navigate(createPageUrl("ActiveFlights"))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t('go_to_active_flights', lang)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Zibo Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-cyan-900/30 p-2 rounded-lg shadow-md">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost"
            onClick={() => navigate(createPageUrl("ActiveFlights"))}
            className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 font-mono text-[10px] uppercase border border-cyan-900/50"
          >
            ◀ {t('back', lang)}
          </Button>
          <div className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest px-2">{contract ? contract.title : 'Flight Tracker'}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contract && (
            <div className="flex items-center gap-2 sm:gap-4 text-slate-400 text-[10px] font-mono uppercase bg-slate-950 px-2 py-1 rounded border border-slate-800">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-600" />
                {contract.departure_airport}
              </span>
              <span>→</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-600" />
                {contract.arrival_airport}
              </span>
            </div>
          )}
          {company?.xplane_connection_status === 'connected' && (
            <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700/50 flex items-center gap-1 text-[10px] font-mono uppercase h-7 rounded">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              {xplaneLog?.raw_data?.simulator === 'msfs' ? 'MSFS Live' :
               xplaneLog?.raw_data?.simulator === 'msfs2024' ? 'MSFS 2024 Live' :
               xplaneLog?.raw_data?.simulator === 'xplane' || xplaneLog?.raw_data?.simulator === 'xplane12' ? 'FlightSim Live' :
               xplaneLog?.raw_data?.simulator ? `${xplaneLog.raw_data.simulator} Live` : 'Sim Live'}
            </Badge>
          )}
          <Badge className={`h-7 rounded text-[10px] font-mono uppercase ${
            flightPhase === 'completed' 
              ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50'
              : 'bg-blue-900/40 text-blue-400 border-blue-700/50'
          }`}>
            {phaseLabels[flightPhase]}
          </Badge>
        </div>
      </div>

      <AnimatePresence>
        {failurePopup && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-16 right-4 z-[70] max-w-sm rounded-lg border border-amber-500/40 bg-amber-950/90 text-amber-100 px-4 py-3 shadow-xl"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wider text-amber-300/80">
                  {lang === 'de' ? 'Ausfall erkannt' : 'Failure detected'}
                </p>
                <p className="text-sm font-medium">{failurePopup.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Tab Warning */}
        {flightPhase !== 'preflight' && flightPhase !== 'completed' && (
          <div className="mb-2 p-2 bg-amber-950/30 border border-amber-900/50 rounded flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <p className="text-[10px] font-mono text-amber-200">
              {t('tab_warning', lang)}
            </p>
          </div>
        )}

        {contract && (
          <div className="mb-6">
            {/* Progress */}
            <div className="flex items-center justify-between mb-2 text-sm font-mono uppercase text-cyan-500">
              <span className="flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-cyan-400" />
                {contract.departure_airport}
              </span>
              <span className="flex items-center gap-2">
                <PlaneLanding className="w-4 h-4 text-emerald-400" />
                {contract.arrival_airport}
              </span>
            </div>
            <Progress value={distanceProgress} className="h-3 bg-slate-800" />
            <div className="mt-2 flex items-center justify-between text-xs font-mono text-slate-400 uppercase">
              <span>{Math.round(distanceInfo.totalNm - distanceInfo.remainingNm)} NM {t('flown', lang)}</span>
              <span className="font-bold text-cyan-400 text-sm">
                {distanceInfo.remainingNm} NM
              </span>
              <span>{distanceInfo.totalNm} NM {t('total', lang)}</span>
            </div>
          </div>
        )}

        {!contract && (
          <div className="text-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
              <Plane className="w-12 h-12 text-blue-400 mx-auto" />
            </motion.div>
            <p className="text-slate-400 mt-4">{lang === 'de' ? 'Warte auf FlightSim...' : 'Waiting for FlightSim...'}</p>
          </div>
        )}

        {contract && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Flight Instruments */}
            <div className="lg:col-span-2 space-y-6">
                {/* Main Instruments */}
              <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-400">
                <Gauge className="w-5 h-5 text-blue-400" />
                {t('flight_data', lang)}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('altitude', lang)}</p>
                  <p className="text-2xl font-mono font-bold text-blue-400">
                    {Math.round(flightData.altitude).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">ft</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('speed', lang)}</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">
                    {Math.round(flightData.speed)}
                  </p>
                  <p className="text-xs text-slate-500">kts TAS</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('vertical_speed', lang)}</p>
                  <p className={`text-2xl font-mono font-bold ${
                    flightData.verticalSpeed > 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {Math.round(flightData.verticalSpeed) > 0 ? '+' : ''}
                    {Math.round(flightData.verticalSpeed)}
                  </p>
                  <p className="text-xs text-slate-500">ft/min</p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg text-center">
                  <p className="text-slate-400 text-sm mb-1">{t('g_force', lang)}</p>
                  <p className={`text-2xl font-mono font-bold ${
                    flightData.gForce < 1.3 ? 'text-emerald-400' :
                    flightData.gForce < 1.8 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {flightData.gForce.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">G</p>
                </div>
              </div>
            </Card>

            {/* Deadline Timer */}
            {flightPhase !== 'preflight' && flightStartTime && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-400">
                  <Timer className="w-5 h-5 text-amber-400" />
                  Deadline
                </h3>
                {(() => {
                  // Dynamic deadline based on actual X-Plane aircraft, fallback to fleet type
                  const xpIcao = xplaneLog?.raw_data?.aircraft_icao || null;
                  const flType = assignedAircraft?.type || null;
                  const deadlineMin = (contract?.distance_nm)
                    ? calculateDeadlineMinutes(contract.distance_nm, xpIcao, flType)
                    : (contract?.deadline_minutes || 120);
                  const deadlineSec = deadlineMin * 60;
                  const bufferSec = 5 * 60; // 5 minutes buffer
                  const elapsed = flightDurationSeconds;
                  const remaining = deadlineSec - elapsed;
                  const isOver = remaining <= 0;
                  const inBuffer = isOver && elapsed <= (deadlineSec + bufferSec);
                  const overBuffer = elapsed > (deadlineSec + bufferSec);
                  const bufferRemaining = (deadlineSec + bufferSec) - elapsed;
                  
                  // Display: if in buffer, show buffer countdown; else show normal
                  const displayRemaining = isOver ? bufferRemaining : remaining;
                  const absRemaining = Math.abs(displayRemaining);
                  const mins = Math.floor(absRemaining / 60);
                  const secs = Math.floor(absRemaining % 60);
                  const progress = Math.min((elapsed / deadlineSec) * 100, 100);
                  const speedKts = Number(flightData.speed) || 0;
                  const hasEta = distanceInfo.remainingNm > 0 && speedKts >= 60;
                  const etaMinutes = hasEta ? Math.round((distanceInfo.remainingNm / speedKts) * 60) : null;
                  const etaDate = hasEta ? new Date(Date.now() + (etaMinutes * 60 * 1000)) : null;
                  const etaClock = etaDate
                    ? etaDate.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                    : null;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-400">
                          {inBuffer ? t('deadline_buffer', lang) : overBuffer ? t('deadline_exceeded', lang) : t('deadline_remaining', lang)}
                        </span>
                        <span className={`text-2xl font-mono font-bold ${
                          overBuffer ? 'text-red-400' : inBuffer ? 'text-amber-400' : remaining < 300 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {overBuffer ? '-' : ''}{mins}:{secs.toString().padStart(2, '0')}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2 bg-slate-700" />
                      <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>0 min</span>
                        <span>{deadlineMin} min {inBuffer ? '+ 5 min Puffer' : ''}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        <span className="text-slate-500">{t('eta', lang)}: </span>
                        {hasEta ? (
                          <span className="font-mono text-slate-300">
                            {etaClock}
                            {etaMinutes >= 60 ? ` (${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m)` : ` (${etaMinutes}m)`}
                          </span>
                        ) : (
                          <span>{t('eta_unavailable', lang)}</span>
                        )}
                      </p>
                      {inBuffer && (
                        <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t('deadline_exceeded_buffer', lang)}
                        </p>
                      )}
                      {overBuffer && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t('deadline_buffer_expired', lang)}
                        </p>
                      )}
                      {!isOver && remaining < 300 && (
                        <p className="text-xs text-amber-400 mt-2">{t('less_than_5_min', lang)}</p>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}

            {/* Fuel & Status with Arrival Prediction */}
            <FuelPrediction
              flightData={flightData}
              flightStartTime={flightStartTime}
              distanceInfo={distanceInfo}
              flight={flight}
              existingFlight={existingFlight}
              aircraft={assignedAircraft}
              xplaneRawData={xplaneLog?.raw_data || null}
            />

            {/* Flight Score & Events */}
            {flightPhase !== 'preflight' && (
              <Card className="p-6 bg-slate-950/80 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-cyan-400">
                  <Star className="w-5 h-5 text-cyan-400" />
                  {t('flight_score', lang)}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t('score', lang)}</span>
                    <span className={`text-2xl font-bold ${
                      flightData.flightScore >= 95 ? 'text-emerald-400' :
                      flightData.flightScore >= 85 ? 'text-green-400' :
                      flightData.flightScore >= 70 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(flightData.flightScore)}
                    </span>
                  </div>
                  <Progress value={flightData.flightScore} className="h-2 bg-slate-700" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{t('status', lang)}</span>
                    <Badge className={`${
                      flightData.flightScore >= 95 ? 'bg-emerald-500/20 text-emerald-400' :
                      flightData.flightScore >= 85 ? 'bg-green-500/20 text-green-400' :
                      flightData.flightScore >= 70 ? 'bg-amber-500/20 text-amber-400' :
                      flightData.flightScore >= 50 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {flightData.flightScore >= 95 ? t('excellent_rating', lang) :
                      flightData.flightScore >= 85 ? t('very_good_rating', lang) :
                      flightData.flightScore >= 70 ? t('acceptable_rating', lang) :
                      flightData.flightScore >= 50 ? t('poor_rating', lang) :
                      t('poor_rating', lang)}
                    </Badge>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{t('maint_cost_label', lang)}</span>
                      <span className="text-red-400 font-mono">${Math.round(liveCurrentTotalMaintenanceCost).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{lang === 'de' ? 'Davon in diesem Flug hinzugefügt' : 'Added during this flight'}</span>
                      <span className="text-amber-300 font-mono">+${Math.round(liveFlightAddedMaintenanceCost).toLocaleString()}</span>
                    </div>
                  </div>
                  {flightData.landingBonus > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                      <span className="text-slate-400">{t('landing_bonus', lang)}</span>
                      <span className="text-emerald-400 font-mono">+${Math.round(flightData.landingBonus).toLocaleString()}</span>
                    </div>
                  )}

                  {liveActiveFailures.length > 0 && (
                    <div className="pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">{lang === 'de' ? 'Aktive Ausfälle:' : 'Active failures:'}</p>
                      <ActiveFailuresDisplay failures={liveActiveFailures} compact />
                    </div>
                  )}

                  {/* Events */}
                  {Object.entries(flightData.events).some(([key, val]) => val === true && !String(key).startsWith('failure_')) && (
                    <div className="pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-2">{t('incidents', lang)}:</p>
                      <div className="space-y-1">
                        {flightData.events.tailstrike === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('tailstrike', lang)} (-20)
                          </div>
                        )}
                        {flightData.events.stall === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('stall', lang)} (-50)
                          </div>
                        )}
                        {flightData.events.overstress === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('structural_stress', lang)} (-30)
                          </div>
                        )}
                        {flightData.events.overspeed === true && (
                         <div className="text-xs text-orange-400 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" />
                           {t('overspeed', lang)} (-15)
                         </div>
                        )}
                        {flightData.events.flaps_overspeed === true && (
                         <div className="text-xs text-orange-400 flex items-center gap-1">
                           <AlertTriangle className="w-3 h-3" />
                           {t('flaps_overspeed', lang)} (-{settings?.flaps_overspeed_score_penalty || 15})
                         </div>
                        )}
                        {flightData.events.gear_up_landing === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('gear_up_landing', lang)} (-35)
                          </div>
                        )}
                        {flightData.events.crash === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('crash_detected', lang)} (-100)
                          </div>
                        )}
                        {flightData.events.harsh_controls === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('harsh_controls', lang)}
                          </div>
                        )}
                        {flightData.events.high_g_force === true && (
                          <div className="text-xs text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t('high_g_forces', lang)}
                          </div>
                        )}
                        {flightData.events.hard_landing === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t('hard_landing', lang)}</div>
                        )}
                        {flightData.events.wrong_airport === true && (
                          <div className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{lang === 'de' ? 'Falscher Flughafen! (>=10 NM)' : 'Wrong airport! (>=10 NM)'}</div>
                        )}
                        </div>
                        </div>
                        )}
                </div>
              </Card>
            )}

            {/* Controls */}
            {flightPhase !== 'completed' && (
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-emerald-400"><PlaneTakeoff className="w-5 h-5 text-emerald-400" />{t('flight_control', lang)}</h3>
                {flightPhase === 'preflight' && (
                  <div className="space-y-4">
                    <Button 
                      onClick={() => {
                        startFlightMutation.mutate();
                      }}
                      disabled={startFlightMutation.isPending}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
                    >
                      <PlaneTakeoff className="w-5 h-5 mr-2" />
                      {startFlightMutation.isPending ? t('starting', lang) : t('start_flight', lang)}
                    </Button>
                    <p className="text-sm text-slate-400 text-center">
                      {lang === 'de' ? 'Klicke auf "Flug starten" und mache in FlightSim weiter' : 'Click "Start Flight" and continue in FlightSim'}
                    </p>
                  </div>
                )}
                
                {flightPhase === 'takeoff' && !flightData.wasAirborne && (
                  <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Plane className="w-6 h-6 text-amber-400" />
                        </motion.div>
                      </div>
                      <div>
                        <p className="font-medium text-amber-200 mb-1">{lang === 'de' ? 'Warte auf FlightSim...' : 'Waiting for FlightSim...'}</p>
                        <p className="text-sm text-amber-300/70">
                          {lang === 'de' ? 'Starte jetzt deinen Flug in FlightSim.' : 'Start your flight in FlightSim now.'} <span className="font-mono font-bold text-amber-200">{contract?.departure_airport}</span>
                        </p>
                        {company?.xplane_connection_status !== 'connected' && (
                          <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            {lang === 'de' ? 'FlightSim ist nicht verbunden. Stelle sicher, dass die Bridge aktiv ist.' : 'FlightSim is not connected. Make sure the bridge is active.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {flightPhase !== 'preflight' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                      {flightPhase === 'takeoff' && flightData.wasAirborne && t('climbing_to_cruise', lang)}
                      {flightPhase === 'cruise' && (lang === 'de'
                        ? 'Der Flug wird von FlightSim gesteuert. Er endet automatisch, wenn du parkst und die Parkbremse aktiv ist.'
                        : 'Flight is controlled by FlightSim. It completes automatically when you park with parking brake on.')}
                      {flightPhase === 'landing' && t('land_and_park', lang)}
                    </p>
                    {/* Emergency Landing Button */}
                    {flightData.wasAirborne && !emergencyLanding && (
                      <Button onClick={() => { setEmergencyLanding(true); }} className="w-full bg-amber-700 hover:bg-amber-600 text-white">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        {lang === 'de' ? 'Notlandung erklären' : 'Declare Emergency Landing'}
                      </Button>
                    )}
                    {emergencyLanding && (
                      <div className="p-2 bg-amber-900/30 border border-amber-700/50 rounded text-xs text-amber-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {lang === 'de' ? 'Notlandung erklärt - Landung >=10 NM entfernt erlaubt, aber -30 Score und nur 30% Payout' : 'Emergency declared - off-airport landing >=10 NM allowed, but -30 score and only 30% payout'}
                      </div>
                    )}
                    <Button onClick={() => { if (confirm(`${t('cancel_confirm', lang)} $${(contract?.payout * 0.3 || 5000).toLocaleString()}`)) cancelFlightMutation.mutate(); }} disabled={cancelFlightMutation.isPending} variant="destructive" className="w-full">
                      {cancelFlightMutation.isPending ? t('cancelling', lang) : t('cancel_flight', lang)}
                    </Button>
                  </div>
                )}
              </Card>
            )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
            {flightPhase === 'completed' ? (
              <>
                <FlightRating 
                  flight={(() => {
                    const xpd = (flight || existingFlight)?.xplane_data || {};
                    const initFuel = Number(xpd.initial_fuel_kg || 0);
                    let curFuel = Number(flightData.fuelKg || xpd.fuel_kg || xpd.last_valid_fuel_kg || 0);
                    const fuelPct = Number(flightData.fuel || xpd.fuel_percentage || 0);
                    if (initFuel > 0 && fuelPct > 0 && fuelPct <= 100) {
                      const pctDerived = (initFuel * fuelPct) / 100;
                      if (curFuel <= 0 || Math.abs(curFuel - pctDerived) > (initFuel * 0.55)) {
                        curFuel = pctDerived;
                      }
                    }
                    if (initFuel > 0) {
                      curFuel = Math.min(curFuel, initFuel);
                    }
                    const fuelUsedKg = Math.max(0, initFuel - curFuel);
                    const fuelUsed = fuelUsedKg * 1.25;
                    const fuelCost = fuelUsed * 1.8;
                    const flightHours = flightStartTime ? (Date.now() - flightStartTime) / 3600000 : (contract?.distance_nm ? contract.distance_nm / 450 : 2);
                    const crewCost = flightHours * 250;
                    const airportFee = 150;
                    const isCrashed = flightData.events.crash || flightData.events.wrong_airport;
                    let revenue = 0;
                    if (!isCrashed) {
                      revenue = contract?.payout || 0;
                      revenue += flightData.landingBonus || 0;
                    }
                    const normalizeStoredPct = (value) => {
                      const n = Number(value);
                      if (!Number.isFinite(n)) return undefined;
                      return n > 1 && n <= 100 ? n / 100 : n;
                    };
                    const previewInsuranceAircraft = {
                      ...(assignedAircraft || {}),
                      insurance_plan: String(assignedAircraft?.insurance_plan || xpd?.insurance_plan || '').trim().toLowerCase() || null,
                      insurance_hourly_rate_pct: Number.isFinite(Number(assignedAircraft?.insurance_hourly_rate_pct))
                        ? Number(assignedAircraft.insurance_hourly_rate_pct)
                        : normalizeStoredPct(xpd?.insurance_hourly_rate_pct),
                      insurance_maintenance_coverage_pct: Number.isFinite(Number(assignedAircraft?.insurance_maintenance_coverage_pct))
                        ? Number(assignedAircraft.insurance_maintenance_coverage_pct)
                        : normalizeStoredPct(xpd?.insurance_coverage_pct ?? xpd?.insurance_maintenance_coverage_pct),
                      insurance_score_bonus_pct: Number.isFinite(Number(assignedAircraft?.insurance_score_bonus_pct))
                        ? Number(assignedAircraft.insurance_score_bonus_pct)
                        : normalizeStoredPct(xpd?.insurance_score_bonus_pct),
                    };
                    const resolvedPreviewInsurance = resolveAircraftInsurance(previewInsuranceAircraft);
                    const previewInsurance = calculateInsuranceForFlight({
                      aircraft: previewInsuranceAircraft,
                      flightHours,
                      maintenanceCost: flightData.maintenanceCost,
                      companyReputation: company?.reputation || 50,
                      baseScore: flightData.flightScore,
                    });
                    const directCosts = fuelCost + crewCost + airportFee + previewInsurance.insuranceCost;
                    const profit = revenue - directCosts;
                    const levelBonusPercent = (company?.level || 1) * 0.01;
                    const levelBonus = profit > 0 ? profit * levelBonusPercent : 0;
                    const insuranceScoreBonus = Math.round(previewInsurance.scoreBonusPoints * 10) / 10;
                    return {
                      flight_score: Math.max(0, Math.min(100, flightData.flightScore + insuranceScoreBonus)),
                      landing_vs: flightData.landingVs,
                      max_g_force: flightData.maxGForce,
                      fuel_used_liters: fuelUsed,
                      flight_duration_hours: flightHours,
                      passenger_comments: generatePassengerComments(Math.max(0, Math.min(100, flightData.flightScore + insuranceScoreBonus)), flightData, lang),
                      xplane_data: {
                        final_score: Math.max(0, Math.min(100, flightData.flightScore + insuranceScoreBonus)),
                        landingGForce: flightData.landingGForce,
                        events: flightData.events,
                        levelBonus,
                        levelBonusPercent: levelBonusPercent * 100,
                        companyLevel: company?.level || 1,
                        landingScoreChange: flightData.landingScoreChange,
                        landingBonus: flightData.landingBonus,
                        landingMaintenanceCost: flightData.landingMaintenanceCost,
                        insurance_plan: resolvedPreviewInsurance.planKey,
                        insurance_cost: Math.round(previewInsurance.insuranceCost),
                        insurance_covered_maintenance: Math.round(previewInsurance.maintenanceCovered),
                        insurance_score_bonus_pct: Math.round(previewInsurance.scoreBonusPct * 100),
                        insurance_score_bonus_points: insuranceScoreBonus
                      },
                      revenue,
                      fuel_cost: fuelCost,
                      crew_cost: crewCost,
                      maintenance_cost: flightData.maintenanceCost,
                      profit: profit + levelBonus
                    };
                  })()} 
                />

                {!completeFlightMutation.isSuccess && (
                  <Button 
                    onClick={() => completeFlightMutation.mutate()}
                    disabled={completeFlightMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
                  >
                    {completeFlightMutation.isPending ? t('saving', lang) : t('complete_flight', lang)}
                  </Button>
                )}

                {completeFlightMutation.isSuccess && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate(createPageUrl("Dashboard"))}
                    className="w-full border-slate-600 text-white hover:bg-slate-700"
                  >
                    {t('back_to_dashboard', lang)}
                  </Button>
                )}
              </>
            ) : (
              <>
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-400">
                  <Star className="w-5 h-5 text-amber-400" />
                  {t('passenger_satisfaction', lang)}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{t('max_g_so_far', lang)}</span>
                    <span className={`font-mono ${
                      flightData.maxGForce < 1.3 ? 'text-emerald-400' :
                      flightData.maxGForce < 1.8 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {flightData.maxGForce.toFixed(2)} G
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {t('keep_g_low', lang)}
                  </p>
                </div>
              </Card>

              {/* Weather Display */}
              <WeatherDisplay raw={xplaneLog?.raw_data} />

              {/* Raw X-Plane Data - moved to XPlaneDebug page */}
              </>
            )}
          </div>
        </div>
        )}

        {contract && (
          <div className="space-y-6 mt-6">
            <FlightMapIframe
              key={`map-${contractIdFromUrl}`}
              flightData={flightData}
              contract={contract}
              waypoints={xplaneLog?.raw_data?.fms_waypoints || []}
              routeWaypoints={simbriefRoute?.waypoints || []}
              flightPath={mapFlightPath}
              flightEventsLog={mapFlightEventsLog}
              departureRunway={simbriefRoute?.departure_runway}
              arrivalRunway={simbriefRoute?.arrival_runway}
              departureCoords={simbriefRoute?.departure_coords}
              arrivalCoords={simbriefRoute?.arrival_coords}
              onViewModeChange={null}
              liveFlightData={{
                gForce: flightData.gForce, maxGForce: flightData.maxGForce,
                fuelPercent: flightData.fuel, fuelKg: flightData.fuelKg,
                flightScore: flightData.flightScore, events: flightData.events, wasAirborne: flightData.wasAirborne,
                weather: xplaneLog?.raw_data ? { wind_speed_kts: xplaneLog.raw_data.wind_speed_kts, wind_direction: xplaneLog.raw_data.wind_direction, rain_intensity: xplaneLog.raw_data.rain_intensity, precipitation: xplaneLog.raw_data.precipitation, precip_rate: xplaneLog.raw_data.precip_rate, oat_c: xplaneLog.raw_data.oat_c, tat_c: xplaneLog.raw_data.tat_c, baro_setting: xplaneLog.raw_data.baro_setting, turbulence: xplaneLog.raw_data.turbulence } : null
              }}
            />
            <SimBriefImport
              key={`simbrief-${contractIdFromUrl}`}
              contract={contract}
              onRouteLoaded={(data) => {
                const normalizedSimbrief = {
                  ...(data || {}),
                  aircraft_icao:
                    data?.aircraft_icao ||
                    data?.raw_general?.icao_aircraft ||
                    data?.raw_general?.aircraft_icao ||
                    data?.raw_general?.aircraft_type ||
                    null
                };
                setSimbriefRoute(normalizedSimbrief);
                if (activeFlightId && data?.waypoints?.length) {
                  // Persist SimBrief route on the active flight so backend/plugin can reuse it for HUD distance.
                  base44.entities.Flight.update(activeFlightId, {
                    xplane_data: {
                      ...((flight || existingFlight)?.xplane_data || {}),
                      simbrief_waypoints: data.waypoints || [],
                      simbrief_route_string: data.route_string || null,
                      simbrief_departure_coords: data.departure_coords || null,
                      simbrief_arrival_coords: data.arrival_coords || null
                    }
                  }).catch(() => {});
                }
              }}
            />
            <TakeoffLandingCalculator
              aircraft={aircraft?.find(a => a.id === (flight?.aircraft_id || existingFlight?.aircraft_id))}
              contract={contract}
              xplaneData={xplaneLog?.raw_data}
              simbriefData={simbriefRoute}
            />
            {flightPhase !== 'preflight' && liveMaintenanceCategoriesDisplay.length > 0 && (
              <Card className="p-6 bg-slate-950/80 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-300">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  {lang === 'de'
                    ? 'Live-Ansicht: interagierende Wartungskategorien'
                    : 'Live view: interacting maintenance categories'}
                </h3>
                <div className="mb-3 p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{lang === 'de' ? 'Aktuelle Wartungskosten gesamt' : 'Current total maintenance cost'}</span>
                    <span className="text-red-400 font-mono">${Math.round(liveCurrentTotalMaintenanceCost).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{lang === 'de' ? 'In diesem Flug addiert' : 'Added in this flight'}</span>
                    <span className="text-amber-300 font-mono">+${Math.round(liveFlightAddedMaintenanceCost).toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {liveMaintenanceCategoriesDisplay.map((category) => {
                    const Icon = category.icon;
                    const categoryCosts = liveMaintenanceCostSnapshot?.byCategory?.[category.key] || { total: 0, added: 0 };
                    const categoryBaseCost = Math.max(0, Number(categoryCosts.base || 0));
                    const categoryAddedCost = Math.max(0, Number(categoryCosts.added || 0));
                    const categoryTotalCost = Math.max(0, Number(categoryCosts.total || 0));
                    const maintenanceTotal = Math.max(0, Number(liveCurrentTotalMaintenanceCost || 0));
                    const totalPercent = maintenanceTotal > 0 ? (categoryTotalCost / maintenanceTotal) * 100 : 0;
                    const permanentPercent = Math.min(100, Math.max(0, Number(category.permanentWear || 0)));
                    const basePercent = maintenanceTotal > 0 ? (categoryBaseCost / maintenanceTotal) * 100 : 0;
                    const addedPercent = maintenanceTotal > 0 ? (categoryAddedCost / maintenanceTotal) * 100 : 0;
                    const clampedBasePercent = Math.min(100, Math.max(0, basePercent));
                    const clampedAddedPercent = Math.min(100 - clampedBasePercent, Math.max(0, addedPercent));
                    return (
                      <div key={category.key} className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${category.colorClass}`} />
                            <span className="text-sm text-slate-200 truncate flex items-center gap-1">
                              <span>{category.label}</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700/70 transition-colors"
                                    aria-label={lang === 'de' ? `Kostenformel für ${category.label}` : `Cost formula for ${category.label}`}
                                  >
                                    <Info className="w-3 h-3" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 bg-slate-900 border-slate-700 text-slate-200 p-3" align="start">
                                  {(() => {
                                    const info = liveCostExplanationRef.current(category);
                                    return (
                                      <div className="space-y-1.5 text-xs">
                                        <p className="font-semibold text-white">{info.title}</p>
                                        <p className="text-slate-300">{info.details}</p>
                                        <p className="text-slate-400">{info.formula}</p>
                                        <p className="text-rose-300">{info.possibleFailures}</p>
                                        <p className="text-amber-300 font-mono">{info.breakdown}</p>
                                      </div>
                                    );
                                  })()}
                                </PopoverContent>
                              </Popover>
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                          <div className={`text-sm font-mono ${category.colorClass}`}>
                            {category.wear.toFixed(1)}%
                          </div>
                          <div className="text-[11px] text-orange-300 font-mono">
                            +{Number(category.addedWear || 0).toFixed(1)}%
                          </div>
                          <div className="text-[11px] text-red-400 font-mono">
                            {lang === 'de' ? 'Permanent' : 'Permanent'} {Number(category.permanentWear || 0).toFixed(1)}%
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ${Math.round(categoryTotalCost).toLocaleString()}
                            <span className="text-amber-300"> (+${Math.round(categoryAddedCost).toLocaleString()})</span>
                              <span className="text-emerald-300"> | {totalPercent.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="relative w-full bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className="absolute left-0 top-0 h-1.5 bg-red-500 transition-all"
                            style={{ width: `${permanentPercent}%` }}
                          />
                          <div
                            className="absolute left-0 top-0 h-1.5 bg-emerald-500 transition-all"
                            style={{
                              left: `${permanentPercent}%`,
                              width: `${Math.min(100 - permanentPercent, clampedBasePercent)}%`
                            }}
                          />
                          <div
                            className="absolute top-0 h-1.5 bg-orange-400 transition-all"
                            style={{
                              left: `${Math.min(100, permanentPercent + clampedBasePercent)}%`,
                              width: `${Math.min(100 - Math.min(100, permanentPercent + clampedBasePercent), clampedAddedPercent)}%`,
                            }}
                          />
                        </div>
                        {category.reasons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {category.reasons.slice(0, 3).map((reason, idx) => (
                              <Badge key={`${category.key}-${idx}`} className="bg-slate-800 text-slate-300 border-slate-600 text-[10px]">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  {lang === 'de'
                    ? 'Diese Ansicht zeigt laufende Kategorien während des Flugs. Finale Wartungswerte werden beim Flugabschluss in die Flotte übernommen.'
                    : 'This view shows ongoing categories during flight. Final maintenance values are applied to fleet on flight completion.'}
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
      <AnimatePresence>
        {showAutoCompleteOverlay && !completedFlightForAnim && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-xl text-center bg-slate-900/90 border border-cyan-800/50 rounded-2xl p-8 shadow-2xl">
              <motion.div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-cyan-700/40 border-t-cyan-300" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
              <h2 className="text-2xl font-bold text-cyan-300 mb-3">{lang === 'de' ? 'Flug wird abgeschlossen...' : 'Completing flight...'}</h2>
              <p className="text-slate-300 text-base">{lang === 'de' ? 'Bitte warten.' : 'Please wait.'}</p>
            </div>
          </motion.div>
        )}
        {completedFlightForAnim && (
          <FlightCompletionAnimation
            key="flight-completion-anim"
            flight={completedFlightForAnim}
            contract={contract}
            lang={lang}
            onContinue={() => {
              navigate(createPageUrl(`CompletedFlightDetails?contractId=${contractIdFromUrl}`), {
                state: { flight: completedFlightForAnim, contract, skipAnimation: true },
                replace: true,
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
