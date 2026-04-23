import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const resolveUserCompanyId = (user: any): string | null => (
  user?.company_id
  || user?.data?.company_id
  || user?.company?.id
  || user?.data?.company?.id
  || null
);

async function resolveCompany(base44: any, user: any) {
  const companyId = resolveUserCompanyId(user);
  if (companyId) {
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (companies?.[0]) return companies[0];
  }

  const email = String(user?.email || '').trim();
  if (!email) return null;
  const candidateEmails = Array.from(new Set([email, email.toLowerCase()]));
  for (const candidate of candidateEmails) {
    const companies = await base44.asServiceRole.entities.Company.filter({ created_by: candidate });
    if (companies?.[0]) return companies[0];
  }
  return null;
}

function getLegacyHangarId(airportIcao, ordinal = 1) {
  const airport = String(airportIcao || '').toUpperCase() || 'UNKNOWN';
  if (ordinal > 1) return `legacy_hangar_${airport}_${ordinal}`;
  return `legacy_hangar_${airport}`;
}

function normalizeCompanyHangars(rawHangars = []) {
  const perAirportCounts = new Map();
  return rawHangars.map((rawHangar, index) => {
    const airport = String(rawHangar?.airport_icao || '').toUpperCase();
    const rawId = String(rawHangar?.id || '').trim();
    const airportKey = airport || `UNKNOWN_${index + 1}`;
    const nextCount = (perAirportCounts.get(airportKey) || 0) + 1;
    perAirportCounts.set(airportKey, nextCount);
    return {
      ...(rawHangar || {}),
      id: rawId || getLegacyHangarId(airport || `UNKNOWN_${index + 1}`, nextCount),
      airport_icao: airport,
    };
  });
}

function hangarsNeedMigration(rawHangars = [], normalizedHangars = []) {
  if (rawHangars.length !== normalizedHangars.length) return true;
  for (let i = 0; i < normalizedHangars.length; i += 1) {
    const raw = rawHangars[i] || {};
    const normalized = normalizedHangars[i] || {};
    const rawId = String(raw?.id || '').trim();
    const normalizedId = String(normalized?.id || '').trim();
    const rawAirport = String(raw?.airport_icao || '').toUpperCase();
    const normalizedAirport = String(normalized?.airport_icao || '').toUpperCase();
    if (rawId !== normalizedId || rawAirport !== normalizedAirport) return true;
  }
  return false;
}

function buildHangarLookup(hangars = []) {
  const byId = new Map();
  const byAirport = new Map();
  for (const hangar of hangars) {
    const id = String(hangar?.id || '').trim();
    const airport = String(hangar?.airport_icao || '').toUpperCase();
    if (id) byId.set(id, hangar);
    if (airport) {
      const list = byAirport.get(airport) || [];
      list.push(hangar);
      byAirport.set(airport, list);
    }
  }
  return { byId, byAirport };
}

function resolveAircraftHangar(aircraft, hangarLookup, fallbackHangars = []) {
  const directId = String(aircraft?.hangar_id || '').trim();
  if (directId && hangarLookup.byId.has(directId)) {
    const matched = hangarLookup.byId.get(directId);
    return {
      hangar_id: directId,
      hangar_airport: String(matched?.airport_icao || aircraft?.hangar_airport || '').toUpperCase(),
    };
  }

  const airport = String(aircraft?.hangar_airport || '').toUpperCase();
  const airportHangars = hangarLookup.byAirport.get(airport) || [];
  if (airportHangars.length > 0) {
    return {
      hangar_id: String(airportHangars[0]?.id || '').trim(),
      hangar_airport: airport,
    };
  }

  if (!directId && fallbackHangars.length > 0) {
    const first = fallbackHangars[0];
    return {
      hangar_id: String(first?.id || '').trim(),
      hangar_airport: String(first?.airport_icao || '').toUpperCase(),
    };
  }

  return {
    hangar_id: directId,
    hangar_airport: airport,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) {
      return Response.json(
        { company: null, aircraft: [], contracts: [], employees: [], requires_auth: true },
        { status: 200 }
      );
    }

    let company = await resolveCompany(base44, user);
    if (!company) {
      return Response.json({ company: null, aircraft: [], contracts: [] });
    }

    const rawCompanyHangars = Array.isArray(company.hangars) ? company.hangars : [];
    const normalizedHangars = normalizeCompanyHangars(rawCompanyHangars);
    if (hangarsNeedMigration(rawCompanyHangars, normalizedHangars)) {
      await base44.asServiceRole.entities.Company.update(company.id, { hangars: normalizedHangars });
      company = { ...company, hangars: normalizedHangars };
    } else {
      company = { ...company, hangars: normalizedHangars };
    }

    const hangarLookup = buildHangarLookup(normalizedHangars);

    // Get aircraft for this company
    const allAircraft = await base44.asServiceRole.entities.Aircraft.filter({ company_id: company.id });
    const aircraft = allAircraft
      .filter((a) => a.status !== 'sold')
      .map((a) => {
        const resolved = resolveAircraftHangar(a, hangarLookup, normalizedHangars);
        return {
          ...a,
          hangar_id: resolved.hangar_id,
          hangar_airport: resolved.hangar_airport,
        };
      });

    // Get contracts for this company (available + accepted)
    const allContracts = await base44.asServiceRole.entities.Contract.filter({ company_id: company.id });
    const contracts = allContracts.filter(c => c.status === 'available' || c.status === 'accepted');

    // Get employees for this company
    const allEmployees = await base44.asServiceRole.entities.Employee.filter({ company_id: company.id });
    const employees = allEmployees.filter(e => e.status !== 'terminated');

    return Response.json({ company, aircraft, contracts, employees });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
