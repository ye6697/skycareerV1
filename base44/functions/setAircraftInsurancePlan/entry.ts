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

    // 24h cooldown: prevent dynamic insurance switching to game the system.
    // Only enforce when the plan actually changes (same plan re-save is fine).
    const currentPlan = String(aircraft.insurance_plan || '').trim().toLowerCase();
    const isPlanChange = currentPlan && currentPlan !== plan.key;
    if (isPlanChange && aircraft.insurance_changed_at) {
      const last = new Date(aircraft.insurance_changed_at).getTime();
      const now = Date.now();
      const elapsedMs = now - last;
      const cooldownMs = 24 * 60 * 60 * 1000;
      if (Number.isFinite(last) && elapsedMs < cooldownMs) {
        const remainingMs = cooldownMs - elapsedMs;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        return Response.json({
          error: 'insurance_cooldown',
          message: `Insurance plan can only be changed once every 24 hours. Try again in ~${remainingHours}h.`,
          cooldown_remaining_ms: remainingMs,
          cooldown_remaining_hours: remainingHours,
          insurance_changed_at: aircraft.insurance_changed_at,
        }, { status: 429 });
      }
    }

    await base44.asServiceRole.entities.Aircraft.update(aircraft.id, {
      insurance_plan: plan.key,
      insurance_hourly_rate_pct: plan.hourlyRatePctOfNewValue,
      insurance_maintenance_coverage_pct: plan.maintenanceCoveragePct,
      insurance_score_bonus_pct: plan.scoreBonusPct,
      insurance_changed_at: new Date().toISOString(),
    });

    // Keep in-flight session metadata aligned so result views don't fall back to BASIC.
    const activeFlights = await base44.asServiceRole.entities.Flight.filter({ aircraft_id: aircraft.id, status: 'in_flight' });
    await Promise.all(
      (Array.isArray(activeFlights) ? activeFlights : [])
        .filter((fl) => fl?.id)
        .map((fl) => base44.asServiceRole.entities.Flight.update(fl.id, {
          xplane_data: {
            ...(fl?.xplane_data || {}),
            insurance_plan: plan.key,
            insurance_hourly_rate_pct: plan.hourlyRatePctOfNewValue,
            insurance_coverage_pct: Math.round(plan.maintenanceCoveragePct * 100),
            insurance_score_bonus_pct: Math.round(plan.scoreBonusPct * 100),
          },
        }))
    );

    if (aircraft.company_id && (!userCompanyId || String(userCompanyId) !== String(aircraft.company_id))) {
      try {
        await base44.auth.updateMe({ company_id: aircraft.company_id });
      } catch (_) {
        // no-op
      }
    }

    const refreshedAircraftRows = await base44.asServiceRole.entities.Aircraft.filter({ id: aircraft.id });
    const refreshedAircraft = refreshedAircraftRows[0] || aircraft;

    return Response.json({
      success: true,
      aircraft_id: aircraft.id,
      insurance_plan: String(refreshedAircraft.insurance_plan || plan.key).trim().toLowerCase(),
      insurance_hourly_rate_pct: Number(refreshedAircraft.insurance_hourly_rate_pct ?? plan.hourlyRatePctOfNewValue),
      insurance_maintenance_coverage_pct: Number(refreshedAircraft.insurance_maintenance_coverage_pct ?? plan.maintenanceCoveragePct),
      insurance_score_bonus_pct: Number(refreshedAircraft.insurance_score_bonus_pct ?? plan.scoreBonusPct),
      insurance_changed_at: refreshedAircraft.insurance_changed_at || null,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'set insurance failed' }, { status: 500 });
  }
});