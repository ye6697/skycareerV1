import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

function hashStr(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// AI-controlled positions: deterministic per airport+gate. They cannot be
// bought directly - they must be conquered via the gateConquest function.
// Must match gateConquest/entry.ts.
const AI_AIRLINES = [
  { name: 'Nordwind Aviation', skill: 45 },
  { name: 'Cirrus Global', skill: 60 },
  { name: 'Pacific Crown', skill: 75 },
  { name: 'Royal Meridian', skill: 90 },
];
function getAiOwner(icao, code) {
  const roll = hashStr('ai:' + icao + code) % 100;
  if (roll >= 35) return null;
  return AI_AIRLINES[hashStr('air:' + icao + code) % AI_AIRLINES.length];
}

// Real-world-inspired gate layouts for major airports.
// spec: { terminal, prefix, from, to, cat, xlEvery? }
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
  const tier = seed % 3; // 0 small regional, 1 medium, 2 larger
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

async function resolveCompany(base44, user) {
  const companyId = user?.company_id || user?.data?.company_id;
  if (companyId) {
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (companies?.[0]) return companies[0];
  }
  const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
  return companies?.[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'catalog');
    const icao = String(body?.icao || '').toUpperCase().trim();

    const company = await resolveCompany(base44, user);
    if (!company) return Response.json({ error: 'Keine Firma gefunden' }, { status: 400 });

    if (action === 'myGates') {
      const owned = await base44.asServiceRole.entities.AirportGate.filter({ owner_company_id: company.id });
      return Response.json({ gates: owned || [] });
    }

    if (action === 'catalog') {
      if (!icao || icao.length < 3) return Response.json({ error: 'ICAO erforderlich' }, { status: 400 });
      const catalog = buildCatalog(icao);
      const ownedRecords = await base44.asServiceRole.entities.AirportGate.filter({ airport_icao: icao });
      const ownershipByCode = new Map((ownedRecords || []).map((r) => [String(r.gate_code), r]));
      const merged = catalog.map((entry) => {
        const record = ownershipByCode.get(entry.gate_code);
        if (!record) {
          const ai = getAiOwner(icao, entry.gate_code);
          if (ai) return { ...entry, status: 'ai_owned', owner_company_name: ai.name, ai_skill: ai.skill };
          return { ...entry, status: 'available' };
        }
        const mine = String(record.owner_company_id) === String(company.id);
        return {
          ...entry,
          record_id: record.id,
          owner_company_name: record.owner_company_name || '',
          for_sale: !!record.for_sale,
          sale_price: Number(record.sale_price || 0),
          status: mine ? 'owned_by_me' : (record.for_sale ? 'for_sale' : 'sold_out'),
        };
      });
      return Response.json({ icao, gates: merged });
    }

    if (action === 'buy') {
      const gateCode = String(body?.gateCode || '').trim();
      if (!icao || !gateCode) return Response.json({ error: 'ICAO und gateCode erforderlich' }, { status: 400 });
      const catalog = buildCatalog(icao);
      const entry = catalog.find((g) => g.gate_code === gateCode);
      if (!entry) return Response.json({ error: 'Position existiert nicht an diesem Flughafen' }, { status: 404 });

      const existing = await base44.asServiceRole.entities.AirportGate.filter({ airport_icao: icao, gate_code: gateCode });
      const record = existing?.[0] || null;
      const balance = Number(company.balance || 0);

      if (!record && getAiOwner(icao, gateCode)) {
        return Response.json({ error: 'Diese Position wird von einer KI-Airline kontrolliert – erobere sie über den Eroberungs-Modus' }, { status: 409 });
      }

      if (record) {
        if (String(record.owner_company_id) === String(company.id)) {
          return Response.json({ error: 'Diese Position gehört dir bereits' }, { status: 400 });
        }
        if (!record.for_sale) {
          return Response.json({ error: 'Ausverkauft – diese Position gehört einer anderen Airline' }, { status: 409 });
        }
        // Resale purchase from another user
        const price = Math.max(0, Number(record.sale_price || 0));
        if (balance < price) return Response.json({ error: 'Nicht genug Guthaben' }, { status: 400 });
        const sellerCompanies = await base44.asServiceRole.entities.Company.filter({ id: record.owner_company_id });
        const seller = sellerCompanies?.[0] || null;
        await base44.asServiceRole.entities.AirportGate.update(record.id, {
          owner_company_id: company.id,
          owner_company_name: company.name || '',
          purchase_price: price,
          for_sale: false,
          sale_price: 0,
        });
        await base44.asServiceRole.entities.Company.update(company.id, { balance: balance - price });
        await base44.asServiceRole.entities.Transaction.create({
          company_id: company.id, type: 'expense', category: 'airport_fees', amount: price,
          description: `Gate-Kauf ${icao} ${gateCode} (Resale von ${record.owner_company_name || 'Airline'})`,
          date: new Date().toISOString(),
        });
        if (seller) {
          await base44.asServiceRole.entities.Company.update(seller.id, { balance: Number(seller.balance || 0) + price });
          await base44.asServiceRole.entities.Transaction.create({
            company_id: seller.id, type: 'income', category: 'other', amount: price,
            description: `Gate-Verkauf ${icao} ${gateCode} an ${company.name || 'Airline'}`,
            date: new Date().toISOString(),
          });
        }
        return Response.json({ success: true, resale: true, price });
      }

      // First purchase from airport authority
      const price = entry.price;
      if (balance < price) return Response.json({ error: 'Nicht genug Guthaben' }, { status: 400 });
      await base44.asServiceRole.entities.AirportGate.create({
        airport_icao: icao,
        gate_code: gateCode,
        terminal: entry.terminal,
        position_type: entry.position_type,
        size_category: entry.size_category,
        allowed_types: entry.allowed_types,
        owner_company_id: company.id,
        owner_company_name: company.name || '',
        purchase_price: price,
        for_sale: false,
        sale_price: 0,
      });
      await base44.asServiceRole.entities.Company.update(company.id, { balance: balance - price });
      await base44.asServiceRole.entities.Transaction.create({
        company_id: company.id, type: 'expense', category: 'airport_fees', amount: price,
        description: `Gate-Kauf ${icao} ${gateCode} (${entry.terminal})`,
        date: new Date().toISOString(),
      });
      return Response.json({ success: true, price });
    }

    if (action === 'setForSale' || action === 'unlist') {
      const recordId = String(body?.recordId || '').trim();
      if (!recordId) return Response.json({ error: 'recordId erforderlich' }, { status: 400 });
      const records = await base44.asServiceRole.entities.AirportGate.filter({ id: recordId });
      const record = records?.[0] || null;
      if (!record || String(record.owner_company_id) !== String(company.id)) {
        return Response.json({ error: 'Diese Position gehört dir nicht' }, { status: 403 });
      }
      if (action === 'setForSale') {
        const price = Math.round(Number(body?.price || 0));
        if (!Number.isFinite(price) || price <= 0) return Response.json({ error: 'Ungültiger Preis' }, { status: 400 });
        await base44.asServiceRole.entities.AirportGate.update(record.id, { for_sale: true, sale_price: price });
        return Response.json({ success: true });
      }
      await base44.asServiceRole.entities.AirportGate.update(record.id, { for_sale: false, sale_price: 0 });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});