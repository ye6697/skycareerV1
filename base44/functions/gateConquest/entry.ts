import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Gate conquest: players fight AI airlines (pve, instant) or other players
// (pvp, 24h flight-score duel) for gate/apron positions.

const AI_AIRLINES = [
  { name: 'Nordwind Aviation', skill: 45 },
  { name: 'Cirrus Global', skill: 60 },
  { name: 'Pacific Crown', skill: 75 },
  { name: 'Royal Meridian', skill: 90 },
];
const SIZE_DEFENSE = { S: 35, M: 50, L: 65, XL: 80 };
const SIZE_XP = { S: 80, M: 150, L: 250, XL: 400 };
const PVE_FEE_FACTOR = 0.3;
const PVP_STAKE_FACTOR = 0.4;
const COOLDOWN_MS = 24 * 3600 * 1000;
const PVP_WINDOW_MS = 24 * 3600 * 1000;

function hashStr(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic AI ownership - must match gateMarket/entry.ts
function getAiOwner(icao, code) {
  const roll = hashStr('ai:' + icao + code) % 100;
  if (roll >= 35) return null;
  return AI_AIRLINES[hashStr('air:' + icao + code) % AI_AIRLINES.length];
}

async function resolveCompany(base44, user) {
  const companyId = user?.company_id || user?.data?.company_id;
  if (companyId) {
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (companies?.[0]) return companies[0];
  }
  const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
  return companies?.[0] || null;
}

// --- Gate catalog (must match gateMarket/entry.ts) ---
const CAT_ALLOWED = {
  S: ['small_prop', 'turboprop'],
  M: ['small_prop', 'turboprop', 'regional_jet'],
  L: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'cargo'],
  XL: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'wide_body', 'cargo'],
};
const CAT_PRICE = { S: 120000, M: 350000, L: 850000, XL: 1800000 };
const CAT_BONUS_PCT = { S: 3, M: 6, L: 10, XL: 15 };
const APRON_EXTRA_PCT = 5;
const APRON_PRICE_FACTOR = 0.45;

const CURATED = {
  EDDF: {
    gates: [
      { terminal: 'Terminal 1 - A', prefix: 'A', from: 1, to: 42, cat: 'L', xlEvery: 4 },
      { terminal: 'Terminal 1 - B', prefix: 'B', from: 20, to: 48, cat: 'L', xlEvery: 5 },
      { terminal: 'Terminal 1 - C', prefix: 'C', from: 1, to: 16, cat: 'XL' },
      { terminal: 'Terminal 2 - D', prefix: 'D', from: 1, to: 12, cat: 'XL' },
      { terminal: 'Terminal 2 - E', prefix: 'E', from: 2, to: 24, cat: 'L' },
    ],
    aprons: [{ terminal: 'Vorfeld West', prefix: 'V', from: 1, to: 30, cat: 'L', xlEvery: 6 }],
  },
  EDDM: {
    gates: [
      { terminal: 'Terminal 1 - A/B', prefix: 'A', from: 1, to: 26, cat: 'M', xlEvery: 0 },
      { terminal: 'Terminal 2 - G', prefix: 'G', from: 1, to: 28, cat: 'L', xlEvery: 5 },
      { terminal: 'Terminal 2 - H (Satellit)', prefix: 'H', from: 1, to: 24, cat: 'XL' },
      { terminal: 'Terminal 2 - K (Satellit)', prefix: 'K', from: 1, to: 18, cat: 'L' },
    ],
    aprons: [{ terminal: 'Vorfeld Ost', prefix: 'S', from: 101, to: 124, cat: 'L' }],
  },
  EDDB: {
    gates: [
      { terminal: 'Terminal 1 - A', prefix: 'A', from: 1, to: 25, cat: 'L', xlEvery: 6 },
      { terminal: 'Terminal 1 - B', prefix: 'B', from: 30, to: 45, cat: 'M' },
      { terminal: 'Terminal 2 - C', prefix: 'C', from: 60, to: 69, cat: 'M' },
    ],
    aprons: [{ terminal: 'Vorfeld 2', prefix: 'D', from: 1, to: 16, cat: 'L' }],
  },
  EDDH: {
    gates: [
      { terminal: 'Terminal 1', prefix: 'A', from: 1, to: 17, cat: 'L' },
      { terminal: 'Terminal 2', prefix: 'B', from: 1, to: 16, cat: 'M' },
    ],
    aprons: [{ terminal: 'Vorfeld 1', prefix: 'P', from: 1, to: 12, cat: 'M' }],
  },
  EDDL: {
    gates: [
      { terminal: 'Flugsteig A', prefix: 'A', from: 1, to: 16, cat: 'L' },
      { terminal: 'Flugsteig B', prefix: 'B', from: 1, to: 11, cat: 'L', xlEvery: 4 },
      { terminal: 'Flugsteig C', prefix: 'C', from: 1, to: 9, cat: 'XL' },
    ],
    aprons: [{ terminal: 'Vorfeld West', prefix: 'V', from: 1, to: 20, cat: 'M' }],
  },
  EDDS: {
    gates: [
      { terminal: 'Terminal 1', prefix: 'A', from: 1, to: 12, cat: 'M' },
      { terminal: 'Terminal 3', prefix: 'C', from: 1, to: 10, cat: 'L' },
    ],
    aprons: [{ terminal: 'Vorfeld Ost', prefix: 'P', from: 1, to: 14, cat: 'M' }],
  },
  EDDK: {
    gates: [
      { terminal: 'Terminal 1 - B', prefix: 'B', from: 1, to: 12, cat: 'M' },
      { terminal: 'Terminal 2 - C/D', prefix: 'C', from: 1, to: 14, cat: 'L' },
    ],
    aprons: [{ terminal: 'Frachtvorfeld', prefix: 'F', from: 1, to: 10, cat: 'L' }],
  },
  LOWW: {
    gates: [
      { terminal: 'Terminal 1 - B/C', prefix: 'C', from: 31, to: 42, cat: 'L' },
      { terminal: 'Terminal 3 - D', prefix: 'D', from: 21, to: 29, cat: 'XL' },
      { terminal: 'Terminal 3 - F/G', prefix: 'F', from: 1, to: 22, cat: 'M' },
    ],
    aprons: [{ terminal: 'Vorfeld Ost', prefix: 'K', from: 1, to: 18, cat: 'L' }],
  },
  LSZH: {
    gates: [
      { terminal: 'Dock A', prefix: 'A', from: 51, to: 86, cat: 'L', xlEvery: 6 },
      { terminal: 'Dock B', prefix: 'B', from: 1, to: 12, cat: 'L' },
      { terminal: 'Dock E', prefix: 'E', from: 16, to: 67, cat: 'XL' },
    ],
    aprons: [{ terminal: 'Stand Echo', prefix: 'V', from: 1, to: 16, cat: 'M' }],
  },
  EHAM: {
    gates: [
      { terminal: 'Pier B', prefix: 'B', from: 1, to: 36, cat: 'M' },
      { terminal: 'Pier D', prefix: 'D', from: 1, to: 57, cat: 'L', xlEvery: 7 },
      { terminal: 'Pier E', prefix: 'E', from: 2, to: 24, cat: 'XL' },
      { terminal: 'Pier G', prefix: 'G', from: 2, to: 9, cat: 'XL' },
    ],
    aprons: [{ terminal: 'Apron J', prefix: 'J', from: 1, to: 20, cat: 'L' }],
  },
  LFPG: {
    gates: [
      { terminal: 'Terminal 1', prefix: 'T', from: 1, to: 24, cat: 'L' },
      { terminal: 'Terminal 2E - K', prefix: 'K', from: 21, to: 49, cat: 'XL' },
      { terminal: 'Terminal 2F', prefix: 'F', from: 20, to: 39, cat: 'L' },
    ],
    aprons: [{ terminal: 'Apron Sierra', prefix: 'S', from: 1, to: 24, cat: 'L' }],
  },
  EGLL: {
    gates: [
      { terminal: 'Terminal 2 - A', prefix: 'A', from: 1, to: 26, cat: 'L', xlEvery: 5 },
      { terminal: 'Terminal 3', prefix: 'T', from: 1, to: 20, cat: 'XL' },
      { terminal: 'Terminal 5 - A', prefix: 'A5', from: 1, to: 22, cat: 'XL' },
    ],
    aprons: [{ terminal: 'Apron Victor', prefix: 'V', from: 1, to: 18, cat: 'L' }],
  },
  KJFK: {
    gates: [
      { terminal: 'Terminal 4 - A', prefix: 'A', from: 2, to: 7, cat: 'XL' },
      { terminal: 'Terminal 4 - B', prefix: 'B', from: 20, to: 55, cat: 'XL', xlEvery: 0 },
      { terminal: 'Terminal 8', prefix: 'T8-', from: 1, to: 29, cat: 'L', xlEvery: 5 },
    ],
    aprons: [{ terminal: 'Hardstand Apron', prefix: 'H', from: 1, to: 16, cat: 'L' }],
  },
  OMDB: {
    gates: [
      { terminal: 'Concourse A', prefix: 'A', from: 1, to: 24, cat: 'XL' },
      { terminal: 'Concourse B', prefix: 'B', from: 1, to: 32, cat: 'XL' },
      { terminal: 'Concourse D', prefix: 'D', from: 1, to: 24, cat: 'L' },
    ],
    aprons: [{ terminal: 'Remote Apron E', prefix: 'E', from: 1, to: 20, cat: 'XL' }],
  },
};

function expandSpec(icao, spec, positionType) {
  const items = [];
  for (let n = spec.from; n <= spec.to; n++) {
    const code = `${spec.prefix}${String(n).padStart(2, '0')}`;
    let cat = spec.cat;
    if (spec.xlEvery && n % spec.xlEvery === 0 && cat !== 'XL') cat = 'XL';
    const basePrice = (CAT_PRICE[cat] || CAT_PRICE.S) * (positionType === 'apron' ? APRON_PRICE_FACTOR : 1);
    const wiggle = 0.9 + (hashStr(icao + code) % 21) / 100;
    items.push({
      airport_icao: icao,
      gate_code: code,
      terminal: spec.terminal,
      position_type: positionType,
      size_category: cat,
      allowed_types: CAT_ALLOWED[cat] || CAT_ALLOWED.S,
      price: Math.round((basePrice * wiggle) / 1000) * 1000,
      bonus_pct: (CAT_BONUS_PCT[cat] || 3) + (positionType === 'apron' ? APRON_EXTRA_PCT : 0),
    });
  }
  return items;
}

function generatedLayout(icao) {
  const seed = hashStr(icao);
  const tier = seed % 3;
  if (tier === 0) {
    return {
      gates: [{ terminal: 'Terminal 1', prefix: 'A', from: 1, to: 6 + (seed % 4), cat: 'S' }],
      aprons: [{ terminal: 'Vorfeld', prefix: 'P', from: 1, to: 4 + (seed % 4), cat: 'M' }],
    };
  }
  if (tier === 1) {
    return {
      gates: [
        { terminal: 'Terminal 1 - A', prefix: 'A', from: 1, to: 8 + (seed % 5), cat: 'M' },
        { terminal: 'Terminal 1 - B', prefix: 'B', from: 1, to: 5 + (seed % 4), cat: 'L' },
      ],
      aprons: [{ terminal: 'Vorfeld', prefix: 'P', from: 1, to: 6 + (seed % 5), cat: 'M' }],
    };
  }
  return {
    gates: [
      { terminal: 'Terminal 1 - A', prefix: 'A', from: 1, to: 10 + (seed % 6), cat: 'M' },
      { terminal: 'Terminal 1 - B', prefix: 'B', from: 1, to: 8 + (seed % 5), cat: 'L', xlEvery: 4 },
      { terminal: 'Terminal 2 - C', prefix: 'C', from: 1, to: 4 + (seed % 4), cat: 'XL' },
    ],
    aprons: [{ terminal: 'Vorfeld', prefix: 'V', from: 1, to: 8 + (seed % 6), cat: 'L' }],
  };
}

function buildCatalog(icao) {
  const layout = CURATED[icao] || generatedLayout(icao);
  const entries = [];
  for (const spec of layout.gates) entries.push(...expandSpec(icao, spec, 'gate'));
  for (const spec of layout.aprons || []) entries.push(...expandSpec(icao, spec, 'apron'));
  return entries;
}

async function computeAttackPower(base44, company) {
  const flights = await base44.asServiceRole.entities.Flight.filter(
    { company_id: company.id, status: 'completed' }, '-created_date', 5
  );
  const scores = (flights || [])
    .map((f) => Number(f.flight_score || f.overall_rating || 0))
    .filter((n) => n > 0);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 40;
  return Number(company.level || 1) * 2 + Number(company.reputation || 50) * 0.4 + avgScore * 0.5;
}

async function bestFlightScore(base44, companyId, startMs, endMs) {
  if (!companyId) return 0;
  const flights = await base44.asServiceRole.entities.Flight.filter(
    { company_id: companyId, status: 'completed' }, '-created_date', 100
  );
  let best = 0;
  for (const f of flights || []) {
    const t = new Date(f.updated_date || f.created_date).getTime();
    if (t >= startMs && t <= endMs) best = Math.max(best, Number(f.flight_score || f.overall_rating || 0));
  }
  return best;
}

async function resolvePvpChallenge(base44, ch) {
  const svc = base44.asServiceRole.entities;
  const now = new Date().toISOString();
  const records = await svc.AirportGate.filter({ id: ch.gate_record_id });
  const record = records?.[0] || null;
  const challengerList = await svc.Company.filter({ id: ch.challenger_company_id });
  const challenger = challengerList?.[0] || null;

  // Gate gone or owner changed since the challenge: cancel + refund stake.
  if (!record || String(record.owner_company_id) !== String(ch.defender_company_id)) {
    if (challenger) {
      await svc.Company.update(challenger.id, { balance: Number(challenger.balance || 0) + Number(ch.stake || 0) });
    }
    const patch = { status: 'cancelled', resolved_at: now };
    await svc.GateChallenge.update(ch.id, patch);
    return patch;
  }

  const startMs = new Date(ch.created_date).getTime();
  const endMs = new Date(ch.resolve_at).getTime();
  const challengerScore = await bestFlightScore(base44, ch.challenger_company_id, startMs, endMs);
  const defenseBonus = 10 + Number(record.defense_level || 0) * 6;
  const defenderScore = (await bestFlightScore(base44, ch.defender_company_id, startMs, endMs)) + defenseBonus;
  const won = challengerScore > defenderScore;

  // Stake always goes to the defender (victory prize or compensation for the lost gate).
  const defenderList = await svc.Company.filter({ id: ch.defender_company_id });
  const defender = defenderList?.[0] || null;
  if (defender && Number(ch.stake || 0) > 0) {
    await svc.Company.update(defender.id, { balance: Number(defender.balance || 0) + Number(ch.stake || 0) });
    await svc.Transaction.create({
      company_id: defender.id, type: 'income', category: 'other', amount: Number(ch.stake || 0),
      description: `Gate-Duell ${ch.airport_icao} ${ch.gate_code} - Einsatz erhalten`,
      date: now,
    });
  }

  if (won) {
    await svc.AirportGate.update(record.id, {
      owner_company_id: ch.challenger_company_id,
      owner_company_name: ch.challenger_company_name || '',
      for_sale: false, sale_price: 0, defense_level: 0,
    });
    if (challenger) {
      const xp = SIZE_XP[record.size_category] || 100;
      await svc.Company.update(challenger.id, {
        experience_points: Number(challenger.experience_points || 0) + xp,
      });
    }
  }

  const patch = {
    status: won ? 'won' : 'lost',
    challenger_score: Math.round(challengerScore),
    defender_score: Math.round(defenderScore),
    resolved_at: now,
  };
  await svc.GateChallenge.update(ch.id, patch);
  return patch;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'overview');
    const icao = String(body?.icao || '').toUpperCase().trim();
    const svc = base44.asServiceRole.entities;

    const company = await resolveCompany(base44, user);
    if (!company) return Response.json({ error: 'Keine Firma gefunden' }, { status: 400 });
    const balance = Number(company.balance || 0);

    if (action === 'overview') {
      if (!icao || icao.length < 3) return Response.json({ error: 'ICAO erforderlich' }, { status: 400 });
      const gates = buildCatalog(icao);
      const records = await svc.AirportGate.filter({ airport_icao: icao });
      const byCode = new Map((records || []).map((r) => [String(r.gate_code), r]));
      const activeChallenges = await svc.GateChallenge.filter({ airport_icao: icao, status: 'active' });
      const myLost = await svc.GateChallenge.filter(
        { airport_icao: icao, challenger_company_id: company.id, mode: 'pve', status: 'lost' }, '-created_date', 50
      );
      const nowMs = Date.now();
      const cooldownByCode = new Map();
      for (const ch of myLost || []) {
        const t = new Date(ch.created_date).getTime();
        if (nowMs - t < COOLDOWN_MS && !cooldownByCode.has(ch.gate_code)) {
          cooldownByCode.set(ch.gate_code, new Date(t + COOLDOWN_MS).toISOString());
        }
      }
      const enriched = gates.map((g) => {
        const record = byCode.get(g.gate_code);
        const ai = !record ? getAiOwner(icao, g.gate_code) : null;
        if (ai) {
          return {
            ...g,
            conquest: {
              type: 'ai',
              ai_name: ai?.name || g.owner_company_name || 'AI Airline',
              fee: Math.round(g.price * PVE_FEE_FACTOR),
              defense_est: Math.round((SIZE_DEFENSE[g.size_category] || 50) + (ai?.skill || 60) * 0.5),
              cooldown_until: cooldownByCode.get(g.gate_code) || null,
            },
          };
        }
        if (record && String(record.owner_company_id) !== String(company.id)) {
          const hasActive = (activeChallenges || []).some((c) => String(c.gate_record_id) === String(record.id));
          return {
            ...g,
            conquest: {
              type: 'player',
              owner_name: record.owner_company_name || '',
              stake: Math.round(g.price * PVP_STAKE_FACTOR),
              defense_level: Number(record.defense_level || 0),
              active_challenge: hasActive,
            },
          };
        }
        return { ...g, conquest: null };
      });
      const power = await computeAttackPower(base44, company);
      return Response.json({ icao, gates: enriched, my_power: Math.round(power) });
    }

    if (action === 'attack') {
      const gateCode = String(body?.gateCode || '').trim();
      if (!icao || !gateCode) return Response.json({ error: 'ICAO und gateCode erforderlich' }, { status: 400 });
      const entry = buildCatalog(icao).find((g) => g.gate_code === gateCode);
      if (!entry) return Response.json({ error: 'Position existiert nicht' }, { status: 404 });

      const records = await svc.AirportGate.filter({ airport_icao: icao, gate_code: gateCode });
      const record = records?.[0] || null;
      const now = new Date().toISOString();

      if (record) {
        if (String(record.owner_company_id) === String(company.id)) {
          return Response.json({ error: 'Diese Position gehört dir bereits' }, { status: 400 });
        }
        // --- PvP: 24h flight-score duel against another player ---
        const active = await svc.GateChallenge.filter({ gate_record_id: record.id, status: 'active' });
        if (active?.length) return Response.json({ error: 'Für diese Position läuft bereits ein Duell' }, { status: 409 });
        const stake = Math.round(entry.price * PVP_STAKE_FACTOR);
        if (balance < stake) return Response.json({ error: 'Nicht genug Guthaben für den Einsatz' }, { status: 400 });
        const resolveAt = new Date(Date.now() + PVP_WINDOW_MS).toISOString();
        await svc.Company.update(company.id, { balance: balance - stake });
        await svc.Transaction.create({
          company_id: company.id, type: 'expense', category: 'airport_fees', amount: stake,
          description: `Gate-Duell ${icao} ${gateCode} gegen ${record.owner_company_name || 'Airline'} (Einsatz)`,
          date: now,
        });
        await svc.GateChallenge.create({
          airport_icao: icao, gate_code: gateCode, gate_record_id: record.id, mode: 'pvp',
          challenger_company_id: company.id, challenger_company_name: company.name || '',
          defender_company_id: record.owner_company_id, defender_company_name: record.owner_company_name || '',
          stake, status: 'active', resolve_at: resolveAt,
        });
        return Response.json({ mode: 'pvp', stake, resolve_at: resolveAt });
      }

      // --- PvE: instant battle against the AI airline ---
      const ai = getAiOwner(icao, gateCode);
      if (!ai) return Response.json({ error: 'Diese Position ist frei - kaufe sie im Gate-Markt' }, { status: 400 });
      const recent = await svc.GateChallenge.filter(
        { airport_icao: icao, gate_code: gateCode, challenger_company_id: company.id, mode: 'pve' }, '-created_date', 3
      );
      const lastLost = (recent || []).find((c) => c.status === 'lost');
      if (lastLost && Date.now() - new Date(lastLost.created_date).getTime() < COOLDOWN_MS) {
        return Response.json({ error: 'Abklingzeit aktiv - dieser Angriff ist erst in 24h wieder möglich' }, { status: 429 });
      }
      const fee = Math.round(entry.price * PVE_FEE_FACTOR);
      if (balance < fee) return Response.json({ error: 'Nicht genug Guthaben für die Übernahme-Kampagne' }, { status: 400 });

      const power = await computeAttackPower(base44, company);
      const attack = power + Math.random() * 30;
      const defense = (SIZE_DEFENSE[entry.size_category] || 50) + ai.skill * 0.5 + Math.random() * 30;
      const won = attack >= defense;
      const xp = won ? (SIZE_XP[entry.size_category] || 100) : 0;

      await svc.Company.update(company.id, {
        balance: balance - fee,
        experience_points: Number(company.experience_points || 0) + xp,
      });
      await svc.Transaction.create({
        company_id: company.id, type: 'expense', category: 'airport_fees', amount: fee,
        description: `Eroberungs-Kampagne ${icao} ${gateCode} gegen ${ai.name} (${won ? 'gewonnen' : 'verloren'})`,
        date: now,
      });
      if (won) {
        await svc.AirportGate.create({
          airport_icao: icao, gate_code: gateCode, terminal: entry.terminal,
          position_type: entry.position_type, size_category: entry.size_category,
          allowed_types: entry.allowed_types,
          owner_company_id: company.id, owner_company_name: company.name || '',
          purchase_price: fee, for_sale: false, sale_price: 0, defense_level: 0,
        });
      }
      await svc.GateChallenge.create({
        airport_icao: icao, gate_code: gateCode, mode: 'pve',
        challenger_company_id: company.id, challenger_company_name: company.name || '',
        defender_company_name: ai.name, stake: fee,
        status: won ? 'won' : 'lost',
        challenger_score: Math.round(attack), defender_score: Math.round(defense),
        resolved_at: now,
      });
      return Response.json({
        mode: 'pve', won, fee, xp,
        attack: Math.round(attack), defense: Math.round(defense), ai_name: ai.name,
      });
    }

    if (action === 'fortify') {
      const recordId = String(body?.recordId || '').trim();
      if (!recordId) return Response.json({ error: 'recordId erforderlich' }, { status: 400 });
      const records = await svc.AirportGate.filter({ id: recordId });
      const record = records?.[0] || null;
      if (!record || String(record.owner_company_id) !== String(company.id)) {
        return Response.json({ error: 'Diese Position gehört dir nicht' }, { status: 403 });
      }
      const level = Number(record.defense_level || 0);
      if (level >= 5) return Response.json({ error: 'Maximal ausgebaut (Stufe 5)' }, { status: 400 });
      const cost = Math.round(Math.max(40000, Number(record.purchase_price || 120000) * 0.15 * (level + 1)));
      if (balance < cost) return Response.json({ error: 'Nicht genug Guthaben' }, { status: 400 });
      await svc.AirportGate.update(record.id, { defense_level: level + 1 });
      await svc.Company.update(company.id, { balance: balance - cost });
      await svc.Transaction.create({
        company_id: company.id, type: 'expense', category: 'airport_fees', amount: cost,
        description: `Gate-Verteidigung ${record.airport_icao} ${record.gate_code} auf Stufe ${level + 1}`,
        date: new Date().toISOString(),
      });
      return Response.json({ success: true, defense_level: level + 1, cost });
    }

    if (action === 'myChallenges') {
      const asChallenger = await svc.GateChallenge.filter({ challenger_company_id: company.id }, '-created_date', 30);
      const asDefender = await svc.GateChallenge.filter({ defender_company_id: company.id }, '-created_date', 30);
      const seen = new Set();
      const list = [];
      for (const ch of [...(asChallenger || []), ...(asDefender || [])]) {
        if (seen.has(ch.id)) continue;
        seen.add(ch.id);
        list.push(ch);
      }
      // Lazily resolve expired PvP duels.
      for (const ch of list) {
        if (ch.mode === 'pvp' && ch.status === 'active' && ch.resolve_at && new Date(ch.resolve_at).getTime() <= Date.now()) {
          const patch = await resolvePvpChallenge(base44, ch);
          Object.assign(ch, patch);
        }
      }
      list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      return Response.json({ challenges: list, company_id: company.id });
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});