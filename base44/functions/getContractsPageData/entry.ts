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
  const candidatesById = new Map<string, any>();
  for (const candidate of candidateEmails) {
    const companies = await base44.asServiceRole.entities.Company.filter({ created_by: candidate });
    for (const company of (Array.isArray(companies) ? companies : [])) {
      if (company?.id) candidatesById.set(String(company.id), company);
    }
  }
  const allCandidates = Array.from(candidatesById.values());
  if (allCandidates.length === 0) return null;
  allCandidates.sort((a, b) => {
    const updatedA = Date.parse(String(a?.updated_date || a?.created_date || '')) || 0;
    const updatedB = Date.parse(String(b?.updated_date || b?.created_date || '')) || 0;
    if (updatedB !== updatedA) return updatedB - updatedA;
    const hangarsA = Array.isArray(a?.hangars) ? a.hangars.length : 0;
    const hangarsB = Array.isArray(b?.hangars) ? b.hangars.length : 0;
    if (hangarsB !== hangarsA) return hangarsB - hangarsA;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
  return allCandidates[0];
}

const HANGAR_SIZE_RULES: Record<string, { slots: number; allowed_types: string[] }> = {
  small: { slots: 2, allowed_types: ['small_prop', 'turboprop'] },
  medium: { slots: 4, allowed_types: ['small_prop', 'turboprop', 'regional_jet'] },
  large: { slots: 6, allowed_types: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'cargo'] },
  mega: { slots: 10, allowed_types: ['small_prop', 'turboprop', 'regional_jet', 'narrow_body', 'wide_body', 'cargo'] }
};

function getLegacyHangarId(airportIcao, ordinal = 1) {
  const airport = String(airportIcao || '').toUpperCase() || 'UNKNOWN';
  if (ordinal > 1) return `legacy_hangar_${airport}_${ordinal}`;
  return `legacy_hangar_${airport}`;
}

function getLegacyAirportFromHangarId(hangarId: unknown): string {
  const raw = String(hangarId || '').trim();
  if (!raw.toLowerCase().startsWith('legacy_hangar_')) return '';
  return String(raw.slice('legacy_hangar_'.length).replace(/_\d+$/, '')).toUpperCase();
}

function getHangarAirportIcao(rawHangar: any): string {
  return String(
    rawHangar?.airport_icao
    || rawHangar?.hangar_airport
    || rawHangar?.airport
    || rawHangar?.icao
    || rawHangar?.airportIcao
    || ''
  ).toUpperCase();
}

function normalizeCompanyHangars(rawHangars = []) {
  const perAirportCounts = new Map();
  return rawHangars.map((rawHangar, index) => {
    const airport = getHangarAirportIcao(rawHangar);
    const rawId = String(rawHangar?.id || rawHangar?.hangar_id || rawHangar?._id || '').trim();
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
    const rawId = String(raw?.id || raw?.hangar_id || raw?._id || '').trim();
    const normalizedId = String(normalized?.id || '').trim();
    const rawAirport = getHangarAirportIcao(raw);
    const normalizedAirport = String(normalized?.airport_icao || '').toUpperCase();
    if (rawId !== normalizedId || rawAirport !== normalizedAirport) return true;
  }
  return false;
}

function getHangarRule(hangar: any) {
  const fallback = HANGAR_SIZE_RULES[String(hangar?.size || '').toLowerCase()] || HANGAR_SIZE_RULES.small;
  const slotsRaw = Number(hangar?.slots);
  const allowedTypes = Array.isArray(hangar?.allowed_types) && hangar.allowed_types.length > 0
    ? hangar.allowed_types
    : fallback.allowed_types;
  return {
    slots: Number.isFinite(slotsRaw) && slotsRaw > 0 ? slotsRaw : fallback.slots,
    allowed_types: allowedTypes.map((type: unknown) => String(type || '').trim().toLowerCase()).filter(Boolean),
  };
}

function getAircraftHangarAssignmentsMap(company: any): Record<string, any> {
  const raw = company?.aircraft_hangar_assignments;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function resolveAircraftHangars(aircraft = [], hangars = [], assignmentMap: Record<string, any> = {}) {
  const states = hangars.map((hangar: any) => ({
    hangar,
    key: String(hangar?.id || '').trim(),
    airport: String(hangar?.airport_icao || '').toUpperCase(),
    rule: getHangarRule(hangar),
    usedSlots: 0,
  }));
  const byId = new Map(states.filter((state) => state.key).map((state) => [state.key, state]));
  const byAirport = new Map<string, any[]>();
  states.forEach((state) => {
    if (!state.airport) return;
    const list = byAirport.get(state.airport) || [];
    list.push(state);
    byAirport.set(state.airport, list);
  });

  const resolvedById = new Map<string, { hangar_id: string; hangar_airport: string }>();
  const deferred: any[] = [];
  aircraft.forEach((entry: any) => {
    const mapped = assignmentMap?.[String(entry?.id || '')] || null;
    const aircraftHangarId = String(entry?.hangar_id || mapped?.hangar_id || '').trim();
    const directMatch = aircraftHangarId ? byId.get(aircraftHangarId) : null;
    if (directMatch) {
      directMatch.usedSlots += 1;
      resolvedById.set(String(entry.id), { hangar_id: directMatch.key, hangar_airport: directMatch.airport });
      return;
    }

    const airport = String(entry?.hangar_airport || mapped?.hangar_airport || '').toUpperCase() || getLegacyAirportFromHangarId(aircraftHangarId);
    if (airport) {
      deferred.push({ entry, airport });
    } else if (hangars.length > 0) {
      deferred.push({ entry, airport: String(hangars[0]?.airport_icao || '').toUpperCase() });
    }
  });

  deferred.forEach(({ entry, airport }) => {
    const airportHangars = byAirport.get(airport) || [];
    if (airportHangars.length === 0) return;
    const aircraftType = String(entry?.type || '').trim().toLowerCase();
    const candidates = airportHangars
      .filter((state) => state.rule.allowed_types.length === 0 || state.rule.allowed_types.includes(aircraftType))
      .sort((a, b) => {
        const aFree = Number(a.rule.slots || 0) > 0 ? Number(a.rule.slots || 0) - a.usedSlots : Number.POSITIVE_INFINITY;
        const bFree = Number(b.rule.slots || 0) > 0 ? Number(b.rule.slots || 0) - b.usedSlots : Number.POSITIVE_INFINITY;
        if (bFree !== aFree) return bFree - aFree;
        return a.usedSlots - b.usedSlots;
      });
    const target = candidates.find((state) => Number(state.rule.slots || 0) <= 0 || state.usedSlots < Number(state.rule.slots || 0))
      || candidates[0]
      || airportHangars[0];
    if (!target) return;
    target.usedSlots += 1;
    resolvedById.set(String(entry.id), { hangar_id: target.key, hangar_airport: target.airport });
  });

  return aircraft.map((entry: any) => {
    const resolved = resolvedById.get(String(entry.id));
    if (!resolved) return entry;
    return {
      ...entry,
      hangar_id: resolved.hangar_id,
      hangar_airport: resolved.hangar_airport,
    };
  });
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
    const userCompanyId = String(resolveUserCompanyId(user) || '').trim();
    if ((!userCompanyId || userCompanyId !== String(company.id)) && String(company?.id || '').trim()) {
      await base44.auth.updateMe({ company_id: company.id }).catch(() => null);
    }

    const rawCompanyHangars = Array.isArray(company.hangars) ? company.hangars : [];
    const normalizedHangars = normalizeCompanyHangars(rawCompanyHangars);
    if (hangarsNeedMigration(rawCompanyHangars, normalizedHangars)) {
      await base44.asServiceRole.entities.Company.update(company.id, { hangars: normalizedHangars });
      company = { ...company, hangars: normalizedHangars };
    } else {
      company = { ...company, hangars: normalizedHangars };
    }

    // Get aircraft for this company
    const allAircraft = await base44.asServiceRole.entities.Aircraft.filter({ company_id: company.id });
    const activeAircraft = allAircraft.filter((a) => a.status !== 'sold');
    const assignmentMap = getAircraftHangarAssignmentsMap(company);
    const aircraft = resolveAircraftHangars(activeAircraft, normalizedHangars, assignmentMap);
    const aircraftById = new Map(activeAircraft.map((entry: any) => [String(entry.id), entry]));
    const aircraftHangarFixes = aircraft
      .map((entry: any) => {
        const original = aircraftById.get(String(entry.id));
        if (!original) return null;
        const nextHangarId = String(entry?.hangar_id || '').trim();
        const prevHangarId = String(original?.hangar_id || '').trim();
        const nextAirport = String(entry?.hangar_airport || '').toUpperCase();
        const prevAirport = String(original?.hangar_airport || '').toUpperCase();
        if (!nextHangarId || (nextHangarId === prevHangarId && nextAirport === prevAirport)) return null;
        return {
          id: entry.id,
          hangar_id: nextHangarId,
          hangar_airport: nextAirport,
        };
      })
      .filter(Boolean);

    if (aircraftHangarFixes.length > 0) {
      await Promise.all(
        aircraftHangarFixes.map((fix: any) => base44.asServiceRole.entities.Aircraft.update(fix.id, {
          hangar_id: fix.hangar_id,
          hangar_airport: fix.hangar_airport,
        }))
      );

      const nextAssignments = { ...assignmentMap };
      aircraftHangarFixes.forEach((fix: any) => {
        nextAssignments[String(fix.id)] = {
          hangar_id: fix.hangar_id,
          hangar_airport: fix.hangar_airport,
          updated_at: new Date().toISOString(),
        };
      });
      await base44.asServiceRole.entities.Company.update(company.id, {
        aircraft_hangar_assignments: nextAssignments,
      });
      company = { ...company, aircraft_hangar_assignments: nextAssignments };
    }

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
