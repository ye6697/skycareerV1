// Polled by the frontend after an in-app purchase to detect when the webhook
// has finalized delivery. Returns the most recent delivered catalog purchase
// (optionally filtered by sku and/or item metadata like aircraft_model).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const sku = url.searchParams.get('sku') || null;
    const sinceIso = url.searchParams.get('since') || null;
    const since = sinceIso ? new Date(sinceIso).getTime() : Date.now() - 30 * 60 * 1000;

    const recent = await base44.asServiceRole.entities.Subscription.filter({
      user_email: user.email,
      plan_type: 'catalog',
      status: 'delivered',
    }, '-created_date', 20);

    const matched = recent.filter((s) => {
      const ts = new Date(s.created_date || s.updated_date || 0).getTime();
      if (ts < since) return false;
      if (sku && s.sku !== sku) return false;
      return true;
    });

    return Response.json({ delivered: matched });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});