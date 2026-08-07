// Airport service agreements: tiered one-time fees by airport category.
// Bigger airports demand higher handling/service fees but host better routes.

const INTL_HUBS = new Set([
  'EDDF', 'EGLL', 'LFPG', 'KJFK', 'KLAX', 'KORD', 'KATL', 'OMDB', 'OTHH',
  'RJTT', 'RKSI', 'ZSPD', 'WSSS', 'EHAM', 'LTFM', 'VHHH', 'KDFW', 'KDEN',
]);

const LARGE_AIRPORTS = new Set([
  'LEMD', 'LIRF', 'CYYZ', 'MMMX', 'SBGR', 'FAOR', 'HECA', 'VTBS', 'YSSY',
  'YMML', 'NZAA', 'EDDM', 'LSZH', 'LOWW', 'EKCH', 'ENGM', 'ESSA', 'EGKK',
  'LEBL', 'LPPT', 'EIDW', 'EBBR', 'KSEA', 'KSFO', 'KMIA', 'KBOS', 'CYVR',
]);

export const AGREEMENT_TIERS = {
  hub: {
    key: 'hub',
    fee: 45000,
    label: { de: 'Internationales Drehkreuz', en: 'International hub' },
    short: { de: 'HUB', en: 'HUB' },
  },
  large: {
    key: 'large',
    fee: 30000,
    label: { de: 'Großflughafen', en: 'Major airport' },
    short: { de: 'GROSS', en: 'MAJOR' },
  },
  medium: {
    key: 'medium',
    fee: 18000,
    label: { de: 'Regionalflughafen', en: 'Regional airport' },
    short: { de: 'REGIONAL', en: 'REGIONAL' },
  },
  small: {
    key: 'small',
    fee: 10000,
    label: { de: 'Kleinflughafen', en: 'Small airport' },
    short: { de: 'KLEIN', en: 'SMALL' },
  },
};

function hashIcao(icao) {
  let h = 0;
  for (let i = 0; i < icao.length; i += 1) h = (h * 31 + icao.charCodeAt(i)) >>> 0;
  return h;
}

export function getAgreementInfo(airportIcao) {
  const icao = String(airportIcao || '').trim().toUpperCase();
  if (INTL_HUBS.has(icao)) return AGREEMENT_TIERS.hub;
  if (LARGE_AIRPORTS.has(icao)) return AGREEMENT_TIERS.large;
  // Deterministic: same unknown airport is always the same tier.
  return hashIcao(icao) % 2 === 0 ? AGREEMENT_TIERS.medium : AGREEMENT_TIERS.small;
}

export function getAgreementFee(airportIcao) {
  return getAgreementInfo(airportIcao).fee;
}