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

function normalizeIdentifier(value: unknown): string {
  return String(value || '').trim();
}

function normalizeIcao(value: unknown): string {
  return normalizeIdentifier(value).toUpperCase();
}

function getHangarAirportIcao(hangar: any): string {
  return normalizeIcao(
    hangar?.airport_icao
    || hangar?.hangar_airport
    || hangar?.airport
    || hangar?.icao
    || hangar?.airportIcao
  );
}

function getLegacyHangarId(airportIcao: unknown, ordinal = 1): string {
  const airport = normalizeIcao(airportIcao) || 'UNKNOWN';
  if (ordinal > 1) return `legacy_hangar_${airport}_${ordinal}`;
  return `legacy_hangar_${airport}`;
}

function normalizeCompanyHangars(rawHangars: any[] = []): any[] {
  const perAirportCounts = new Map<string, number>();
  return rawHangars.map((rawHangar, index) => {
    const airport = getHangarAirportIcao(rawHangar);
    const rawId = normalizeIdentifier(rawHangar?.id || rawHangar?.hangar_id || rawHangar?._id);
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

function hangarsNeedMigration(rawHangars: any[] = [], normalizedHangars: any[] = []): boolean {
  if (rawHangars.length !== normalizedHangars.length) return true;
  for (let i = 0; i < normalizedHangars.length; i += 1) {
    const raw = rawHangars[i] || {};
    const normalized = normalizedHangars[i] || {};
    const rawId = normalizeIdentifier(raw?.id || raw?.hangar_id || raw?._id);
    const normalizedId = normalizeIdentifier(normalized?.id);
    const rawAirport = getHangarAirportIcao(raw);
    const normalizedAirport = getHangarAirportIcao(normalized);
    if (rawId !== normalizedId || rawAirport !== normalizedAirport) return true;
  }
  return false;
}

function getHangarIdentifierCandidates(hangar: any): string[] {
  const airport = getHangarAirportIcao(hangar);
  const candidates = [
    normalizeIdentifier(hangar?.id),
    normalizeIdentifier(hangar?.hangar_id),
    normalizeIdentifier(hangar?._id),
    airport ? getLegacyHangarId(airport) : '',
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const aircraftId = normalizeIdentifier(body?.aircraftId);
    const targetHangarId = normalizeIdentifier(body?.targetHangarId);
    const targetAirport = normalizeIcao(body?.targetAirport);
    const transferCost = Math.max(0, Number(body?.transferCost || 0));
    const lang = String(body?.lang || 'en').trim().toLowerCase() === 'de' ? 'de' : 'en';

    if (!aircraftId || (!targetAirport && !targetHangarId)) {
      return Response.json({ error: 'aircraftId and targetHangarId or targetAirport are required' }, { status: 400 });
    }

    const aircraftRows = await base44.asServiceRole.entities.Aircraft.filter({ id: aircraftId });
    const aircraft = aircraftRows?.[0] || null;
    if (!aircraft?.id) return Response.json({ error: 'Aircraft not found' }, { status: 404 });

    const userCompanyId = String(resolveUserCompanyId(user) || '').trim();
    const userEmail = String(user?.email || '').trim().toLowerCase();
    const aircraftCompanyId = String(aircraft.company_id || '').trim();

    let company = await resolveCompany(base44, user);
    if (!company?.id || String(company.id) !== aircraftCompanyId) {
      const aircraftCompanyRows = aircraftCompanyId
        ? await base44.asServiceRole.entities.Company.filter({ id: aircraftCompanyId })
        : [];
      const aircraftCompany = aircraftCompanyRows?.[0] || null;
      const ownerEmail = String(aircraftCompany?.created_by || '').trim().toLowerCase();
      const userOwnsAircraftCompany =
        (userCompanyId && aircraftCompanyId && userCompanyId === aircraftCompanyId)
        || (userEmail && ownerEmail && userEmail === ownerEmail);
      if (!userOwnsAircraftCompany) {
        return Response.json({ error: 'Aircraft does not belong to your company' }, { status: 403 });
      }
      company = aircraftCompany || company;
    }

    if (!company?.id || String(company.id) !== aircraftCompanyId) {
      return Response.json({ error: 'Company not found' }, { status: 400 });
    }

    if ((!userCompanyId || userCompanyId !== String(company.id)) && String(company.id || '').trim()) {
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

    const hangars = normalizedHangars;
    const targetHangar =
      (targetHangarId
        ? hangars.find((h: any) => getHangarIdentifierCandidates(h).includes(targetHangarId))
        : null)
      || hangars.find((h: any) => getHangarAirportIcao(h) === targetAirport);
    if (!targetHangar) {
      return Response.json({ error: 'Target hangar not found' }, { status: 400 });
    }

    const resolvedTargetAirport = getHangarAirportIcao(targetHangar) || targetAirport;
    if (!resolvedTargetAirport) {
      return Response.json({ error: 'Target hangar airport is missing' }, { status: 400 });
    }
    const resolvedTargetHangarId = getHangarIdentifierCandidates(targetHangar)[0] || targetHangarId;

    if (transferCost > 0) {
      const latestCompanyRows = await base44.asServiceRole.entities.Company.filter({ id: company.id });
      const latestCompany = latestCompanyRows?.[0] || company;
      const currentBalance = Number(latestCompany?.balance || 0);
      if (currentBalance < transferCost) {
        return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      await base44.asServiceRole.entities.Company.update(company.id, {
        balance: currentBalance - transferCost,
      });

      await base44.asServiceRole.entities.Transaction.create({
        company_id: company.id,
        type: 'expense',
        category: 'hangar_transfer',
        amount: transferCost,
        description:
          lang === 'de'
            ? `Hangar-Transfer ${aircraft.registration || aircraft.name || aircraft.id} -> ${resolvedTargetAirport}`
            : `Hangar transfer ${aircraft.registration || aircraft.name || aircraft.id} -> ${resolvedTargetAirport}`,
        date: new Date().toISOString(),
      });
    }

    await base44.asServiceRole.entities.Aircraft.update(aircraft.id, {
      hangar_id: resolvedTargetHangarId || aircraft.hangar_id || null,
      hangar_airport: resolvedTargetAirport,
    });

    return Response.json({
      success: true,
      aircraftId: aircraft.id,
      targetHangarId: resolvedTargetHangarId || null,
      targetAirport: resolvedTargetAirport,
      transferCost,
      companyId: company.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
