import { resolveAircraftProfile } from '@/components/flights/aircraftModelCatalog';

const HOTSPOT_LABELS = {
  engine: { en: 'Engines', de: 'Triebwerke' },
  avionics: { en: 'Avionics / Cockpit', de: 'Avionik / Cockpit' },
  airframe: { en: 'Airframe', de: 'Zelle' },
  hydraulics: { en: 'Hydraulics', de: 'Hydraulik' },
  landing_gear: { en: 'Landing Gear', de: 'Fahrwerk' },
  electrical: { en: 'Electrical', de: 'Elektrik' },
  flight_controls: { en: 'Flight Controls', de: 'Flugsteuerung' },
  pressurization: { en: 'Pressurization', de: 'Druckkabine' },
};

const PROFILE_PRESETS = {
  small_prop: {
    engine: { x: 0.89, y: 0.5, z: 0.0 },
    avionics: { x: 0.78, y: 0.7, z: 0.0 },
    airframe: { x: 0.5, y: 0.85, z: 0.0 },
    hydraulics: { x: 0.45, y: 0.58, z: -0.25 },
    landing_gear: { x: 0.6, y: 0.14, z: 0.0 },
    electrical: { x: 0.4, y: 0.55, z: 0.22 },
    flight_controls: { x: 0.09, y: 0.88, z: 0.0 },
    pressurization: { x: 0.2, y: 0.72, z: 0.0 },
  },
  turboprop: {
    engine: { x: 0.56, y: 0.46, z: 0.43 },
    avionics: { x: 0.8, y: 0.72, z: 0.0 },
    airframe: { x: 0.5, y: 0.84, z: 0.0 },
    hydraulics: { x: 0.48, y: 0.52, z: -0.28 },
    landing_gear: { x: 0.56, y: 0.13, z: 0.0 },
    electrical: { x: 0.38, y: 0.56, z: 0.24 },
    flight_controls: { x: 0.08, y: 0.9, z: 0.0 },
    pressurization: { x: 0.2, y: 0.74, z: 0.0 },
  },
  regional_jet: {
    engine: { x: 0.25, y: 0.5, z: 0.33 },
    avionics: { x: 0.9, y: 0.73, z: 0.0 },
    airframe: { x: 0.5, y: 0.86, z: 0.0 },
    hydraulics: { x: 0.49, y: 0.46, z: -0.24 },
    landing_gear: { x: 0.63, y: 0.13, z: 0.0 },
    electrical: { x: 0.4, y: 0.57, z: 0.23 },
    flight_controls: { x: 0.08, y: 0.92, z: 0.0 },
    pressurization: { x: 0.2, y: 0.76, z: 0.0 },
  },
  narrow_body: {
    engine: { x: 0.58, y: 0.35, z: 0.49 },
    avionics: { x: 0.91, y: 0.73, z: 0.0 },
    airframe: { x: 0.5, y: 0.85, z: 0.0 },
    hydraulics: { x: 0.5, y: 0.45, z: -0.22 },
    landing_gear: { x: 0.63, y: 0.12, z: 0.0 },
    electrical: { x: 0.39, y: 0.55, z: 0.23 },
    flight_controls: { x: 0.08, y: 0.9, z: 0.0 },
    pressurization: { x: 0.2, y: 0.73, z: 0.0 },
  },
  wide_body: {
    engine: { x: 0.56, y: 0.33, z: 0.5 },
    avionics: { x: 0.9, y: 0.72, z: 0.0 },
    airframe: { x: 0.5, y: 0.84, z: 0.0 },
    hydraulics: { x: 0.5, y: 0.43, z: -0.24 },
    landing_gear: { x: 0.6, y: 0.11, z: 0.0 },
    electrical: { x: 0.38, y: 0.55, z: 0.24 },
    flight_controls: { x: 0.08, y: 0.89, z: 0.0 },
    pressurization: { x: 0.18, y: 0.72, z: 0.0 },
  },
  four_engine: {
    engine: { x: 0.56, y: 0.34, z: 0.58 },
    avionics: { x: 0.9, y: 0.72, z: 0.0 },
    airframe: { x: 0.5, y: 0.84, z: 0.0 },
    hydraulics: { x: 0.51, y: 0.42, z: -0.28 },
    landing_gear: { x: 0.59, y: 0.11, z: 0.0 },
    electrical: { x: 0.39, y: 0.54, z: 0.26 },
    flight_controls: { x: 0.08, y: 0.89, z: 0.0 },
    pressurization: { x: 0.18, y: 0.72, z: 0.0 },
  },
  supersonic: {
    engine: { x: 0.4, y: 0.34, z: 0.23 },
    avionics: { x: 0.93, y: 0.66, z: 0.0 },
    airframe: { x: 0.48, y: 0.8, z: 0.0 },
    hydraulics: { x: 0.48, y: 0.42, z: -0.16 },
    landing_gear: { x: 0.7, y: 0.11, z: 0.0 },
    electrical: { x: 0.35, y: 0.53, z: 0.16 },
    flight_controls: { x: 0.07, y: 0.86, z: 0.0 },
    pressurization: { x: 0.16, y: 0.7, z: 0.0 },
  },
};

const MODEL_OVERRIDES = {
  cessna_208b: {
    engine: { x: 0.9, y: 0.5, z: 0.0 },
  },
  boeing_747_8: {
    engine: { x: 0.55, y: 0.34, z: 0.62 },
    landing_gear: { x: 0.55, y: 0.1, z: 0.0 },
  },
  boeing_747_8f: {
    engine: { x: 0.55, y: 0.34, z: 0.62 },
    landing_gear: { x: 0.55, y: 0.1, z: 0.0 },
  },
  boeing_747_400: {
    engine: { x: 0.56, y: 0.34, z: 0.61 },
  },
  concorde: {
    engine: { x: 0.42, y: 0.32, z: 0.22 },
    landing_gear: { x: 0.69, y: 0.09, z: 0.0 },
  },
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function safeBounds(bounds) {
  if (!bounds?.min || !bounds?.max || !bounds?.size) {
    return {
      min: { x: -15, y: 0, z: -8 },
      max: { x: 15, y: 8, z: 8 },
      size: { x: 30, y: 8, z: 16 },
    };
  }
  return bounds;
}

function mergeSpec(baseSpec, overrideSpec) {
  if (!overrideSpec) return baseSpec;
  return {
    x: Number.isFinite(Number(overrideSpec.x)) ? Number(overrideSpec.x) : baseSpec.x,
    y: Number.isFinite(Number(overrideSpec.y)) ? Number(overrideSpec.y) : baseSpec.y,
    z: Number.isFinite(Number(overrideSpec.z)) ? Number(overrideSpec.z) : baseSpec.z,
  };
}

function specToPosition(spec, bounds) {
  const x = bounds.min.x + bounds.size.x * clamp01(spec.x);
  const y = bounds.min.y + bounds.size.y * clamp01(spec.y);
  const z = (bounds.size.z * 0.5) * Math.max(-1, Math.min(1, Number(spec.z || 0)));
  return { x, y, z };
}

export function getHotspotLayoutForAircraft({ aircraftHint = '', profile, modelId = '', bounds } = {}) {
  const resolvedProfile = profile || resolveAircraftProfile(aircraftHint) || 'narrow_body';
  const preset = PROFILE_PRESETS[resolvedProfile] || PROFILE_PRESETS.narrow_body;
  const override = MODEL_OVERRIDES[modelId] || {};
  const resolvedBounds = safeBounds(bounds);

  return Object.keys(HOTSPOT_LABELS).reduce((acc, key) => {
    const spec = mergeSpec(preset[key], override[key]);
    const position = specToPosition(spec, resolvedBounds);
    acc[key] = {
      ...position,
      label: HOTSPOT_LABELS[key],
    };
    return acc;
  }, {});
}

export const HOTSPOT_LAYOUT = getHotspotLayoutForAircraft({ aircraftHint: 'narrow_body' });

export function getHotspotColor(wearPct) {
  if (wearPct <= 20) return '#10b981';
  if (wearPct <= 50) return '#f59e0b';
  if (wearPct <= 75) return '#fb923c';
  return '#ef4444';
}

