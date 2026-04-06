import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const INSURANCE_PACKAGES: Record<string, {
  key: string;
  hourlyRatePctOfNewValue: number;
  maintenanceCoveragePct: number;
  scoreBonusPct: number;
}> = {
  basic: {
    key: 'basic',
    hourlyRatePctOfNewValue: 0.00022,
    maintenanceCoveragePct: 0.22,
    scoreBonusPct: 0,
  },
  plus: {
    key: 'plus',
    hourlyRatePctOfNewValue: 0.00065,
    maintenanceCoveragePct: 0.5,
    scoreBonusPct: 0.02,
  },
  premium: {
    key: 'premium',
    hourlyRatePctOfNewValue: 0.0022,
    maintenanceCoveragePct: 0.82,
    scoreBonusPct: 0.05,
  },
};

const resolveUserCompanyId = (user: any): string | null => (
  user?.company_id
  || user?.data?.company_id
  || user?.company?.id
  || user?.data?.company?.id
  || null
);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const aircraftId = body?.aircraftId ? String(body.aircraftId) : '';
    const planKeyRaw = body?.planKey ? String(body.planKey).trim().toLowerCase() : '';
    const plan = INSURANCE_PACKAGES[planKeyRaw];
    if (!aircraftId) return Response.json({ error: 'aircraftId required' }, { status: 400 });
    if (!plan) return Response.json({ error: 'invalid insurance plan' }, { status: 400 });

    const aircraftRows = await base44.asServiceRole.entities.Aircraft.filter({ id: aircraftId });
    const aircraft = aircraftRows[0] || null;
    if (!aircraft?.id) return Response.json({ error: 'Aircraft not found' }, { status: 404 });

    const userCompanyId = resolveUserCompanyId(user);
    let company = null;

    if (aircraft.company_id) {
      const companyRows = await base44.asServiceRole.entities.Company.filter({ id: aircraft.company_id });
      company = companyRows[0] || null;
    }
    if (!company && userCompanyId) {
      const companyRows = await base44.asServiceRole.entities.Company.filter({ id: userCompanyId });
      company = companyRows[0] || null;
    }
    if (!company && user?.email) {
      const companyRows = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
      company = companyRows[0] || null;
    }
    if (!company?.id) return Response.json({ error: 'Unternehmen nicht gefunden' }, { status: 404 });

    const sameCompany = String(aircraft.company_id || '') === String(company.id || '');
    const ownedByUser = company.created_by === user.email;
    const linkedToUserCompany = !!userCompanyId && String(userCompanyId) === String(company.id);
    if (!sameCompany || (!ownedByUser && !linkedToUserCompany)) {
      return Response.json({ error: 'Keine Berechtigung fuer dieses Flugzeug' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Aircraft.update(aircraft.id, {
      insurance_plan: plan.key,
      insurance_hourly_rate_pct: plan.hourlyRatePctOfNewValue,
      insurance_maintenance_coverage_pct: plan.maintenanceCoveragePct,
      insurance_score_bonus_pct: plan.scoreBonusPct,
    });

    return Response.json({
      success: true,
      aircraft_id: aircraft.id,
      insurance_plan: plan.key,
      insurance_hourly_rate_pct: plan.hourlyRatePctOfNewValue,
      insurance_maintenance_coverage_pct: plan.maintenanceCoveragePct,
      insurance_score_bonus_pct: plan.scoreBonusPct,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'set insurance failed' }, { status: 500 });
  }
});

