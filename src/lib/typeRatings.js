// Type-Rating system: pilots need a license for each aircraft type they fly.
// Training takes real time + costs money, then the license is permanent.

export const AIRCRAFT_TYPES = [
  'small_prop',
  'turboprop',
  'regional_jet',
  'narrow_body',
  'wide_body',
  'cargo',
];

export const TYPE_LABELS = {
  small_prop:    { en: 'Small Prop',    de: 'Kleinflugzeug' },
  turboprop:     { en: 'Turboprop',     de: 'Turboprop' },
  regional_jet:  { en: 'Regional Jet',  de: 'Regional Jet' },
  narrow_body:   { en: 'Narrow Body',   de: 'Narrow Body' },
  wide_body:     { en: 'Wide Body',     de: 'Wide Body' },
  cargo:         { en: 'Cargo',         de: 'Frachter' },
};

// Cost + duration per aircraft type. Bigger jets cost more and take longer.
export const TYPE_RATING_CONFIG = {
  small_prop:   { cost: 5000,   hours: 12 },
  turboprop:    { cost: 12000,  hours: 18 },
  regional_jet: { cost: 25000,  hours: 24 },
  narrow_body:  { cost: 60000,  hours: 36 },
  wide_body:    { cost: 120000, hours: 48 },
  cargo:        { cost: 80000,  hours: 36 },
};

// Roles that require a type-rating to legally fly an aircraft.
export const PILOT_ROLES = ['captain', 'first_officer'];

export function isPilotRole(role) {
  return PILOT_ROLES.includes(String(role || '').toLowerCase());
}

export function hasTypeRating(employee, aircraftType) {
  if (!employee || !aircraftType) return false;
  if (!isPilotRole(employee.role)) return true; // non-pilots don't need ratings
  const licenses = Array.isArray(employee.licenses) ? employee.licenses : [];
  return licenses.includes(String(aircraftType));
}

export function getTypeRatingConfig(aircraftType) {
  return TYPE_RATING_CONFIG[aircraftType] || { cost: 20000, hours: 24 };
}

export function getTypeLabel(aircraftType, lang = 'en') {
  return TYPE_LABELS[aircraftType]?.[lang] || aircraftType;
}

// Training progress (0..1) for an in-progress type-rating.
export function getTrainingProgress(employee) {
  const tr = employee?.type_rating_training;
  if (!tr?.active || !tr?.started_at) return null;
  const startMs = new Date(tr.started_at).getTime();
  const durMs = Math.max(1, Number(tr.duration_hours || 24)) * 3600 * 1000;
  const elapsed = Date.now() - startMs;
  const progress = Math.min(1, Math.max(0, elapsed / durMs));
  const remainingMs = Math.max(0, durMs - elapsed);
  return { progress, remainingMs, type: tr.type, cost: tr.cost };
}

export function formatRemainingTime(ms, lang = 'en') {
  if (ms <= 0) return lang === 'de' ? 'Fertig' : 'Done';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}