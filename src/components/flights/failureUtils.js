const FAILURE_EVENT_DEFINITIONS = [
  { eventKey: "failure_engine", category: "engine", severity: "schwer" },
  { eventKey: "failure_electrical", category: "electrical", severity: "mittel" },
  { eventKey: "failure_avionics", category: "avionics", severity: "mittel" },
  { eventKey: "failure_landing_gear", category: "landing_gear", severity: "mittel" },
  { eventKey: "failure_airframe", category: "airframe", severity: "schwer" },
];

const CATEGORY_LABELS = {
  engine: { de: "Triebwerksausfall", en: "Engine failure" },
  electrical: { de: "Elektrikausfall", en: "Electrical failure" },
  avionics: { de: "Avionik-Ausfall", en: "Avionics failure" },
  landing_gear: { de: "Fahrwerksausfall", en: "Landing gear failure" },
  airframe: { de: "Strukturausfall", en: "Airframe failure" },
  hydraulics: { de: "Hydraulik-Ausfall", en: "Hydraulics failure" },
  flight_controls: { de: "Steuerflaechen-Ausfall", en: "Flight controls failure" },
  pressurization: { de: "Drucksystem-Ausfall", en: "Pressurization failure" },
};

const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));

const normalizeSeverity = (value) => {
  const raw = String(value || "").toLowerCase().trim();
  if (["schwer", "severe", "critical", "kritisch", "high"].includes(raw)) return "schwer";
  if (["mittel", "medium", "moderate", "mid"].includes(raw)) return "mittel";
  return "leicht";
};

export const sanitizeFailureList = (failures = [], lang = "de") => {
  if (!Array.isArray(failures)) return [];

  const normalized = [];
  const seen = new Set();
  for (const entry of failures) {
    const category = String(entry?.category || "").toLowerCase().trim();
    if (!ALLOWED_CATEGORIES.has(category)) continue;

    const source = String(entry?.source || "").toLowerCase();
    if (source.includes("incident") || source.includes("event")) continue;

    const label = CATEGORY_LABELS[category]?.[lang === "de" ? "de" : "en"] || category;
    const name = String(entry?.name || "").trim() || label;
    const severity = normalizeSeverity(entry?.severity);
    const timestamp = entry?.timestamp || null;
    const dedupeKey = `${category}|${name}|${severity}|${timestamp || ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    normalized.push({
      name,
      category,
      severity,
      source: entry?.source || "failure",
      timestamp,
    });
  }

  return normalized;
};

export const buildFailuresFromEventFlags = (events = {}, lang = "de") => {
  return FAILURE_EVENT_DEFINITIONS
    .filter((def) => events?.[def.eventKey] === true)
    .map((def) => ({
      name: CATEGORY_LABELS[def.category]?.[lang === "de" ? "de" : "en"] || def.category,
      category: def.category,
      severity: def.severity,
      source: "failure_flag",
      timestamp: null,
    }));
};
