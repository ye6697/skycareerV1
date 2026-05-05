// Builds the ctx object consumed by ACHIEVEMENTS[].check.
import { ACHIEVEMENTS } from "./achievementDefinitions";
import { resolveAircraftValueSnapshot } from "@/lib/maintenance";

const FT = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const hasEventFlag = (f, keys) => {
  const xpd = f?.xplane_data || {};
  return keys.some(k => {
    if (f?.[k]) return true;
    if (xpd?.[k]) return true;
    if (xpd?.events?.[k]) return true;
    return false;
  });
};

const isCompleted = (f) => {
  const status = String(f?.status || "").toLowerCase();
  return status === "completed" || status === "landed";
};

const isFailed = (f) => {
  const status = String(f?.status || "").toLowerCase();
  if (status === "cancelled" || status === "failed") return true;
  return hasEventFlag(f, ["crash", "has_crashed", "crashed"]);
};

const aircraftTypeOf = (f, aircraftById) => {
  const ac = aircraftById?.[f?.aircraft_id];
  if (ac?.type) return ac.type;
  const fromXpd = f?.xplane_data?.aircraft_type;
  return fromXpd || "unknown";
};

const extractAirports = (f) => {
  const xpd = f?.xplane_data || {};
  return {
    dep: (xpd.contract_departure_airport || xpd.departure_airport || xpd.departure_icao || f?.departure_airport || "").toUpperCase(),
    arr: (xpd.contract_arrival_airport || xpd.arrival_airport || xpd.arrival_icao || f?.arrival_airport || "").toUpperCase(),
  };
};

const getDepartureHour = (f) => {
  const iso = f?.departure_time || f?.created_date;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours();
};

const getDateKey = (f) => {
  const iso = f?.departure_time || f?.created_date;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const getLandingVs = (f) => {
  const xpd = f?.xplane_data || {};
  return Math.abs(FT(f?.landing_vs ?? xpd.touchdown_vspeed ?? xpd.landing_vs, 0));
};

const getCenterlineTakeoffRms = (f) => {
  const r = f?.runway_accuracy?.takeoff || f?.xplane_data?.runway_accuracy?.takeoff;
  return r?.rmsMeters != null ? FT(r.rmsMeters, NaN) : NaN;
};

const getCenterlineLandingRms = (f) => {
  const r = f?.runway_accuracy?.landing || f?.xplane_data?.runway_accuracy?.landing;
  return r?.rmsMeters != null ? FT(r.rmsMeters, NaN) : NaN;
};

export function buildAchievementContext({ flights = [], company = null, aircraft = [] }) {
  const aircraftById = Object.fromEntries((aircraft || []).map(a => [a.id, a]));
  const completedList = flights.filter(isCompleted);

  let totalHours = 0;
  let totalPassengers = 0;
  let totalCargoKg = 0;
  let totalDistanceNm = 0;
  let totalProfit = 0;
  let totalRevenue = 0;
  let bestScore = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let butterLandings = 0;
  let softLandings = 0;
  let hardLandings = 0;
  let perfectCenterlineTakeoffs = 0;
  let excellentCenterlineTakeoffs = 0;
  let perfectCenterlineLandings = 0;
  let excellentCenterlineLandings = 0;
  let perfectBothEndsCount = 0;
  let tdzLandings = 0;
  let longestFlightHours = 0;
  let longestFlightDistanceNm = 0;
  let perfectScoreCount = 0;
  let highScoreFlights = 0;
  let crashCount = 0;
  let overstressCount = 0;
  let stallCount = 0;
  let nightFlights = 0;
  let earlyFlights = 0;
  let dayFlights = 0;
  const flightsByType = { small_prop: 0, turboprop: 0, regional_jet: 0, narrow_body: 0, wide_body: 0, cargo: 0 };
  const uniqueAirports = new Set();
  const dateCounts = {};

  const chrono = [...completedList].sort((a, b) =>
    new Date(a?.departure_time || a?.created_date || 0) - new Date(b?.departure_time || b?.created_date || 0)
  );

  let noIncidentStreak = 0;
  let longestNoIncidentStreak = 0;
  let highScoreStreak = 0;
  let bestHighScoreStreak = 0;
  let goodScoreStreak = 0;
  let bestGoodScoreStreak = 0;
  let butterStreak = 0;
  let longestButterStreak = 0;
  let noHardStreak = 0;
  let longestNoHardStreak = 0;
  let comebackCount = 0;
  let prevWasFailed = false;

  for (const f of chrono) {
    totalHours += FT(f?.flight_duration_hours, 0);
    totalPassengers += FT(f?.xplane_data?.contract_passenger_count, 0) || FT(f?.passenger_count, 0);
    totalCargoKg += FT(f?.xplane_data?.contract_cargo_weight_kg, 0) || FT(f?.cargo_weight_kg, 0);
    const dist = FT(f?.xplane_data?.contract_distance_nm, 0);
    totalDistanceNm += dist;
    totalProfit += FT(f?.profit, 0);
    totalRevenue += FT(f?.revenue, 0);

    // Authoritative score is `flight_score` (0–100). `overall_rating`/`flight_rating`
    // are stored on the same record as 0–5 stars (= flight_score / 20) and would
    // never reach the 80/90/95/99 thresholds, so we read flight_score first.
    const score = FT(
      f?.flight_score ?? f?.xplane_data?.final_score ?? f?.xplane_data?.flight_score ?? f?.overall_rating ?? f?.flight_rating,
      0
    );
    if (score > bestScore) bestScore = score;
    if (score > 0) { scoreSum += score; scoreCount += 1; }
    if (score >= 99) perfectScoreCount += 1;
    if (score >= 90) highScoreFlights += 1;

    if (dist > longestFlightDistanceNm) longestFlightDistanceNm = dist;
    const durH = FT(f?.flight_duration_hours, 0);
    if (durH > longestFlightHours) longestFlightHours = durH;

    const vs = getLandingVs(f);
    if (vs > 0) {
      if (vs < 100) butterLandings += 1;
      if (vs < 150) softLandings += 1;
      if (vs > 600) hardLandings += 1;
    }

    const toRms = getCenterlineTakeoffRms(f);
    const laRms = getCenterlineLandingRms(f);
    if (Number.isFinite(toRms)) {
      if (toRms <= 5) perfectCenterlineTakeoffs += 1;
      if (toRms <= 2) excellentCenterlineTakeoffs += 1;
    }
    if (Number.isFinite(laRms)) {
      if (laRms <= 5) perfectCenterlineLandings += 1;
      if (laRms <= 2) excellentCenterlineLandings += 1;
    }
    if (Number.isFinite(toRms) && Number.isFinite(laRms) && toRms <= 2 && laRms <= 2) {
      perfectBothEndsCount += 1;
    }
    if (Number.isFinite(laRms) && laRms <= 10 && vs > 0 && vs < 600) {
      tdzLandings += 1;
    }

    if (hasEventFlag(f, ["crash", "has_crashed", "crashed"])) crashCount += 1;
    if (hasEventFlag(f, ["overstress"])) overstressCount += 1;
    if (hasEventFlag(f, ["stall", "is_in_stall", "stall_warning"])) stallCount += 1;

    const type = aircraftTypeOf(f, aircraftById);
    if (flightsByType[type] !== undefined) flightsByType[type] += 1;

    const { dep, arr } = extractAirports(f);
    if (dep) uniqueAirports.add(dep);
    if (arr) uniqueAirports.add(arr);

    const hour = getDepartureHour(f);
    if (hour !== null) {
      if (hour >= 22 || hour < 4) nightFlights += 1;
      else if (hour < 7) earlyFlights += 1;
      else dayFlights += 1;
    }
    const key = getDateKey(f);
    if (key) dateCounts[key] = (dateCounts[key] || 0) + 1;

    const flightHadIncident = isFailed(f) ||
      hasEventFlag(f, ["crash","has_crashed","stall","overstress","tailstrike","gear_up_landing","overspeed","flaps_overspeed"]);
    if (flightHadIncident) {
      noIncidentStreak = 0;
    } else {
      noIncidentStreak += 1;
      if (noIncidentStreak > longestNoIncidentStreak) longestNoIncidentStreak = noIncidentStreak;
    }

    if (score >= 90) {
      highScoreStreak += 1;
      if (highScoreStreak > bestHighScoreStreak) bestHighScoreStreak = highScoreStreak;
    } else {
      highScoreStreak = 0;
    }
    if (score >= 85) {
      goodScoreStreak += 1;
      if (goodScoreStreak > bestGoodScoreStreak) bestGoodScoreStreak = goodScoreStreak;
    } else {
      goodScoreStreak = 0;
    }
    if (vs > 0 && vs < 100) {
      butterStreak += 1;
      if (butterStreak > longestButterStreak) longestButterStreak = butterStreak;
    } else if (vs > 0) {
      butterStreak = 0;
    }
    if (vs > 0 && vs <= 600) {
      noHardStreak += 1;
      if (noHardStreak > longestNoHardStreak) longestNoHardStreak = noHardStreak;
    } else if (vs > 600) {
      noHardStreak = 0;
    }
    if (prevWasFailed && score >= 95) comebackCount += 1;
    prevWasFailed = isFailed(f);
  }

  const maxFlightsInOneDay = Object.values(dateCounts).reduce((m, v) => Math.max(m, v), 0);
  const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
  const fleetValue = (aircraft || [])
    .filter(a => a?.status !== "sold")
    .reduce((sum, a) => sum + resolveAircraftValueSnapshot(a).effectiveCurrentValue, 0);
  const fleetSize = (aircraft || []).filter(a => a?.status !== "sold").length;

  return {
    flights: completedList,
    aircraftTypeOfFlight: (f) => aircraftTypeOf(f, aircraftById),
    totalFlights: flights.length,
    completedFlights: completedList.length,
    failedFlights: flights.filter(isFailed).length,
    totalHours,
    totalPassengers,
    totalCargoKg,
    totalDistanceNm,
    totalProfit,
    totalRevenue,
    bestScore,
    avgScore,
    butterLandings,
    softLandings,
    hardLandings,
    perfectCenterlineTakeoffs,
    excellentCenterlineTakeoffs,
    perfectCenterlineLandings,
    excellentCenterlineLandings,
    perfectBothEndsCount,
    tdzLandings,
    flightsByType,
    uniqueAirports,
    nightFlights,
    earlyFlights,
    dayFlights,
    longestFlightHours,
    longestFlightDistanceNm,
    perfectScoreCount,
    highScoreFlights,
    crashCount,
    overstressCount,
    stallCount,
    noIncidentStreak: longestNoIncidentStreak,
    bestHighScoreStreak,
    bestGoodScoreStreak,
    longestButterStreak,
    longestNoHardStreak,
    comebackCount,
    maxFlightsInOneDay,
    currentCompanyLevel: FT(company?.level, 1),
    totalXp: FT(company?.experience_points, 0),
    currentBalance: FT(company?.balance, 0),
    currentReputation: FT(company?.reputation, 0),
    fleetSize,
    fleetValue,
  };
}

export function evaluateAchievements(ctx) {
  const unlocked = new Set();
  const byId = {};

  for (const a of ACHIEVEMENTS) {
    if (a.id === "collector") continue;
    let ok = false;
    try { ok = !!a.check(ctx); } catch (_) { ok = false; }
    byId[a.id] = ok;
    if (ok) unlocked.add(a.id);
  }

  const collector = ACHIEVEMENTS.find(a => a.id === "collector");
  if (collector) {
    const metaCtx = { ...ctx, unlockedCountExcludingSelf: unlocked.size };
    let ok = false;
    try { ok = !!collector.check(metaCtx); } catch (_) { ok = false; }
    byId.collector = ok;
    if (ok) unlocked.add("collector");
  }

  return { unlocked, byId };
}
