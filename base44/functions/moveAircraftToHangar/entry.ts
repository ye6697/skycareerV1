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

function normalizeIdentifier(value: unknown): string {
  return String(value || '').trim();
}

function normalizeIcao(value: unknown): string {
  return normalizeIdentifier(value).toUpperCase();
}

function getHangarIdentifierCandidates(hangar: any): string[] {
  const candidates = [
    normalizeIdentifier(hangar?.id),
    normalizeIdentifier(hangar?.hangar_id),
    normalizeIdentifier(hangar?._id),
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

    if (!aircraftId || !targetAirport) {
      return Response.json({ error: 'aircraftId and targetAirport are required' }, { status: 400 });
    }

    const company = await resolveCompany(base44, user);
    if (!company?.id) return Response.json({ error: 'Company not found' }, { status: 400 });

    const aircraftRows = await base44.asServiceRole.entities.Aircraft.filter({ id: aircraftId });
    const aircraft = aircraftRows?.[0] || null;
    if (!aircraft?.id) return Response.json({ error: 'Aircraft not found' }, { status: 404 });
    if (String(aircraft.company_id || '') !== String(company.id)) {
      return Response.json({ error: 'Aircraft does not belong to your company' }, { status: 403 });
    }

    const hangars = Array.isArray(company.hangars) ? company.hangars : [];
    const targetHangar =
      hangars.find((h: any) => getHangarIdentifierCandidates(h).includes(targetHangarId))
      || hangars.find((h: any) => normalizeIcao(h?.airport_icao) === targetAirport);
    if (!targetHangar) {
      return Response.json({ error: 'Target hangar not found' }, { status: 400 });
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
            ? `Hangar-Transfer ${aircraft.registration || aircraft.name || aircraft.id} -> ${targetAirport}`
            : `Hangar transfer ${aircraft.registration || aircraft.name || aircraft.id} -> ${targetAirport}`,
        date: new Date().toISOString(),
      });
    }

    await base44.asServiceRole.entities.Aircraft.update(aircraft.id, {
      hangar_id: resolvedTargetHangarId || aircraft.hangar_id || null,
      hangar_airport: targetAirport,
    });

    return Response.json({
      success: true,
      aircraftId: aircraft.id,
      targetHangarId: resolvedTargetHangarId || null,
      targetAirport,
      transferCost,
      companyId: company.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
