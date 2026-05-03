// Admin-only: manually grant a Pro subscription to a user (e.g. when a
// Lemon Squeezy webhook didn't deliver because of an email mismatch).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (String(me.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const { user_email, plan_type = 'monthly', days = 31, note = '' } = await req.json();
    if (!user_email) return Response.json({ error: 'Missing user_email' }, { status: 400 });

    const email = String(user_email).toLowerCase().trim();
    const renewsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    // Avoid creating duplicate active subs
    const existing = await base44.asServiceRole.entities.Subscription.list();
    const mine = existing.filter((s) => String(s.user_email || '').toLowerCase() === email);
    const activeOne = mine.find((s) => s.status === 'active');
    if (activeOne) {
      await base44.asServiceRole.entities.Subscription.update(activeOne.id, {
        plan_type,
        status: 'active',
        renews_at: plan_type === 'lifetime' ? null : renewsAt,
        product_name: `SkyCareer Pro (manual${note ? ': ' + note : ''})`,
      });
      return Response.json({ ok: true, action: 'updated', id: activeOne.id });
    }

    const created = await base44.asServiceRole.entities.Subscription.create({
      user_email: email,
      plan_type,
      status: 'active',
      product_name: `SkyCareer Pro (manual${note ? ': ' + note : ''})`,
      renews_at: plan_type === 'lifetime' ? null : renewsAt,
      amount: 0,
    });
    return Response.json({ ok: true, action: 'created', id: created.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});