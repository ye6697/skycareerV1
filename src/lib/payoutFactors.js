// Payout multipliers per AIRCRAFT MODEL.
// Normalized so the lowest model (Icon A5) starts at 1.0.
//
// Rationale: factors scale with aircraft complexity / capability / operating
// cost class — bigger and more capable types pay much more per contract.
// Within each category the factors vary so that, for example, a King Air 350i
// pays more than a Kodiak 100, and an A380 pays more than a 747-400.

const RAW_MODEL_FACTORS = {
  // === SMALL PROPS ===
  "Icon A5": 1.0,
  "Piper PA-18 Super Cub": 1.1,
  "Robin DR400": 1.2,
  "Cessna 152": 1.2,
  "Vans RV-10": 1.4,
  "Diamond DA40 NG": 1.4,
  "Cessna 172 Skyhawk": 1.5,
  "Beechcraft Bonanza G36": 1.7,
  "Beechcraft Baron 58": 1.9,
  "Diamond DA62": 2.0,
  "Cessna 208B Grand Caravan": 2.2,
  "Cirrus SR22": 2.0,

  // === TURBOPROPS ===
  "Daher Kodiak 100": 2.4,
  "Lancair Evolution": 2.5,
  "Daher TBM 930": 2.7,
  "Beechcraft King Air C90B": 3.0,
  "Pilatus PC-12 NGX": 3.2,
  "Beechcraft King Air 350i": 3.5,

  // === LIGHT JETS / REGIONAL ===
  "Cirrus Vision SF50": 3.6,
  "Honda HA-420 HondaJet": 4.0,
  "Cessna Citation CJ4": 4.6,
  "Cessna Citation Longitude": 5.4,
  "Cessna Citation X": 5.8,

  // === REGIONAL AIRLINERS ===
  "Pilatus PC-24": 5.0,
  "Bombardier Dash 8-400": 8.5,
  "ATR 72F": 9.5,
  "Bombardier CRJ-200": 10.0,
  "Bombardier CRJ-700": 11.5,
  "Embraer E175": 12.5,
  "Airbus A220-300": 14.0,
  "McDonnell Douglas MD-82": 15.5,

  // === NARROW BODY ===
  "Airbus A310-300": 18.0,
  "Airbus A318": 19.0,
  "Boeing 737-700": 20.5,
  "Airbus A319": 21.5,
  "Boeing 737-800": 23.5,
  "Airbus A320neo": 24.5,
  "Boeing 737 MAX 8": 25.5,
  "Boeing 757-200": 26.5,
  "Airbus A321neo": 27.5,
  "Boeing 787-8": 29.0,
  "Boeing 787-10": 31.5,

  // === WIDE BODY ===
  "Airbus A300": 33.0,
  "Boeing 767-300ER": 34.0,
  "Airbus A330-200F": 35.0,
  "Airbus A330-900neo": 37.0,
  "Airbus A330-300": 38.0,
  "Boeing 747-400": 41.0,
  "Boeing 777-200ER": 42.0,
  "Boeing 777-300ER": 44.0,
  "Airbus A350-900": 45.0,
  "Boeing 777F": 45.0,
  "Boeing 747-8": 47.0,
  "Boeing 747-8F": 49.0,
  "Aérospatiale/BAC Concorde": 45.0,
  "Airbus A380": 54.0,
};

// Fallback per category (used if model is unknown).
const RAW_CATEGORY_FALLBACK = {
  small_prop: 1.5,
  turboprop: 3.0,
  regional_jet: 10.0,
  narrow_body: 24.0,
  wide_body: 40.0,
  cargo: 42.0,
};

export const PAYOUT_FACTOR_EXPONENT = 1.45;

export function curvePayoutFactor(rawFactor) {
  const factor = Number(rawFactor);
  if (!Number.isFinite(factor) || factor <= 0) return 1.0;
  if (factor <= 1) return 1.0;
  return Math.round(Math.pow(factor, PAYOUT_FACTOR_EXPONENT) * 10) / 10;
}

export function getPayoutFactor(aircraftName, aircraftType) {
  const fromModel = RAW_MODEL_FACTORS[String(aircraftName || '').trim()];
  if (Number.isFinite(fromModel) && fromModel > 0) return curvePayoutFactor(fromModel);
  const fallback = RAW_CATEGORY_FALLBACK[String(aircraftType || '').trim().toLowerCase()];
  return curvePayoutFactor(Number.isFinite(fallback) && fallback > 0 ? fallback : 1.0);
}

export function formatPayoutFactor(aircraftName, aircraftType) {
  const factor = getPayoutFactor(aircraftName, aircraftType);
  return `${factor.toFixed(1)}x`;
}

// Backend export: same curve/numbers are mirrored in functions/generateContracts.
// Base multiplier used to convert curved factor → payout multiplier in `generateContract`.
// (Icon A5 stays at 12, larger models now scale more exponentially.)
export const PAYOUT_BASE_MULTIPLIER = 12;
