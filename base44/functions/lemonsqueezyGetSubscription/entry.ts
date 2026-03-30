import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find active subscription for this user
    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    
    // Find best active subscription
    const activeSub = subs.find(s => s.status === 'active') || 
                      subs.find(s => s.status === 'cancelled' && s.ends_at && new Date(s.ends_at) > new Date()) ||
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