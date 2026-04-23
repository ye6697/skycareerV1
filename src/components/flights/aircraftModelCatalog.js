const MODEL_BASE_PATH = '/models/aircraft';

const DEFAULT_SIZE_BY_PROFILE = {
  small_prop: 18,
  turboprop: 22,
  regional_jet: 24,
  narrow_body: 30,
  wide_body: 34,
  four_engine: 36,
  supersonic: 32,
};

const CATALOG = [
  {
    id: 'airbus_a380',
    file: 'airbus_a380.glb',
    profile: 'four_engine',
    patterns: [/\ba380\b/],
  },
  {
    id: 'concorde',
    file: 'concorde_free_with_interior.glb',
    profile: 'supersonic',
    patterns: [/\bconcorde\b/, /\baerospatiale\b/, /\bbac\b/],
  },
  {
    id: 'airbus_a350_900',
    file: 'airbus_a350_900.glb',
    profile: 'wide_body',
    patterns: [/\ba350\b/, /\ba350 900\b/],
  },
  {
    id: 'boeing_777f',
    file: 'boeing_777f.glb',
    profile: 'wide_body',
    patterns: [/\b777f\b/, /\b777 f\b/, /\bboeing 777f\b/, /\bboeing 777 f\b/, /\b777 freighter\b/],
  },
  {
    id: 'boeing_777_200er',
    file: 'boeing_777_200er.glb',
    profile: 'wide_body',
    patterns: [/\b777 200\b/, /\b777 200er\b/, /\b777-200\b/, /\b777-200er\b/],
  },
  {
    id: 'boeing_777_300er',
    file: 'boeing_777_300er.glb',
    profile: 'wide_body',
    patterns: [/\b777 300\b/, /\b777 300er\b/, /\b777-300\b/, /\b777-300er\b/],
  },
  {
    id: 'boeing_747_8f',
    file: 'boeing_747_8f.glb',
    profile: 'four_engine',
    patterns: [/\b747 8f\b/, /\b747-8f\b/, /\b747 freighter\b/, /\bboeing 747 8f\b/, /\bups 747\b/],
  },
  {
    id: 'boeing_747_8',
    file: 'boeing_747_8.glb',
    profile: 'four_engine',
    patterns: [/\b747 8\b/, /\b747-8\b/, /\bair force one\b/],
  },
  {
    id: 'boeing_747_400',
    file: 'boeing_747_400.glb',
    profile: 'four_engine',
    patterns: [/\b747 400\b/, /\b747-400\b/],
  },
  {
    id: 'airbus_a330_300_900',
    file: 'airbus_a330_300_900.glb',
    profile: 'wide_body',
    patterns: [/\ba330 300\b/, /\ba330-300\b/, /\ba330 900\b/, /\ba330-900\b/, /\ba330 900neo\b/],
  },
  {
    id: 'airbus_a330_200f',
    file: 'airbus_a330_200f.glb',
    profile: 'wide_body',
    patterns: [/\ba330 200f\b/, /\ba330-200f\b/],
  },
  {
    id: 'boeing_767_300er',
    file: 'boeing_767_300er.glb',
    profile: 'wide_body',
    patterns: [/\b767\b/, /\b767 300\b/, /\b767-300\b/],
  },
  {
    id: 'airbus_a300',
    file: 'airbus_a300_600.glb',
    profile: 'wide_body',
    patterns: [/\ba300\b/],
  },
  {
    id: 'boeing_787',
    file: 'boeing_787.glb',
    profile: 'narrow_body',
    patterns: [/\b787\b/, /\bdreamliner\b/],
  },
  {
    id: 'airbus_a321neo',
    file: 'airbus_a321neo.glb',
    profile: 'narrow_body',
    patterns: [/\ba321\b/],
  },
  {
    id: 'boeing_757_200',
    file: 'boeing_757_200.glb',
    profile: 'narrow_body',
    patterns: [/\b757\b/, /\b757 200\b/, /\b757-200\b/],
  },
  {
    id: 'boeing_737_max8',
    file: 'boeing_737_max8.glb',
    profile: 'narrow_body',
    patterns: [/\b737 max\b/, /\bmax 8\b/, /\b737 max 8\b/],
  },
  {
    id: 'airbus_a320',
    file: 'airbus_a320.glb',
    profile: 'narrow_body',
    patterns: [/\ba320\b/, /\ba319\b/],
  },
  {
    id: 'boeing_737_700',
    file: 'boeing_737_700.glb',
    profile: 'narrow_body',
    patterns: [/\b737 700\b/, /\b737-700\b/],
  },
  {
    id: 'boeing_737_800',
    file: 'boeing_737_800.glb',
    profile: 'narrow_body',
    patterns: [/\b737 800\b/, /\b737-800\b/],
  },
  {
    id: 'airbus_a318',
    file: 'airbus_a318_122.glb',
    profile: 'narrow_body',
    patterns: [/\ba318\b/],
  },
  {
    id: 'airbus_a310',
    file: 'airbus_a310_200.glb',
    profile: 'narrow_body',
    patterns: [/\ba310\b/],
  },
  {
    id: 'md82',
    file: 'mcdonnell_douglas_md82.glb',
    profile: 'narrow_body',
    patterns: [/\bmd 82\b/, /\bmd-82\b/, /\bmcdonnell\b/],
  },
  {
    id: 'airbus_a220_300',
    file: 'airbus_a220_300.glb',
    profile: 'regional_jet',
    patterns: [/\ba220\b/, /\ba220 300\b/, /\ba220-300\b/],
  },
  {
    id: 'embraer_e175',
    file: 'embraer_e175.glb',
    profile: 'regional_jet',
    patterns: [/\be175\b/, /\berj 175\b/, /\bembraer 175\b/],
  },
  {
    id: 'crj_200_700',
    file: 'crj_200_700.glb',
    profile: 'regional_jet',
    patterns: [/\bcrj 200\b/, /\bcrj-200\b/, /\bcrj 700\b/, /\bcrj-700\b/],
  },
  {
    id: 'atr_72_600',
    file: 'atr_72_600.glb',
    profile: 'turboprop',
    patterns: [/\batr 72\b/, /\batr72\b/, /\batr 72f\b/],
  },
  {
    id: 'dash_q400',
    file: 'dash_q400.glb',
    profile: 'turboprop',
    patterns: [/\bq400\b/, /\bdash 8 400\b/, /\bdash-8-400\b/],
  },
  {
    id: 'cessna_citation',
    file: 'cessna_citation.glb',
    profile: 'regional_jet',
    patterns: [/\bcitation\b/, /\bcj4\b/, /\blongitude\b/, /\bcitation x\b/, /\bpc 24\b/, /\bpc-24\b/],
  },
  {
    id: 'honda_ha420',
    file: 'honda_ha420.glb',
    profile: 'regional_jet',
    patterns: [/\bha 420\b/, /\bha-420\b/, /\bhondajet\b/],
  },
  {
    id: 'cirrus_sf50',
    file: 'cirrus_sf50.glb',
    profile: 'regional_jet',
    patterns: [/\bsf50\b/, /\bvision\b/],
  },
  {
    id: 'pc12',
    file: 'pilatus_pc12.glb',
    profile: 'turboprop',
    patterns: [/\bpc12\b/, /\bpc-12\b/],
  },
  {
    id: 'lancair',
    file: 'lancair_235.glb',
    profile: 'turboprop',
    patterns: [/\blancair\b/],
  },
  {
    id: 'tbm930',
    file: 'daher_tbm_930.glb',
    profile: 'turboprop',
    patterns: [/\btbm\b/, /\btbm 930\b/, /\btbm-930\b/],
  },
  {
    id: 'cirrus_sr22',
    file: 'cirrus_sr22.glb',
    profile: 'small_prop',
    patterns: [/\bsr22\b/, /\bcirrus sr22\b/],
  },
  {
    id: 'cessna_208b',
    file: 'cessna_208b.glb',
    profile: 'turboprop',
    patterns: [/\b208b\b/, /\bc 208\b/, /\bc-208\b/, /\bgrand caravan\b/, /\bkodiak\b/],
  },
  {
    id: 'diamond_da62',
    file: 'diamond_da62.glb',
    profile: 'small_prop',
    patterns: [/\bda62\b/, /\bdiamond da62\b/],
  },
  {
    id: 'beech_king_air',
    file: 'beechcraft_super_king_air.glb',
    profile: 'turboprop',
    patterns: [/\bking air\b/, /\bc90\b/, /\b350i\b/, /\bbeechcraft super king air\b/],
  },
  {
    id: 'diamond_da40',
    file: 'diamond_da40.glb',
    profile: 'small_prop',
    patterns: [/\bda40\b/, /\bdiamond da40\b/],
  },
  {
    id: 'beech_bonanza',
    file: 'beechcraft_bonanza_g36.glb',
    profile: 'small_prop',
    patterns: [/\bbonanza\b/, /\bg36\b/, /\bbeech36\b/, /\bbaron 58\b/],
  },
  {
    id: 'cessna_152',
    file: 'cessna_152.glb',
    profile: 'small_prop',
    patterns: [/\bcessna 152\b/, /\bc152\b/],
  },
  {
    id: 'cessna_172',
    file: 'cessna_172.glb',
    profile: 'small_prop',
    patterns: [/\bcessna 172\b/, /\b172 skyhawk\b/, /\bc172\b/, /\bicon a5\b/, /\brv 10\b/],
  },
  {
    id: 'robin_dr400',
    file: 'robin_dr400.glb',
    profile: 'small_prop',
    patterns: [/\bdr400\b/, /\brobin dr400\b/],
  },
  {
    id: 'piper_pa18',
    file: 'piper_pa18.glb',
    profile: 'small_prop',
    patterns: [/\bpa 18\b/, /\bpa-18\b/, /\bsuper cub\b/],
  },
];

const TYPE_FALLBACK_ID = {
  small_prop: 'cessna_172',
  turboprop: 'pc12',
  regional_jet: 'cessna_citation',
  narrow_body: 'airbus_a320',
  wide_body: 'boeing_777_200er',
  cargo: 'boeing_777f',
};

function normalizeHint(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getEntryById(id) {
  return CATALOG.find((entry) => entry.id === id) || null;
}

function materializeEntry(entry, normalizedHint) {
  if (!entry) return null;
  return {
    ...entry,
    normalizedHint,
    path: `${MODEL_BASE_PATH}/${entry.file}`,
    targetSize: Number(entry.targetSize || DEFAULT_SIZE_BY_PROFILE[entry.profile] || 24),
  };
}

export function resolveAircraftModelConfig(aircraftHint) {
  const normalizedHint = normalizeHint(aircraftHint);
  if (!normalizedHint) return null;

  const exact = CATALOG.find((entry) => entry.patterns.some((pattern) => pattern.test(normalizedHint)));
  if (exact) return materializeEntry(exact, normalizedHint);

  const typeToken = Object.keys(TYPE_FALLBACK_ID).find((token) => normalizedHint.includes(token));
  if (typeToken) return materializeEntry(getEntryById(TYPE_FALLBACK_ID[typeToken]), normalizedHint);

  if (/\bcargo\b/.test(normalizedHint)) return materializeEntry(getEntryById('boeing_777f'), normalizedHint);
  if (/\bboeing\b/.test(normalizedHint)) return materializeEntry(getEntryById('boeing_737_800'), normalizedHint);
  if (/\bairbus\b/.test(normalizedHint)) return materializeEntry(getEntryById('airbus_a320'), normalizedHint);
  if (/\bcessna\b/.test(normalizedHint)) return materializeEntry(getEntryById('cessna_172'), normalizedHint);

  return materializeEntry(getEntryById('airbus_a320'), normalizedHint);
}

export function resolveAircraftProfile(aircraftHint) {
  const resolved = resolveAircraftModelConfig(aircraftHint);
  return resolved?.profile || 'narrow_body';
}

export function getDefaultTargetSizeForProfile(profile) {
  return Number(DEFAULT_SIZE_BY_PROFILE[profile] || 24);
}

