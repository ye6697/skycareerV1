import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = String(user.email || '').toLowerCase();

    // Fetch all subscriptions and match case-insensitively, since admins
    // may have created records with different casing than the user's login.
    const allSubs = await base44.asServiceRole.entities.Subscription.list();
    const subs = allSubs.filter(
      (s) => String(s.user_email || '').toLowerCase() === userEmail,
    );

    // Find best active subscription
    const activeSub = subs.find((s) => s.status === 'active') ||
                      subs.find((s) => s.status === 'cancelled' && s.ends_at && new Date(s.ends_at) > new Date()) ||
                      null;

    const isPro = !!activeSub;

    return Response.json({
      is_pro: isPro,
      subscription: activeSub,
      all_subscriptions: subs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});