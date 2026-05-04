import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ArrowLeft,
  MapPin,
  DollarSign,
  Plane,
  Star,
  AlertTriangle,
  CheckCircle2,
  Loader,
  Timer,
  Play
} from "lucide-react";

import FlightRating from "@/components/flights/FlightRating";
import LandingQualityVisual from "@/components/flights/LandingQualityVisual";
import ActiveFailuresDisplay from "@/components/flights/ActiveFailuresDisplay";
import FlightMapIframe from "@/components/flights/FlightMapIframe";
import FlightProfileChart from "@/components/flights/FlightProfileChart";
import FinalApproach3D from "@/components/flights/FinalApproach3D";
import FlightCompletionAnimation from "@/components/flights/FlightCompletionAnimation";
import RunwayAccuracyCard from "@/components/flights/RunwayAccuracyCard";
import { computeRunwayAccuracy, evaluateRunwayAccuracy } from "@/components/flights/runwayAccuracy";
import { computeGeoCenterlineAccuracy, normalizeRunway } from "@/components/flights/approachGeometry";
import { buildFailuresFromEventFlags, sanitizeFailureList } from "@/components/flights/failureUtils";
import { calculateDeadlineMinutes } from "@/components/flights/aircraftSpeedLookup";
import { generatePassengerComments } from "@/components/flights/generatePassengerComments";
import { resolveLandingMetricsFromFlight } from "@/components/flights/landingMetrics";
import AchievementUnlockList from "@/components/achievements/AchievementUnlockList";
import { useLanguage } from "@/components/LanguageContext";
import { t } from "@/components/i18n/translations";

const DIFFICULTY_PAYOUT_BONUS_RATE = {
  easy: 0,
  medium: 0.15,
  hard: 0.35,
  extreme: 0.80,
};

const DIFFICULTY_LABELS = {
  easy: { de: 'Freier Modus', en: 'Free mode' },
  medium: { de: 'Mittel', en: 'Medium' },
  hard: { de: 'Schwer', en: 'Hard' },
  extreme: { de: 'Extrem', en: 'Extreme' },
};

const normalizeChallengeDifficulty = (value) => {
  const normalized = String(value || '').toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_PAYOUT_BONUS_RATE, normalized)
    ? normalized
    : 'medium';
};

export default function CompletedFlightDetails() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const location = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get('contractId');
  const [showApproach3D, setShowApproach3D] = React.useState(false);
  const [showTakeoff3D, setShowTakeoff3D] = React.useState(false);
  const [showCompletionAnim, setShowCompletionAnim] = React.useState(false);
  const animTriggeredRef = React.useRef(false);
  
  // Hole Daten aus State von FlightTracker
  const passedFlight = location.state?.flight;
  const passedContract = location.state?.contract;
  const skipAnimation = location.state?.skipAnimation === true;

  const { data: gameSettings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const settings = await base44.entities.GameSettings.list();
      return settings[0] || null;
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const user = await base44.auth.me();
      const companies = await base44.entities.Company.filter({ created_by: user.email });
      if (!companies[0]) return null;
      const contracts = await base44.entities.Contract.filter({ id: contractId, company_id: companies[0].id });
      return contracts[0];
    },
    enabled: !!contractId && !passedContract,
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: flights = [] } = useQuery({
    queryKey: ['flights', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const user = await base44.auth.me();
      const cid = user?.company_id || user?.data?.company_id;
      let companyId = cid;
      if (!companyId) {
        const companies = await base44.entities.Company.filter({ created_by: user.email });
        companyId = companies[0]?.id;
      }
      if (!companyId) return [];
      const result = await base44.entities.Flight.filter({ contract_id: contractId, company_id: companyId });
      return result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!contractId,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    refetchInterval: !passedFlight ? 3000 : false, // keep refetching until we have flight data
  });

  // Prefer passed flight from navigation state, fallback to latest from DB
  const flight = passedFlight || flights[0];
  const finalContract = passedContract || contract;

  // Runway Accuracy backfill is now handled by the RunwayAccuracyCard component
  // itself, which calls the recomputeRunwayAccuracy backend function on demand.
  // Kept disabled here to avoid duplicate computation & race conditions.
  const runwayBackfillDoneRef = React.useRef(new Set());
  React.useEffect(() => {
    if (!flight?.id) return;
    if (flight?.xplane_data?.runway_accuracy_applied) return;
    if (!finalContract?.departure_airport && !finalContract?.arrival_airport) return;
    const guardKey = `${flight.id}|${finalContract?.id || 'noc'}`;
    if (runwayBackfillDoneRef.current.has(guardKey)) return;
    runwayBackfillDoneRef.current.add(guardKey);
    // Frontend auto-backfill disabled — user triggers it via the card button.
    return;
    // eslint-disable-next-line no-unreachable
    console.log('[RunwayBackfill] start', {
      flight_id: flight.id,
      dep_icao: finalContract?.departure_airport,
      arr_icao: finalContract?.arrival_airport,
      has_telemetry_history: Array.isArray(flight?.xplane_data?.telemetry_history) && flight.xplane_data.telemetry_history.length > 0,
      flight_path_len: Array.isArray(flight?.xplane_data?.flight_path) ? flight.xplane_data.flight_path.length : 0,
    });

    const rawTelemetryHistory = flight?.xplane_data?.telemetry_history || [];
    const basePayout = Number(finalContract?.payout || flight?.revenue || 0);
    const xpd = flight?.xplane_data || {};

    // Fallback: if no telemetry_history is stored, synthesize one from flight_path
    // (lat/lon only) so we can at least measure lateral deviation from centerline.
    // Tag samples near start as on_ground=true for takeoff, samples near end as
    // on_ground=true for landing, so the accuracy algorithms pick them up.
    let telemetryHistory = rawTelemetryHistory;
    if ((!Array.isArray(telemetryHistory) || telemetryHistory.length < 5)
        && Array.isArray(xpd.flight_path) && xpd.flight_path.length >= 10) {
      const fp = xpd.flight_path
        .map((p) => {
          if (Array.isArray(p) && p.length >= 2) return { lat: Number(p[0]), lon: Number(p[1]) };
          if (p && typeof p === 'object') return { lat: Number(p.lat ?? p.latitude), lon: Number(p.lon ?? p.lng ?? p.longitude) };
          return null;
        })
        .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && !(Math.abs(p.lat) < 0.01 && Math.abs(p.lon) < 0.01));
      if (fp.length >= 10) {
        // Mark first ~3% of samples as ground-rolling (takeoff) and last ~3% as
        // ground-rolling (landing rollout). Speed=50 so the roll detection triggers.
        const n = fp.length;
        const takeoffEnd = Math.max(3, Math.floor(n * 0.03));
        const landingStart = Math.max(takeoffEnd + 1, Math.floor(n * 0.97));
        telemetryHistory = fp.map((p, i) => ({
          ...p,
          on_ground: (i < takeoffEnd || i >= landingStart),
          spd: (i < takeoffEnd || i >= landingStart) ? 50 : 250,
        }));
      }
    }

    // Resolve departure + arrival runways via OurAirports, then measure lateral
    // deviation from the TRUE centerline. Fall back to best-fit-line (old method)
    // only if runway info can't be resolved.
    (async () => {
      try {
        const fetchRunway = async (icao, lat, lon) => {
          if (!icao) return null;
          try {
            const res = await base44.functions.invoke('getRunwayInfo', {
              icao, touchdown_lat: lat, touchdown_lon: lon,
            });
            const picked = res?.data?.landing_runway;
            return picked ? normalizeRunway(picked) : null;
          } catch (_) { return null; }
        };

        // Heuristic hint coords: first moving ground sample for departure,
        // last sample for arrival. Falls back to airport coords in xplane_data,
        // then to SimBrief departure/arrival coords, then to flight_path endpoints.
        const firstGround = telemetryHistory.find((p) => (p?.on_ground === true || p?.on_ground === 1) && Number(p?.spd ?? p?.speed ?? 0) > 20);
        const lastSample = telemetryHistory[telemetryHistory.length - 1] || {};
        const flightPath = Array.isArray(xpd.flight_path) ? xpd.flight_path : [];
        const fpFirst = flightPath[0];
        const fpLast = flightPath[flightPath.length - 1];
        const fpFirstLat = Array.isArray(fpFirst) ? Number(fpFirst[0]) : Number(fpFirst?.lat);
        const fpFirstLon = Array.isArray(fpFirst) ? Number(fpFirst[1]) : Number(fpFirst?.lon ?? fpFirst?.lng);
        const fpLastLat = Array.isArray(fpLast) ? Number(fpLast[0]) : Number(fpLast?.lat);
        const fpLastLon = Array.isArray(fpLast) ? Number(fpLast[1]) : Number(fpLast?.lon ?? fpLast?.lng);
        const depIcao = xpd.departure_icao || xpd.departure_airport || xpd.contract_departure_airport || flight?.departure_airport || finalContract?.departure_airport || '';
        const arrIcao = xpd.arrival_icao || xpd.arrival_airport || xpd.contract_arrival_airport || flight?.arrival_airport || finalContract?.arrival_airport || '';
        const pickCoord = (...vals) => {
          for (const v of vals) {
            const n = Number(v);
            if (Number.isFinite(n) && Math.abs(n) > 1.0) return n;
          }
          // Second pass: accept any non-trivial value if no "large" coord found.
          for (const v of vals) {
            const n = Number(v);
            if (Number.isFinite(n) && Math.abs(n) > 0.01) return n;
          }
          return 0;
        };
        const depHintLat = pickCoord(firstGround?.lat, xpd.departure_lat, xpd.simbrief_departure_coords?.lat, fpFirstLat);
        const depHintLon = pickCoord(firstGround?.lon, xpd.departure_lon, xpd.simbrief_departure_coords?.lon, fpFirstLon);
        const arrHintLat = pickCoord(lastSample?.lat, xpd.arrival_lat, xpd.simbrief_arrival_coords?.lat, fpLastLat);
        const arrHintLon = pickCoord(lastSample?.lon, xpd.arrival_lon, xpd.simbrief_arrival_coords?.lon, fpLastLon);

        const [depRunway, arrRunway] = await Promise.all([
          fetchRunway(depIcao, depHintLat, depHintLon),
          fetchRunway(arrIcao, arrHintLat, arrHintLon),
        ]);

        const takeoffGeo = depRunway ? computeGeoCenterlineAccuracy(telemetryHistory, depRunway, 'takeoff') : null;
        const landingGeo = arrRunway ? computeGeoCenterlineAccuracy(telemetryHistory, arrRunway, 'landing') : null;

        // Fallback to best-fit line where geo accuracy wasn't available.
        const legacy = (!takeoffGeo || !landingGeo) ? computeRunwayAccuracy(telemetryHistory) : { takeoff: null, landing: null };
        const takeoffAcc = takeoffGeo || legacy.takeoff || null;
        const landingAcc = landingGeo || legacy.landing || null;
        console.log('[RunwayBackfill] computed', {
          flight_id: flight.id,
          dep_icao: depIcao, arr_icao: arrIcao,
          dep_hint: [depHintLat, depHintLon], arr_hint: [arrHintLat, arrHintLon],
          dep_runway_resolved: !!depRunway, arr_runway_resolved: !!arrRunway,
          takeoff_geo: !!takeoffGeo, landing_geo: !!landingGeo,
          takeoff_legacy: !!legacy.takeoff, landing_legacy: !!legacy.landing,
          telemetry_len: telemetryHistory.length,
        });
        if (!takeoffAcc && !landingAcc) {
          // Mark as applied with empty result so UI stops showing "wird berechnet".
          await base44.entities.Flight.update(flight.id, {
            xplane_data: {
              ...(flight.xplane_data || {}),
              runway_accuracy_applied: true,
              runway_accuracy: { takeoff: null, landing: null, totalScoreDelta: 0, totalCashDelta: 0, unavailable_reason: 'no_runway_data' },
            },
          });
          return;
        }

        const takeoffEval = takeoffAcc ? evaluateRunwayAccuracy(takeoffAcc.rmsMeters, basePayout) : null;
        const landingEval = landingAcc ? evaluateRunwayAccuracy(landingAcc.rmsMeters, basePayout) : null;
        const totalScoreDelta = (takeoffEval?.scoreDelta || 0) + (landingEval?.scoreDelta || 0);
        const totalCashDelta = (takeoffEval?.cashDelta || 0) + (landingEval?.cashDelta || 0);

        // Save accuracy even if no deltas so the UI can still show the result.
        if (totalScoreDelta === 0 && totalCashDelta === 0) {
          await base44.entities.Flight.update(flight.id, {
            xplane_data: {
              ...(flight.xplane_data || {}),
              runway_accuracy_applied: true,
              runway_accuracy: {
                takeoff: takeoffAcc ? { ...takeoffAcc, ...(takeoffEval || {}), geoReferenced: !!takeoffGeo } : null,
                landing: landingAcc ? { ...landingAcc, ...(landingEval || {}), geoReferenced: !!landingGeo } : null,
                totalScoreDelta: 0,
                totalCashDelta: 0,
              },
            },
          });
          return;
        }

        // Apply deltas (same logic as before).
        const accuracy = { takeoff: takeoffAcc, landing: landingAcc };
        void accuracy;
        const currentScore = Number(flight?.xplane_data?.final_score ?? flight?.flight_score ?? 0);
        const adjustedScore = Math.max(0, Math.min(100, currentScore + totalScoreDelta));
        const adjustedProfit = Number(flight?.profit || 0) + totalCashDelta;
        const adjustedRevenue = Number(flight?.revenue || 0) + totalCashDelta;

        await base44.entities.Flight.update(flight.id, {
          flight_score: adjustedScore,
          overall_rating: (adjustedScore / 100) * 5,
          revenue: adjustedRevenue,
          profit: adjustedProfit,
          xplane_data: {
            ...(flight.xplane_data || {}),
            final_score: adjustedScore,
            runway_accuracy_applied: true,
            runway_accuracy: {
              takeoff: accuracy.takeoff ? { ...accuracy.takeoff, ...takeoffEval } : null,
              landing: accuracy.landing ? { ...accuracy.landing, ...landingEval } : null,
              totalScoreDelta,
              totalCashDelta,
            },
          },
        });

        if (totalCashDelta !== 0) {
          const user = await base44.auth.me();
          const cid = user?.company_id || user?.data?.company_id;
          let companyId = cid;
          if (!companyId) {
            const cs = await base44.entities.Company.filter({ created_by: user.email });
            companyId = cs[0]?.id;
          }
          if (companyId) {
            const companies = await base44.entities.Company.filter({ id: companyId });
            const co = companies[0];
            if (co) {
              await base44.entities.Company.update(companyId, {
                balance: (co.balance || 0) + totalCashDelta,
              });
              await base44.entities.Transaction.create({
                company_id: companyId,
                type: totalCashDelta >= 0 ? 'income' : 'expense',
                category: totalCashDelta >= 0 ? 'bonus' : 'other',
                amount: Math.abs(totalCashDelta),
                description: totalCashDelta >= 0
                  ? `Runway centerline bonus: ${finalContract?.title || 'Flight'}`
                  : `Runway centerline penalty: ${finalContract?.title || 'Flight'}`,
                reference_id: flight.id,
                date: new Date().toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.warn('Runway accuracy backfill failed:', err);
      }
    })();
  }, [flight?.id, flight?.status, flight?.xplane_data?.runway_accuracy_applied, finalContract?.payout]);

  // No route generation needed - map will use flight path data

  // If we don't have all required data, refetch queries instead of full reload
  React.useEffect(() => {
    if (!flight && contractId) {
      // Force refetch flight data after short delay (data may not be written yet)
      const timer = setTimeout(() => {
        window.location.reload();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [flight, contractId]);

  // All hooks must be called before any early returns
  const activeFailuresOnly = React.useMemo(() => {
    if (!flight) return [];
    const persisted = sanitizeFailureList(flight?.active_failures || [], lang, { bridgeOnly: true });
    const fromEventFlags = buildFailuresFromEventFlags(flight?.xplane_data?.events || {}, lang);
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
  }, [flight?.active_failures, flight?.xplane_data?.events, lang]);

  // These useMemo hooks MUST be before early returns to avoid hook count mismatch
  const landingMetrics = React.useMemo(() => resolveLandingMetricsFromFlight(flight), [flight]);
  const passengerCommentsDisplay = React.useMemo(() => {
    if (!flight) return [];
    const stored = Array.isArray(flight?.passenger_comments)
      ? flight.passenger_comments.filter((entry) => String(entry || "").trim().length > 0)
      : [];
    if (lang !== 'en') return stored;
    const germanHintRegex = /\b(der|die|das|und|nicht|flug|landung|kabine|passag|fuer|mit|keine|auf|waehrend)\b/i;
    const looksGerman = stored.some((entry) => germanHintRegex.test(String(entry || "")));
    if (stored.length > 0 && !looksGerman) return stored;
    const scoreForFallback = Number(flight?.xplane_data?.final_score ?? flight?.flight_score ?? 0) || 0;
    return generatePassengerComments(scoreForFallback, flight?.xplane_data || {}, 'en');
  }, [flight?.passenger_comments, flight?.xplane_data, flight?.flight_score, lang]);

  // Auto-grant type-rating if this was a successful training flight (≥80% score).
  const ratingGrantedRef = React.useRef(new Set());
  React.useEffect(() => {
    (async () => {
      if (!flight?.id || !finalContract?.briefing) return;
      const briefing = String(finalContract.briefing || '');
      const match = briefing.match(/__TR__:(.+)$/m);
      if (!match) return;
      const modelName = match[1].trim();
      if (!modelName) return;
      const guardKey = `${flight.id}|${modelName}`;
      if (ratingGrantedRef.current.has(guardKey)) return;
      ratingGrantedRef.current.add(guardKey);
      const score = Number(flight?.xplane_data?.final_score ?? flight?.flight_score ?? 0);
      if (score < 80) return;
      try {
        const { grantUserTypeRating } = await import('@/lib/typeRatings');
        await grantUserTypeRating(modelName);
      } catch (_) { /* noop */ }
    })();
  }, [flight?.id, finalContract?.briefing, flight?.flight_score, flight?.xplane_data?.final_score]);

  React.useEffect(() => {
    if (animTriggeredRef.current) return;
    if (!flight?.id || !finalContract?.id) return;
    if (skipAnimation) { animTriggeredRef.current = true; return; }
    try {
      const key = `flight_anim_seen_${flight.id}`;
      if (sessionStorage.getItem(key)) { animTriggeredRef.current = true; return; }
      sessionStorage.setItem(key, '1');
    } catch (_) { /* ignore */ }
    animTriggeredRef.current = true;
    setShowCompletionAnim(true);
  }, [flight?.id, finalContract?.id, skipAnimation]);

  if (!finalContract) {
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

  // Show loading if no flight data
  if (!flight) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Plane className="w-12 h-12 text-blue-400 mx-auto" />
          </div>
          <p className="text-white mb-4">{t('loading', lang)}</p>
        </div>
      </div>
    );
  }

  const emergencyOffAirportCompletion = !!flight?.xplane_data?.emergency_off_airport_completion;
  const emergencyScorePenalty = Number(flight?.xplane_data?.emergency_score_penalty || 0);
  const emergencyPayoutFactor = Number(flight?.xplane_data?.emergency_payout_factor || 1);
  const emergencyArrivalDistanceNm = Number(flight?.xplane_data?.arrival_distance_nm || 0);
  const estimateFuelUsedLiters = () => {
    if (flight.fuel_used_liters > 0) return Math.round(flight.fuel_used_liters);
    const xpd = flight.xplane_data || {};
    const initKg = Number(xpd.initial_fuel_kg || 0);
    let curKg = Number(xpd.fuelKg || xpd.fuel_kg || xpd.last_valid_fuel_kg || 0);
    const fuelPct = Number(xpd.fuel_percentage || xpd.fuel || 0);
    if (initKg > 0 && fuelPct > 0 && fuelPct <= 100) {
      const pctDerived = (initKg * fuelPct) / 100;
      if (curKg <= 0 || Math.abs(curKg - pctDerived) > (initKg * 0.55)) {
        curKg = pctDerived;
      }
    }
    if (initKg > 0) {
      curKg = Math.min(curKg, initKg);
      return Math.round(Math.max(0, initKg - curKg) * 1.25);
    }
    if (flight.flight_duration_hours > 0) return Math.round(flight.flight_duration_hours * 2500);
    return 0;
  };
  const basePayout = Number(finalContract?.payout || 0);
  const selectedDifficulty = normalizeChallengeDifficulty(
    flight?.xplane_data?.selected_difficulty || finalContract?.difficulty
  );
  const difficultyPayoutBonusPercent = Number.isFinite(Number(flight?.xplane_data?.difficulty_payout_bonus_percent))
    ? Number(flight.xplane_data.difficulty_payout_bonus_percent)
    : Math.round((DIFFICULTY_PAYOUT_BONUS_RATE[selectedDifficulty] || 0) * 100);
  const difficultyBonusEligible = !(
    flight?.xplane_data?.events?.crash ||
    ((flight?.xplane_data?.events?.wrong_airport || flight?.xplane_data?.landed_too_far_from_arrival) && !emergencyOffAirportCompletion)
  );
  const calculatedDifficultyBonus = difficultyBonusEligible
    ? Math.round(
        basePayout
        * (DIFFICULTY_PAYOUT_BONUS_RATE[selectedDifficulty] || 0)
        * (emergencyOffAirportCompletion ? emergencyPayoutFactor : 1)
      )
    : 0;
  const difficultyPayoutBonus = Number.isFinite(Number(flight?.xplane_data?.difficulty_payout_bonus))
    ? Number(flight.xplane_data.difficulty_payout_bonus)
    : calculatedDifficultyBonus;
  const difficultyLabel = DIFFICULTY_LABELS[selectedDifficulty]?.[lang === 'de' ? 'de' : 'en'] || selectedDifficulty;
  const emergencyPayoutReduction = emergencyOffAirportCompletion
    ? Math.max(0, Math.round(basePayout * (1 - emergencyPayoutFactor)))
    : 0;
  const landingVsValue = Math.max(0, Math.abs(Number(landingMetrics?.landingVs || 0) || 0));
  const resolvedLandingGValue = Math.max(0, Math.min(6, Number(landingMetrics?.landingG || 0) || 0));
  const flightDurationMinutes = Number(flight?.flight_duration_hours || 0) * 60;
  const fallbackDeadlineMinutes = (() => {
    const explicit = Number(
      flight?.xplane_data?.contract_deadline_minutes ??
      finalContract?.deadline_minutes ??
      0
    );
    if (explicit > 0) return explicit;
    const distanceNm = Number(
      finalContract?.distance_nm ??
      flight?.xplane_data?.contract_distance_nm ??
      0
    );
    if (distanceNm > 0) {
      return calculateDeadlineMinutes(
        distanceNm,
        flight?.xplane_data?.aircraft_icao || null,
        flight?.xplane_data?.fleet_aircraft_type || null
      );
    }
    return 0;
  })();
  const deadlineMinutesValue = Number(
    flight?.xplane_data?.deadlineMinutes ??
    flight?.xplane_data?.deadline_minutes ??
    fallbackDeadlineMinutes
  ) || 0;
  const timeScoreRaw = Number(
    flight?.xplane_data?.timeScoreChange ??
    flight?.xplane_data?.time_score_change
  );
  const timeScoreChangeValue = Number.isFinite(timeScoreRaw) ? Math.round(timeScoreRaw) : null;
  const bufferDeadlineMinutesValue = deadlineMinutesValue > 0 ? (deadlineMinutesValue + 5) : 0;
  const madeDeadlineValue = (() => {
    if (typeof flight?.xplane_data?.madeDeadline === 'boolean') return flight.xplane_data.madeDeadline;
    if (typeof flight?.xplane_data?.made_deadline === 'boolean') return flight.xplane_data.made_deadline;
    return null;
  })();
  const resolvedMadeDeadline = madeDeadlineValue !== null
    ? madeDeadlineValue
    : (deadlineMinutesValue > 0
        ? (flightDurationMinutes <= deadlineMinutesValue)
        : null);
  const deadlineState = (() => {
    if (timeScoreChangeValue === 5) return 'on_time';
    if (timeScoreChangeValue === 0) return 'buffer';
    if (timeScoreChangeValue === -20) return 'late';
    if (deadlineMinutesValue <= 0) return 'unknown';
    if (resolvedMadeDeadline === true) return 'on_time';
    if (flightDurationMinutes <= bufferDeadlineMinutesValue) return 'buffer';
    if (resolvedMadeDeadline === false) return 'late';
    return 'unknown';
  })();
  const wrongAirportCompletion = !!(
    flight?.xplane_data?.events?.wrong_airport ||
    flight?.xplane_data?.landed_too_far_from_arrival
  );
  const wrongAirportDistanceNm = Number(flight?.xplane_data?.arrival_distance_nm || 0);
  const isCrashFlight = !!flight?.xplane_data?.events?.crash;
  const showWrongAirportBanner = wrongAirportCompletion && !emergencyOffAirportCompletion && !isCrashFlight;
  const maintenanceDamageByCategory = (flight?.maintenance_damage && typeof flight.maintenance_damage === 'object')
    ? flight.maintenance_damage
    : ((flight?.xplane_data?.maintenance_damage && typeof flight.xplane_data.maintenance_damage === 'object')
        ? flight.xplane_data.maintenance_damage
        : {});

  // --- FALLBACK FINANCIALS ---
  // If the flight was aborted/closed without completeFlightMutation finishing,
  // many financial fields (revenue, fuel_cost, crew_cost, etc.) are null on the
  // Flight record. Derive best-effort display values from xplane_data + contract
  // so the user still sees numbers instead of "$0" everywhere.
  const xpdForFallback = flight?.xplane_data || {};
  const fallbackFlightDurationHours = (() => {
    if (Number(flight?.flight_duration_hours) > 0) return Number(flight.flight_duration_hours);
    const airborneMs = Date.parse(String(xpdForFallback.airborne_started_at || ''));
    const endMs = Date.parse(String(flight?.arrival_time || flight?.updated_date || ''));
    if (Number.isFinite(airborneMs) && Number.isFinite(endMs) && endMs > airborneMs) {
      return Math.max(0.01, (endMs - airborneMs) / 3600000);
    }
    const contractMin = Number(finalContract?.deadline_minutes || 0);
    if (contractMin > 0) return contractMin / 60;
    return 0;
  })();
  const fallbackFuelUsedLiters = estimateFuelUsedLiters();
  const displayFuelCost = Number(flight?.fuel_cost) > 0
    ? Number(flight.fuel_cost)
    : Math.round(fallbackFuelUsedLiters * 1.2);
  const displayCrewCost = Number(flight?.crew_cost) > 0
    ? Number(flight.crew_cost)
    : Math.round(fallbackFlightDurationHours * 250);
  const displayMaintenanceCost = Number(flight?.maintenance_cost) > 0
    ? Number(flight.maintenance_cost)
    : Math.round(fallbackFlightDurationHours * 400);
  const displayRevenue = Number(flight?.revenue) > 0
    ? Number(flight.revenue)
    : Math.round(basePayout
        - emergencyPayoutReduction
        + Number(difficultyPayoutBonus || 0)
        + Number(xpdForFallback.landingBonus || 0)
        - Number(xpdForFallback.landingPenalty || 0));
  const displayProfit = flight?.profit !== null && flight?.profit !== undefined
    ? Number(flight.profit)
    : (displayRevenue - displayFuelCost - displayCrewCost - displayMaintenanceCost - 150);
  const displayFlightDurationHours = fallbackFlightDurationHours;

  // --- CENTERLINE DELTAS (for inclusion in landing-quality box) ---
  const runwayAccuracyData = flight?.xplane_data?.runway_accuracy || null;
  const centerlineScoreDelta = Number(runwayAccuracyData?.totalScoreDelta || 0);
  const centerlineCashDelta = Number(runwayAccuracyData?.totalCashDelta || 0);


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
            {'<'} {t('back', lang)}
          </Button>
          <div className="text-lg font-mono font-bold text-cyan-400 uppercase tracking-widest px-2">{finalContract.title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 text-slate-400 text-[10px] font-mono uppercase bg-slate-950 px-2 py-1 rounded border border-slate-800">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-600" />
              {finalContract.departure_airport}
            </span>
            <span>{'->'}</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-600" />
              {finalContract.arrival_airport}
            </span>
            <span className="text-slate-600">|</span>
            <span>{finalContract.distance_nm} NM</span>
          </div>
          {isCrashFlight ? (
            <Badge className="bg-red-900/40 text-red-400 border-red-700/50 flex items-center gap-1 text-[10px] font-mono uppercase h-7 rounded">
              <AlertTriangle className="w-3 h-3" />
              CRASH
            </Badge>
          ) : (showWrongAirportBanner || flight?.status === 'failed') ? (
            <Badge className="bg-red-900/40 text-red-400 border-red-700/50 flex items-center gap-1 text-[10px] font-mono uppercase h-7 rounded">
              <AlertTriangle className="w-3 h-3" />
              FAILED
            </Badge>
          ) : (
            <Badge className="bg-emerald-900/40 text-emerald-400 border-emerald-700/50 text-[10px] font-mono uppercase h-7 rounded">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {t('completed', lang)}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {showWrongAirportBanner && (
          <Card className="mb-2 p-4 bg-red-900/25 border border-red-700/60">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold">
                  {t('wrong_airport_result_title', lang)}
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  {t('wrong_airport_result_desc', lang)}{' '}
                  {wrongAirportDistanceNm > 0 && (
                    <span className="text-red-300 font-mono">({Math.round(wrongAirportDistanceNm)} NM)</span>
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}
        {flight ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Flight Route Map */}
              {finalContract && (() => {
                // Build departure/arrival coords from xplane_data or flight_path
                const xpd = flight?.xplane_data || {};
                const fp = (Array.isArray(xpd.flight_path) ? xpd.flight_path : [])
                  .map((p) => {
                    if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
                    if (p && typeof p === 'object') return [Number(p.lat ?? p.latitude), Number(p.lon ?? p.lng ?? p.longitude)];
                    return null;
                  })
                  .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && !(p[0] === 0 && p[1] === 0));
                const mapRouteWaypoints = (Array.isArray(xpd.simbrief_waypoints) && xpd.simbrief_waypoints.length > 0)
                  ? xpd.simbrief_waypoints
                  : (xpd.fms_waypoints || []);
                const depLat = xpd.departure_lat || (fp.length > 0 ? fp[0][0] : 0);
                const depLon = xpd.departure_lon || (fp.length > 0 ? fp[0][1] : 0);
                const arrLat = xpd.arrival_lat || (fp.length > 1 ? fp[fp.length-1][0] : 0);
                const arrLon = xpd.arrival_lon || (fp.length > 1 ? fp[fp.length-1][1] : 0);
                return (
                  <FlightMapIframe
                    flightData={{
                      latitude: 0, longitude: 0,
                      departure_lat: depLat, departure_lon: depLon,
                      arrival_lat: arrLat, arrival_lon: arrLon,
                      heading: 0, altitude: 0, speed: 0,
                    }}
                    contract={finalContract}
                    staticMode={true}
                    title="Flugroute & Flugverlauf"
                    flightPath={fp}
                    flightEventsLog={(() => {
                      const rawLog = (Array.isArray(xpd.flight_events_log) && xpd.flight_events_log.length > 0)
                        ? xpd.flight_events_log
                        : (Array.isArray(xpd.bridge_event_log) ? xpd.bridge_event_log : []);
                      // Filter out stale 'crash' markers when xplane_data.events.crash
                      // is explicitly false (false-positive from earlier session/bridge).
                      const events = xpd.events || {};
                      const authoritativeCrashFalse = events?.crash === false || events?.crash === 0;
                      if (!authoritativeCrashFalse) return rawLog;
                      return rawLog.filter((entry) => {
                        const type = String((typeof entry === 'string' ? entry : entry?.type) || '').toLowerCase();
                        return type !== 'crash' && type !== 'crashed' && type !== 'has_crashed';
                      });
                    })()}
                    routeWaypoints={mapRouteWaypoints}
                    departureCoords={depLat ? { lat: depLat, lon: depLon } : null}
                    arrivalCoords={arrLat ? { lat: arrLat, lon: arrLon } : null}
                  />
                );
              })()}

              {/* Flight Profile Chart */}
              <FlightProfileChart flight={flight} />

              {/* Takeoff 3D Replay Button */}
              <button
                onClick={() => setShowTakeoff3D(true)}
                className="group relative w-full overflow-hidden rounded-md border border-emerald-500/40 bg-slate-950 hover:border-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]"
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <span className="pointer-events-none absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                <span className="pointer-events-none absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                <span className="pointer-events-none absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                <span className="pointer-events-none absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
                <div className="relative flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                      <span className="relative flex items-center justify-center w-8 h-8 rounded-full border border-emerald-400 bg-emerald-950">
                        <Play className="w-3.5 h-3.5 text-emerald-300 fill-emerald-300" />
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-500">
                        {lang === 'de' ? 'Flight Data Replay' : 'Flight Data Replay'}
                      </p>
                      <p className="text-sm font-mono font-bold uppercase tracking-wider text-emerald-300">
                        {lang === 'de' ? 'Takeoff · 3D' : 'Takeoff · 3D'}
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded border border-emerald-900/60 bg-emerald-950/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">T+30s</span>
                  </div>
                </div>
              </button>

              {/* Final Approach 3D Replay Button */}
              <button
                onClick={() => setShowApproach3D(true)}
                className="group relative w-full overflow-hidden rounded-md border border-cyan-500/40 bg-slate-950 hover:border-cyan-400 transition-all shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:shadow-[0_0_30px_rgba(34,211,238,0.35)]"
              >
                {/* Animated scanline */}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                {/* Corner brackets */}
                <span className="pointer-events-none absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
                <span className="pointer-events-none absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
                <span className="pointer-events-none absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
                <span className="pointer-events-none absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
                <div className="relative flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping" />
                      <span className="relative flex items-center justify-center w-8 h-8 rounded-full border border-cyan-400 bg-cyan-950">
                        <Play className="w-3.5 h-3.5 text-cyan-300 fill-cyan-300" />
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-500">
                        {lang === 'de' ? 'Flight Data Replay' : 'Flight Data Replay'}
                      </p>
                      <p className="text-sm font-mono font-bold uppercase tracking-wider text-cyan-300">
                        {lang === 'de' ? 'Final Approach · 3D' : 'Final Approach · 3D'}
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded border border-cyan-900/60 bg-cyan-950/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-cyan-400">T-30s</span>
                  </div>
                </div>
              </button>

              {/* Flight Rating */}
              <FlightRating flight={flight} />

              {/* Landing Quality Visual */}
              <LandingQualityVisual flight={flight} gameSettings={gameSettings} />

              {/* Runway Centerline Accuracy (Takeoff + Landing) */}
              <RunwayAccuracyCard flight={flight} />

              {/* Flight Details */}
              <Card className="p-4 sm:p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                   <Plane className="w-5 h-5 text-blue-400" />
                   {t('flight_details', lang)}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {(() => {
                    const isCrash = flight?.xplane_data?.events?.crash || flight?.status === 'failed';
                    const landingG = resolvedLandingGValue;
                    return (
                      <div className="p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                        <p className="text-slate-400 text-sm mb-1">{t('landing_g_touch', lang)}</p>
                        {isCrash ? (
                          <p className="text-2xl font-mono font-bold text-red-500">CRASH</p>
                        ) : (
                          <p className={`text-2xl font-mono font-bold ${
                            landingG < 1.5 ? 'text-emerald-400' :
                            landingG < 2.0 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {landingG > 0 ? `${landingG.toFixed(2)} G` : '-'}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">{t('landing_vs_label', lang)}</p>
                    <p className={`text-2xl font-mono font-bold ${
                      Math.abs(landingVsValue) < 150 ? 'text-emerald-400' :
                      Math.abs(landingVsValue) < 300 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(Math.abs(landingVsValue))} ft/min
                    </p>
                  </div>
                  <div className="p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">{t('landing_speed', lang)}</p>
                    <p className="text-2xl font-mono font-bold text-blue-400">
                      {Math.round(flight?.xplane_data?.speed || 0)} kts
                    </p>
                  </div>
                  <div className="p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">{t('fuel_used', lang)}</p>
                    <p className="text-2xl font-mono font-bold text-blue-400">
                      {fallbackFuelUsedLiters.toLocaleString()} L
                    </p>
                  </div>
                  <div className="p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">{t('flight_duration', lang)}</p>
                    <p className="text-2xl font-mono font-bold text-slate-300">
                      {displayFlightDurationHours.toFixed(1)} h
                    </p>
                  </div>
                </div>

                {/* Deadline Result */}
                {(deadlineMinutesValue > 0 || timeScoreChangeValue !== null) && (
                  <div className="mt-4 p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                    <p className="text-slate-400 text-sm mb-1">{t('deadline', lang)}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">
                          {deadlineMinutesValue > 0
                            ? (lang === 'de'
                                ? `Vorgabe: ${Math.round(deadlineMinutesValue)} min | Puffer bis: ${Math.round(bufferDeadlineMinutesValue)} min | Geflogen: ${Math.round(flightDurationMinutes)} min`
                                : `Target: ${Math.round(deadlineMinutesValue)} min | Buffer until: ${Math.round(bufferDeadlineMinutesValue)} min | Flown: ${Math.round(flightDurationMinutes)} min`)
                            : (lang === 'de' ? 'Deadline-Details nicht verfuegbar' : 'Deadline details unavailable')}
                        </p>
                      </div>
                      {deadlineState === 'on_time' ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">
                            {lang === 'de' ? '+5 Punkte' : '+5 points'}
                          </span>
                        </div>
                      ) : deadlineState === 'buffer' ? (
                        <div className="flex items-center gap-2">
                          <Timer className="w-5 h-5 text-amber-400" />
                          <span className="text-amber-300 font-bold">
                            {lang === 'de' ? 'Puffer (0 Punkte)' : 'Buffer (0 points)'}
                          </span>
                        </div>
                      ) : deadlineState === 'late' ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-bold">
                            {lang === 'de' ? '-20 Punkte' : '-20 points'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Timer className="w-5 h-5 text-slate-400" />
                          <span className="text-slate-300 font-bold">-</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Final Score */}
                <div className="mt-4 p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                  <p className="text-slate-400 text-sm mb-1">
                    {lang === 'de' ? 'Finaler Flug-Score' : 'Final Flight Score'}
                  </p>
                  {(() => {
                    const score = flight?.xplane_data?.final_score ?? flight?.flight_score ?? 0;
                    return (
                      <p className={`text-3xl font-mono font-bold ${
                        score >= 95 ? 'text-emerald-400' :
                        score >= 85 ? 'text-green-400' :
                        score >= 70 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {Math.round(score)} / 100
                      </p>
                    );
                  })()}
                  {activeFailuresOnly.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-600/60">
                      <p className="text-xs text-slate-400 mb-2">
                        {lang === 'de' ? 'Ausgeloeste Ausfaelle:' : 'Triggered failures:'}
                      </p>
                      <ActiveFailuresDisplay failures={activeFailuresOnly} compact />
                    </div>
                  )}
                </div>

                {Array.isArray(flight?.xplane_data?.achievements_unlocked) && flight.xplane_data.achievements_unlocked.length > 0 && (
                  <div className="mt-4">
                    <AchievementUnlockList
                      achievements={flight.xplane_data.achievements_unlocked}
                      xpBonus={flight.xplane_data.achievements_xp_bonus}
                      cashBonus={flight.xplane_data.achievements_cash_bonus}
                      lang={lang}
                    />
                  </div>
                )}

                {emergencyOffAirportCompletion && (
                  <div className="mt-4 p-4 bg-amber-900/25 border border-amber-700/50 rounded-lg">
                    <p className="text-sm font-semibold text-amber-300 mb-2">
                      {lang === 'de' ? 'Notlandung ausserhalb Zielflughafen erkannt' : 'Emergency off-airport landing detected'}
                    </p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-300">{lang === 'de' ? 'Distanz zum Zielflughafen' : 'Distance to destination airport'}</span>
                        <span className="text-amber-300 font-mono">{Math.round(emergencyArrivalDistanceNm)} NM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">{lang === 'de' ? 'Notlandungs-Scoreabzug' : 'Emergency score penalty'}</span>
                        <span className="text-red-400 font-mono">-{Math.round(emergencyScorePenalty)} {lang === 'de' ? 'Punkte' : 'points'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">{lang === 'de' ? 'Payout-Reduktion (auf 30%)' : 'Payout reduction (to 30%)'}</span>
                        <span className="text-red-400 font-mono">-${Math.round(emergencyPayoutReduction).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Landing Quality Details */}
                {(() => {
                  // Determine landing type: prefer stored, then compute from G-force
                  let lt = flight.xplane_data?.landingType;
                  const landingG = resolvedLandingGValue;
                  if (!lt && landingG > 0 && !flight.xplane_data?.events?.crash) {
                    if (landingG < 1.0) lt = 'butter';
                    else if (landingG < 1.2) lt = 'soft';
                    else if (landingG < 1.6) lt = 'acceptable';
                    else if (landingG < 2.0) lt = 'hard';
                    else lt = 'very_hard';
                  }
                  if (!lt) return null;

                  // Compute score/financial impact from landing type
                  const totalRev = flight.revenue || flight.xplane_data?.totalRevenue || 0;
                  let scoreChange = 0;
                  let financialImpact = 0;
                  
                  if (lt === 'butter') { scoreChange = 40; financialImpact = totalRev * 4; }
                  else if (lt === 'soft') { scoreChange = 20; financialImpact = totalRev * 2; }
                  else if (lt === 'acceptable') { scoreChange = 5; financialImpact = 0; }
                  else if (lt === 'hard') { scoreChange = -30; financialImpact = -(totalRev * 0.25); }
                  else if (lt === 'very_hard') { scoreChange = -50; financialImpact = -(totalRev * 0.5); }
                  const vs = Math.round(Math.abs(landingVsValue));

                  return (
                  <div className="mt-4 p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg space-y-3">
                    <div>
                      <p className="text-slate-400 text-sm mb-2 font-semibold">{lang === 'de' ? 'Landungsqualitaets-Analyse' : 'Landing quality analysis'}</p>
                      <p className="text-xs text-slate-400 mb-3">{lang === 'de' ? `Basierend auf G-Kraft beim Landen (${landingG.toFixed(2)} G)` : `Based on touchdown G-force (${landingG.toFixed(2)} G)`}</p>
                    </div>

                    {/* Landing Type */}
                    <div className="flex items-center gap-2">
                      {lt === 'crash' && (
                        <>
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="text-red-500 font-bold">CRASH</span>
                          <span className="text-slate-400 ml-2">({vs} ft/min)</span>
                        </>
                      )}
                      {lt === 'very_hard' && (
                        <>
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <span className="text-red-500 font-bold">{lang === 'de' ? 'Sehr harte Landung' : 'Very hard landing'}</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'hard' && (
                        <>
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-bold">{lang === 'de' ? 'Harte Landung' : 'Hard landing'}</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'acceptable' && (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-blue-400" />
                          <span className="text-blue-400 font-semibold">{lang === 'de' ? 'Akzeptable Landung' : 'Acceptable landing'}</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'soft' && (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">{lang === 'de' ? 'Weiche Landung' : 'Soft landing'}</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      {lt === 'butter' && (
                        <>
                          <Star className="w-5 h-5 text-amber-400" />
                          <span className="text-amber-400 font-bold">{lang === 'de' ? 'BUTTERWEICHE LANDUNG!' : 'BUTTER LANDING!'}</span>
                          <span className="text-slate-400 ml-2">({landingG.toFixed(2)} G)</span>
                        </>
                      )}
                      </div>

                      {/* Score and Cost Impact */}
                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">{lang === 'de' ? 'Score-Auswirkung' : 'Score impact'}</p>
                        <p className={`font-mono font-bold ${
                          scoreChange > 0 ? 'text-emerald-400' :
                          scoreChange < 0 ? 'text-red-400' :
                          'text-slate-400'
                        }`}>
                          {scoreChange > 0 ? '+' : ''}{scoreChange} {lang === 'de' ? 'Punkte' : 'points'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">{lang === 'de' ? 'Finanzielle Auswirkung' : 'Financial impact'}</p>
                        {financialImpact > 0 ? (
                          <p className="font-mono font-bold text-emerald-400">
                           +${Math.round(financialImpact).toLocaleString()}
                          </p>
                        ) : financialImpact < 0 ? (
                          <p className="font-mono font-bold text-red-400">
                           -${Math.round(Math.abs(financialImpact)).toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-slate-400">$0</p>
                        )}
                      </div>
                      </div>

                      {/* Centerline accuracy impact (takeoff + landing combined) */}
                      {runwayAccuracyData && (runwayAccuracyData.takeoff || runwayAccuracyData.landing) && (
                        <div className="pt-3 border-t border-slate-700">
                          <p className="text-xs text-slate-400 mb-2 font-semibold">
                            {lang === 'de' ? 'Centerline-Präzision (Start + Landung)' : 'Centerline precision (takeoff + landing)'}
                          </p>
                          {(runwayAccuracyData.takeoff || runwayAccuracyData.landing) && (
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {runwayAccuracyData.takeoff && (
                                <div className="p-2 bg-slate-800/60 rounded border border-slate-700">
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{lang === 'de' ? 'Start' : 'Takeoff'}</p>
                                  <p className="text-xs font-mono text-slate-200">
                                    Ø {Number(runwayAccuracyData.takeoff.rmsMeters || 0).toFixed(1)} m
                                  </p>
                                </div>
                              )}
                              {runwayAccuracyData.landing && (
                                <div className="p-2 bg-slate-800/60 rounded border border-slate-700">
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{lang === 'de' ? 'Landung' : 'Landing'}</p>
                                  <p className="text-xs font-mono text-slate-200">
                                    Ø {Number(runwayAccuracyData.landing.rmsMeters || 0).toFixed(1)} m
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-slate-400 mb-1">{lang === 'de' ? 'Score-Auswirkung' : 'Score impact'}</p>
                              <p className={`font-mono font-bold ${
                                centerlineScoreDelta > 0 ? 'text-emerald-400' :
                                centerlineScoreDelta < 0 ? 'text-red-400' :
                                'text-slate-400'
                              }`}>
                                {centerlineScoreDelta > 0 ? '+' : ''}{centerlineScoreDelta} {lang === 'de' ? 'Punkte' : 'points'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-1">{lang === 'de' ? 'Finanzielle Auswirkung' : 'Financial impact'}</p>
                              {centerlineCashDelta > 0 ? (
                                <p className="font-mono font-bold text-emerald-400">+${Math.round(centerlineCashDelta).toLocaleString()}</p>
                              ) : centerlineCashDelta < 0 ? (
                                <p className="font-mono font-bold text-red-400">-${Math.round(Math.abs(centerlineCashDelta)).toLocaleString()}</p>
                              ) : (
                                <p className="text-slate-400">$0</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      </div>
                  );
                })()}

                      {/* Live Maintenance Costs */}
                  {flight.xplane_data?.maintenanceCost > 0 && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
                      <p className="text-sm text-red-300 mb-2">
                        {lang === 'de' ? 'Wartungskosten im Flug:' : 'In-flight maintenance costs:'}
                      </p>
                      <p className="text-2xl font-bold text-red-400">${Math.round(flight.xplane_data.maintenanceCost || 0).toLocaleString()}</p>
                    </div>
                  )}

                  {/* Total Maintenance Breakdown */}
                  {(flight.xplane_data?.maintenanceCost > 0 || flight.xplane_data?.crashMaintenanceCost > 0 || flight.xplane_data?.events?.crash) && (
                    <div className="mt-4 p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg space-y-2">
                     <h4 className="text-sm font-semibold text-white mb-3">
                       {lang === 'de' ? 'Wartungskosten-Aufschluesselung:' : 'Maintenance cost breakdown:'}
                     </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-300">
                          <span>
                            {lang === 'de'
                              ? `Regulaere Wartung (${flight.flight_duration_hours?.toFixed(1)}h x $400/h)`
                              : `Regular maintenance (${flight.flight_duration_hours?.toFixed(1)}h x $400/h)`}
                          </span>
                          <span className="text-amber-400">${Math.round((flight.flight_duration_hours || 0) * 400).toLocaleString()}</span>
                        </div>
                        {flight.xplane_data?.maintenanceCost > 0 && (
                          <div className="flex justify-between text-slate-300">
                          <span>{lang === 'de' ? 'Event-Schaeden im Flug' : 'Event damage during flight'}</span>
                            <span className="text-red-400">${Math.round(flight.xplane_data.maintenanceCost || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {flight.xplane_data?.crashMaintenanceCost > 0 && (
                          <div className="flex justify-between text-slate-300">
                            <span>{lang === 'de' ? 'Crash-Reparatur (70% des Neuwertes)' : 'Crash repair (70% of new value)'}</span>
                            <span className="text-red-500 font-bold">${Math.round(flight.xplane_data.crashMaintenanceCost || 0).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-slate-700 font-bold">
                          <span className="text-white">{lang === 'de' ? 'Gesamt Wartungskosten' : 'Total maintenance costs'}</span>
                          <span className="text-red-400">${Math.round(flight.maintenance_cost || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Failures during flight */}
                  {activeFailuresOnly.length > 0 && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
                      <ActiveFailuresDisplay failures={activeFailuresOnly} />
                    </div>
                  )}

                  {/* Maintenance Damage Breakdown */}
                  {Object.values(maintenanceDamageByCategory).some(v => Number(v) > 0) && (
                    <div className="mt-4 p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                     <h4 className="text-sm font-semibold text-white mb-3">
                       {lang === 'de' ? 'Wartungsschaeden durch diesen Flug:' : 'Maintenance wear caused by this flight:'}
                     </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(maintenanceDamageByCategory).filter(([_, v]) => Number(v) > 0).map(([cat, dmg]) => {
                          const labels = lang === 'de' ? {
                            engine: "Triebwerk", hydraulics: "Hydraulik", avionics: "Avionik",
                            airframe: "Struktur", landing_gear: "Fahrwerk", electrical: "Elektrik",
                            flight_controls: "Steuerung", pressurization: "Druckkabine"
                          } : {
                            engine: "Engine", hydraulics: "Hydraulics", avionics: "Avionics",
                            airframe: "Airframe", landing_gear: "Landing Gear", electrical: "Electrical",
                            flight_controls: "Flight Controls", pressurization: "Pressurization"
                          };
                          return (
                            <div key={cat} className="flex justify-between p-2 bg-slate-600/30 border border-slate-600/40 rounded">
                              <span className="text-slate-400">{labels[cat] || cat}</span>
                              <span className="text-red-400 font-mono">+{Number(dmg).toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Flight Events */}
                  {(() => {
                    const events = flight?.xplane_data?.events || {};
                    const rawFlightEventsLog = Array.isArray(flight?.xplane_data?.flight_events_log)
                      ? flight.xplane_data.flight_events_log
                      : [];
                    const rawBridgeEventsLog = Array.isArray(flight?.xplane_data?.bridge_event_log)
                      ? flight.xplane_data.bridge_event_log
                      : [];
                    const normalizeEventType = (value) => {
                      const type = String(value || "")
                        .trim()
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "_");
                      if (!type) return "";
                      if (type === "crashed" || type === "has_crashed") return "crash";
                      if (type === "high_g" || type === "highg") return "high_g_force";
                      if (type === "hardlanding") return "hard_landing";
                      if (type === "wrong_destination" || type === "wrong_airport_landing") return "wrong_airport";
                      if (type === "fuel_emergency_low") return "fuel_emergency";
                      if (type === "flaps_overspeeding") return "flaps_overspeed";
                      return type;
                    };
                    // Authoritative crash flag from xplane_data.events.crash.
                    // Some bridge sessions persist stale crash markers in the
                    // flight_events_log (e.g. SimConnect "crash" pings during
                    // a normal landing roll). If events.crash is explicitly
                    // false, ignore any "crash" entries in the event log so
                    // they don't show up as a phantom incident.
                    const authoritativeCrashFalse = events?.crash === false || events?.crash === 0;
                    const logTypes = new Set(
                      [...rawFlightEventsLog, ...rawBridgeEventsLog]
                        .map((entry) => normalizeEventType(typeof entry === "string" ? entry : entry?.type))
                        .filter(Boolean)
                        .filter((type) => !(authoritativeCrashFalse && type === "crash"))
                    );
                    const isTruthyEvent = (value) => (
                      value === true ||
                      value === 1 ||
                      value === "1" ||
                      String(value || "").toLowerCase() === "true"
                    );
                    const eventAliasByKey = {
                      tailstrike: ["tailstrike"],
                      stall: ["stall", "is_in_stall", "stall_warning"],
                      overstress: ["overstress", "structural_damage"],
                      overspeed: ["overspeed", "over_speed"],
                      flaps_overspeed: ["flaps_overspeed", "flaps_overspeeding", "flaps_overspeed_warning"],
                      gear_up_landing: ["gear_up_landing"],
                      crash: ["crash", "crashed", "has_crashed"],
                      harsh_controls: ["harsh_controls", "harsh_control_inputs"],
                      high_g_force: ["high_g_force", "high_g", "highg"],
                      hard_landing: ["hard_landing", "hardlanding"],
                      wrong_airport: ["wrong_airport", "wrong_destination", "wrong_airport_landing"],
                      fuel_emergency: ["fuel_emergency", "fuel_emergency_low"],
                    };
                    const hasEvent = (key) => {
                      const aliases = eventAliasByKey[key] || [key];
                      return aliases.some((alias) => isTruthyEvent(events?.[alias]) || logTypes.has(normalizeEventType(alias)));
                    };
                    const hasFuelEmergency = hasEvent("fuel_emergency")
                      && (flight?.xplane_data?.fuel_percentage || flight?.xplane_data?.fuel || 100) < 3;
                    const hasAnyIncident =
                      hasEvent("tailstrike") ||
                      hasEvent("stall") ||
                      hasEvent("overstress") ||
                      hasEvent("overspeed") ||
                      hasEvent("flaps_overspeed") ||
                      hasEvent("gear_up_landing") ||
                      hasEvent("crash") ||
                      hasEvent("harsh_controls") ||
                      hasEvent("high_g_force") ||
                      hasEvent("hard_landing") ||
                      hasFuelEmergency ||
                      hasEvent("wrong_airport");
                    if (!hasAnyIncident) return null;

                    return (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">
                          {lang === 'de' ? 'Vorfaelle waehrend des Fluges:' : 'Incidents during the flight:'}
                        </h4>
                        <div className="space-y-2">
                          {hasEvent("tailstrike") && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Heckaufsetzer' : 'Tailstrike'}
                            </div>
                          )}
                          {hasEvent("stall") && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Stroemungsabriss' : 'Stall'}
                            </div>
                          )}
                          {hasEvent("overstress") && (
                            <div className="flex items-center gap-2 text-orange-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Strukturbelastung' : 'Structural stress'}
                            </div>
                          )}
                          {hasEvent("overspeed") && (
                            <div className="flex items-center gap-2 text-orange-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              Overspeed
                            </div>
                          )}
                          {hasEvent("flaps_overspeed") && (
                            <div className="flex items-center gap-2 text-orange-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Klappen-Overspeed' : 'Flaps overspeed'}
                            </div>
                          )}
                          {hasEvent("gear_up_landing") && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Landung ohne Fahrwerk' : 'Gear-up landing'}
                            </div>
                          )}
                          {hasEvent("crash") && (
                            <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'CRASH (-100 Punkte, Wartung: 70% Neuwert)' : 'CRASH (-100 points, maintenance: 70% new value)'}
                            </div>
                          )}
                          {hasEvent("harsh_controls") && (
                            <div className="flex items-center gap-2 text-orange-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Ruppige Steuerung' : 'Harsh controls'}
                            </div>
                          )}
                          {hasEvent("high_g_force") && (
                            <div className="flex items-center gap-2 text-orange-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Hohe G-Kraefte' : 'High G-forces'}
                            </div>
                          )}
                          {hasEvent("hard_landing") && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Harte Landung' : 'Hard landing'}
                            </div>
                          )}
                          {hasFuelEmergency && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Treibstoff-Notstand (unter 3%)' : 'Fuel emergency (below 3%)'}
                            </div>
                          )}
                          {hasEvent("wrong_airport") && (
                            <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                              <AlertTriangle className="w-4 h-4" />
                              {lang === 'de' ? 'Landung am falschen Zielflughafen' : 'Landed at wrong destination airport'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                      </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Financial Summary */}
              <Card className="p-6 bg-slate-800/50 border-slate-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                   <DollarSign className="w-5 h-5 text-amber-400" />
                   {t('financial_overview', lang)}
                  </h3>
                <div className="space-y-3">
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-slate-400">{t('payout', lang)}</span>
                     <span className="text-emerald-400 font-mono">${Math.round(finalContract?.payout || 0).toLocaleString()}</span>
                   </div>
                   {emergencyOffAirportCompletion && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-amber-300">{lang === 'de' ? 'Notlandung Payout-Abzug (70%)' : 'Emergency payout reduction (70%)'}</span>
                     <span className="text-red-400 font-mono">-${Math.round(emergencyPayoutReduction).toLocaleString()}</span>
                   </div>
                   )}
                   {difficultyPayoutBonusPercent > 0 && difficultyPayoutBonus > 0 && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-emerald-300">
                       {lang === 'de'
                         ? `Schwierigkeitsbonus (${difficultyLabel} +${Math.round(difficultyPayoutBonusPercent)}%)`
                         : `Difficulty bonus (${difficultyLabel} +${Math.round(difficultyPayoutBonusPercent)}%)`}
                     </span>
                     <span className="text-emerald-400 font-mono">+${Math.round(difficultyPayoutBonus).toLocaleString()}</span>
                   </div>
                   )}
                   {flight?.xplane_data?.landingBonus > 0 && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-slate-400">{t('landing_bonus', lang)}</span>
                     <span className="text-emerald-400 font-mono">+${Math.round(flight.xplane_data.landingBonus).toLocaleString()}</span>
                   </div>
                   )}
                   {flight?.xplane_data?.landingPenalty > 0 && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-slate-400">{t('landing_penalty', lang)}</span>
                     <span className="text-red-400 font-mono">-${Math.round(flight.xplane_data.landingPenalty).toLocaleString()}</span>
                   </div>
                   )}
                   {flight?.xplane_data?.levelBonus > 0 && (
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-amber-400">
                       {lang === 'de'
                         ? `Level-Bonus (Lv.${flight.xplane_data.companyLevel || 1} x ${flight.xplane_data.levelBonusPercent?.toFixed(0) || 1}%)`
                         : `Level bonus (Lv.${flight.xplane_data.companyLevel || 1} x ${flight.xplane_data.levelBonusPercent?.toFixed(0) || 1}%)`}
                     </span>
                     <span className="text-amber-400 font-mono">+${Math.round(flight.xplane_data.levelBonus).toLocaleString()}</span>
                   </div>
                   )}
                   <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                     <span className="text-slate-400">
                       {lang === 'de'
                         ? `Treibstoff (${fallbackFuelUsedLiters.toLocaleString()} L)`
                         : `Fuel (${fallbackFuelUsedLiters.toLocaleString()} L)`}
                     </span>
                    <span className="text-red-400 font-mono">-${Math.round(displayFuelCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">
                      {lang === 'de'
                        ? `Crew (${displayFlightDurationHours.toFixed(1)}h)`
                        : `Crew (${displayFlightDurationHours.toFixed(1)}h)`}
                    </span>
                    <span className="text-red-400 font-mono">-${Math.round(displayCrewCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">
                      {lang === 'de'
                        ? `Wartung (${displayFlightDurationHours.toFixed(1)}h + Events)`
                        : `Maintenance (${displayFlightDurationHours.toFixed(1)}h + events)`}
                    </span>
                    <span className="text-red-400 font-mono">-${Math.round(displayMaintenanceCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                    <span className="text-slate-400">{lang === 'de' ? 'Flughafen-Gebuehren' : 'Airport fees'}</span>
                    <span className="text-red-400 font-mono">-$150</span>
                  </div>
                  {Number(flight?.xplane_data?.loan_payment) > 0 && (
                    <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                      <span className="text-slate-400">
                        {lang === 'de' ? 'Kreditrate (diese Flug)' : 'Loan installment (this flight)'}
                        {flight.xplane_data.loan_fully_paid && (
                          <span className="ml-2 text-emerald-400 text-xs">
                            {lang === 'de' ? '✓ getilgt' : '✓ paid off'}
                          </span>
                        )}
                      </span>
                      <span className="text-red-400 font-mono">-${Math.round(flight.xplane_data.loan_payment).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                    <span className="font-semibold text-white">{t('total_revenue', lang)}</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      ${Math.round(displayRevenue).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3">
                    <span className="font-semibold text-white">{t('profit_loss', lang)}</span>
                    <span className={`text-xl font-bold font-mono ${
                      displayProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      ${Math.round(displayProfit).toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Passenger Comments */}
              {passengerCommentsDisplay && passengerCommentsDisplay.length > 0 && (
                <Card className="p-6 bg-slate-800/50 border-slate-700">
                  <h3 className="text-lg font-semibold mb-4 text-white">{t('passenger_comments', lang)}</h3>
                  <div className="space-y-2">
                    {passengerCommentsDisplay.map((comment, idx) => (
                      <p key={idx} className="text-slate-300 text-sm">
                        "{comment}"
                      </p>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <Card className="p-12 text-center bg-slate-800 border border-slate-700">
            <AlertTriangle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">{t('no_flight_data', lang)}</h3>
            <p className="text-slate-400">
              {t('no_flight_data_desc', lang)}
            </p>
          </Card>
        )}
      </div>

      {showApproach3D && flight && (
        <FinalApproach3D flight={flight} phase="landing" onClose={() => setShowApproach3D(false)} />
      )}
      {showTakeoff3D && flight && (
        <FinalApproach3D flight={flight} phase="takeoff" onClose={() => setShowTakeoff3D(false)} />
      )}
      {showCompletionAnim && flight && finalContract && (
        <FlightCompletionAnimation
          flight={flight}
          contract={finalContract}
          lang={lang}
          onContinue={() => setShowCompletionAnim(false)}
        />
      )}
    </div>
  );
}
