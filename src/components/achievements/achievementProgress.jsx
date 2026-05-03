// Returns { current, target, percent } for a given achievement + ctx.
// We compute progress against the same metric the achievement's `check`
// function consults, so the progress bar exactly matches the unlock condition.
//
// For binary achievements (e.g. "fly all six categories", "first profit"),
// we fall back to 0% (locked) or 100% (unlocked).

const c = (ctx) => ctx || {};
const num = (v) => Number(v) || 0;

// Map of achievement-id → progress getter (current value).
// All targets/values are written so they exactly mirror the `check()` thresholds.
const PROGRESS = {
  // --- Landing ---
  soft_touch_1:    (ctx) => ({ current: c(ctx).softLandings, target: 1 }),
  butter_landing:  (ctx) => ({ current: c(ctx).butterLandings, target: 1 }),
  butter_master:   (ctx) => ({ current: c(ctx).butterLandings, target: 10 }),
  butter_legend:   (ctx) => ({ current: c(ctx).butterLandings, target: 50 }),
  ten_softs:       (ctx) => ({ current: c(ctx).softLandings, target: 10 }),
  hundred_softs:   (ctx) => ({ current: c(ctx).softLandings, target: 100 }),
  no_hard_streak:  (ctx) => ({ current: c(ctx).longestNoHardStreak, target: 25 }),
  greaser_row:     (ctx) => ({ current: c(ctx).longestButterStreak, target: 5 }),

  // --- Precision ---
  centerline_rookie:  (ctx) => ({ current: c(ctx).perfectCenterlineLandings, target: 1 }),
  precision_master:   (ctx) => ({ current: c(ctx).excellentCenterlineLandings, target: 10 }),
  laser_takeoff:      (ctx) => ({ current: c(ctx).excellentCenterlineTakeoffs, target: 1 }),
  track_hero:         (ctx) => ({ current: c(ctx).excellentCenterlineTakeoffs, target: 10 }),
  pin_drop:           (ctx) => ({ current: c(ctx).tdzLandings, target: 1 }),
  tdz_pro:            (ctx) => ({ current: c(ctx).tdzLandings, target: 25 }),
  both_perfect:       (ctx) => ({ current: c(ctx).perfectBothEndsCount, target: 1 }),
  precision_100:      (ctx) => ({ current: c(ctx).perfectCenterlineLandings, target: 100 }),

  // --- Score ---
  score_80:        (ctx) => ({ current: c(ctx).bestScore, target: 80 }),
  score_90:        (ctx) => ({ current: c(ctx).bestScore, target: 90 }),
  score_95:        (ctx) => ({ current: c(ctx).bestScore, target: 95 }),
  score_99:        (ctx) => ({ current: c(ctx).bestScore, target: 99 }),
  avg_85:          (ctx) => ({ current: c(ctx).avgScore, target: 85 }),
  avg_90:          (ctx) => ({ current: c(ctx).avgScore, target: 90 }),
  ten_perfects:    (ctx) => ({ current: c(ctx).perfectScoreCount, target: 10 }),
  fifty_perfects:  (ctx) => ({ current: c(ctx).perfectScoreCount, target: 50 }),
  score_streak_10: (ctx) => ({ current: c(ctx).bestHighScoreStreak, target: 10 }),
  score_streak_25: (ctx) => ({ current: c(ctx).bestHighScoreStreak, target: 25 }),

  // --- Milestones ---
  first_flight:    (ctx) => ({ current: c(ctx).completedFlights, target: 1 }),
  flights_10:      (ctx) => ({ current: c(ctx).completedFlights, target: 10 }),
  flights_50:      (ctx) => ({ current: c(ctx).completedFlights, target: 50 }),
  flights_100:     (ctx) => ({ current: c(ctx).completedFlights, target: 100 }),
  flights_250:     (ctx) => ({ current: c(ctx).completedFlights, target: 250 }),
  flights_500:     (ctx) => ({ current: c(ctx).completedFlights, target: 500 }),
  flights_1000:    (ctx) => ({ current: c(ctx).completedFlights, target: 1000 }),
  hours_50:        (ctx) => ({ current: c(ctx).totalHours, target: 50 }),
  hours_500:       (ctx) => ({ current: c(ctx).totalHours, target: 500 }),
  hours_2000:      (ctx) => ({ current: c(ctx).totalHours, target: 2000 }),

  // --- Distance ---
  distance_1000:           (ctx) => ({ current: c(ctx).totalDistanceNm, target: 1000 }),
  distance_10k:            (ctx) => ({ current: c(ctx).totalDistanceNm, target: 10000 }),
  distance_50k:            (ctx) => ({ current: c(ctx).totalDistanceNm, target: 50000 }),
  distance_100k:           (ctx) => ({ current: c(ctx).totalDistanceNm, target: 100000 }),
  long_haul_1:             (ctx) => ({ current: c(ctx).longestFlightDistanceNm, target: 2000 }),
  long_haul_2:             (ctx) => ({ current: c(ctx).longestFlightDistanceNm, target: 4000 }),
  long_haul_3:             (ctx) => ({ current: c(ctx).longestFlightDistanceNm, target: 6000 }),
  marathon:                (ctx) => ({ current: c(ctx).longestFlightHours, target: 10 }),

  // --- Passengers / Cargo ---
  pax_100:    (ctx) => ({ current: c(ctx).totalPassengers, target: 100 }),
  pax_1k:     (ctx) => ({ current: c(ctx).totalPassengers, target: 1000 }),
  pax_10k:    (ctx) => ({ current: c(ctx).totalPassengers, target: 10000 }),
  pax_100k:   (ctx) => ({ current: c(ctx).totalPassengers, target: 100000 }),
  cargo_10t:  (ctx) => ({ current: c(ctx).totalCargoKg, target: 10000 }),
  cargo_100t: (ctx) => ({ current: c(ctx).totalCargoKg, target: 100000 }),
  cargo_1000t:(ctx) => ({ current: c(ctx).totalCargoKg, target: 1000000 }),
  cargo_10kt: (ctx) => ({ current: c(ctx).totalCargoKg, target: 10000000 }),

  // --- Variety ---
  fly_prop:     (ctx) => ({ current: (c(ctx).flightsByType?.small_prop || 0), target: 1 }),
  fly_turboprop:(ctx) => ({ current: (c(ctx).flightsByType?.turboprop || 0), target: 1 }),
  fly_regional: (ctx) => ({ current: (c(ctx).flightsByType?.regional_jet || 0), target: 1 }),
  fly_narrow:   (ctx) => ({ current: (c(ctx).flightsByType?.narrow_body || 0), target: 1 }),
  fly_wide:     (ctx) => ({ current: (c(ctx).flightsByType?.wide_body || 0), target: 1 }),
  fly_cargo:    (ctx) => ({ current: (c(ctx).flightsByType?.cargo || 0), target: 1 }),
  all_types:    (ctx) => {
    const f = c(ctx).flightsByType || {};
    const keys = ["small_prop","turboprop","regional_jet","narrow_body","wide_body","cargo"];
    const flown = keys.filter((k) => (f[k] || 0) >= 1).length;
    return { current: flown, target: keys.length };
  },
  airports_10:  (ctx) => ({ current: c(ctx).uniqueAirports?.size || 0, target: 10 }),
  airports_50:  (ctx) => ({ current: c(ctx).uniqueAirports?.size || 0, target: 50 }),
  airports_100: (ctx) => ({ current: c(ctx).uniqueAirports?.size || 0, target: 100 }),

  // --- Finance ---
  profit_100k:   (ctx) => ({ current: c(ctx).totalProfit, target: 100000 }),
  profit_1m:     (ctx) => ({ current: c(ctx).totalProfit, target: 1000000 }),
  profit_10m:    (ctx) => ({ current: c(ctx).totalProfit, target: 10000000 }),
  profit_100m:   (ctx) => ({ current: c(ctx).totalProfit, target: 100000000 }),
  balance_1m:    (ctx) => ({ current: c(ctx).currentBalance, target: 1000000 }),
  balance_10m:   (ctx) => ({ current: c(ctx).currentBalance, target: 10000000 }),
  fleet_value_50m:(ctx) => ({ current: c(ctx).fleetValue, target: 50000000 }),

  // --- Career ---
  level_5:    (ctx) => ({ current: c(ctx).currentCompanyLevel || 1, target: 5 }),
  level_10:   (ctx) => ({ current: c(ctx).currentCompanyLevel || 1, target: 10 }),
  level_25:   (ctx) => ({ current: c(ctx).currentCompanyLevel || 1, target: 25 }),
  level_50:   (ctx) => ({ current: c(ctx).currentCompanyLevel || 1, target: 50 }),
  rep_75:     (ctx) => ({ current: c(ctx).currentReputation, target: 75 }),
  rep_90:     (ctx) => ({ current: c(ctx).currentReputation, target: 90 }),
  fleet_5:    (ctx) => ({ current: c(ctx).fleetSize, target: 5 }),
  fleet_20:   (ctx) => ({ current: c(ctx).fleetSize, target: 20 }),

  // --- Safety ---
  safe_10:   (ctx) => ({ current: c(ctx).noIncidentStreak, target: 10 }),
  safe_50:   (ctx) => ({ current: c(ctx).noIncidentStreak, target: 50 }),
  safe_200:  (ctx) => ({ current: c(ctx).noIncidentStreak, target: 200 }),
  fuel_efficient: (ctx) => ({ current: c(ctx).highScoreFlights, target: 10 }),
  clean_week:(ctx) => ({ current: c(ctx).bestGoodScoreStreak, target: 25 }),

  // --- Special ---
  night_owl:    (ctx) => ({ current: c(ctx).nightFlights, target: 1 }),
  night_owl_25: (ctx) => ({ current: c(ctx).nightFlights, target: 25 }),
  early_bird:   (ctx) => ({ current: c(ctx).earlyFlights, target: 10 }),
  same_day_3:   (ctx) => ({ current: c(ctx).maxFlightsInOneDay, target: 3 }),
  same_day_5:   (ctx) => ({ current: c(ctx).maxFlightsInOneDay, target: 5 }),
  comeback:     (ctx) => ({ current: c(ctx).comebackCount, target: 1 }),
  collector:    (ctx) => ({ current: c(ctx).unlockedCountExcludingSelf || 0, target: 75 }),
};

// Achievements that are inherently "yes/no" (we don't have a meaningful counter
// for them in ctx). Falls back to 0 or 100% based on unlock state.
function fallbackBinary(unlocked) {
  return { current: unlocked ? 1 : 0, target: 1, percent: unlocked ? 100 : 0 };
}

export function getAchievementProgress(achievement, ctx, unlocked) {
  const fn = PROGRESS[achievement?.id];
  if (!fn) return fallbackBinary(unlocked);
  let raw;
  try { raw = fn(ctx) || {}; } catch (_) { raw = {}; }
  const current = num(raw.current);
  const target = num(raw.target) || 1;
  const percent = unlocked ? 100 : Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  return { current, target, percent };
}