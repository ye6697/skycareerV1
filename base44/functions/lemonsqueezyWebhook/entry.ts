import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const VARIANT_TO_PLAN = {
  "1464586": "monthly",
  "1464592": "yearly",
  "1464595": "lifetime",
};

async function verifySignature(rawBody, signatureHeader, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === signatureHeader;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") || "";
    const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");

    if (secret && signature) {
      const valid = await verifySignature(rawBody, signature, secret);
      if (!valid) {
        console.error("Invalid webhook signature");
        return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    
    const eventName = body.meta?.event_name;
    const data = body.data;
    const attrs = data?.attributes;
    const customData = body.meta?.custom_data || {};
    const userEmail = customData.user_email || attrs?.user_email;

    if (!userEmail) {
      console.log("No user email found in webhook payload");
      return Response.json({ ok: true });
    }

    const variantId = String(attrs?.variant_id || attrs?.first_order_item?.variant_id || "");
    const planType = VARIANT_TO_PLAN[variantId] || "monthly";

    console.log(`Webhook: ${eventName} for ${userEmail}, variant: ${variantId}, plan: ${planType}`);

    if (eventName === "order_created") {
      // One-time purchase (lifetime)
      if (planType === "lifetime") {
        // Check if subscription already exists
        const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: userEmail, plan_type: "lifetime" });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.Subscription.update(existing[0].id, {
            status: "active",
            lemon_order_id: String(data.id),
            amount: attrs.total,
          });
        } else {
          await base44.asServiceRole.entities.Subscription.create({
            user_email: userEmail,
            plan_type: "lifetime",
            status: "active",
            lemon_order_id: String(data.id),
            variant_id: variantId,
            product_name: "SkyCareer Pro Lifetime",
            amount: attrs.total,
          });
        }
      }
    } else if (eventName === "subscription_created" || eventName === "subscription_updated" || eventName === "subscription_resumed") {
      const status = attrs.status; // active, cancelled, expired, past_due, paused, unpaid
      const mappedStatus = ["active", "cancelled", "expired", "past_due", "paused", "unpaid"].includes(status) ? status : "active";

      const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: userEmail, lemon_subscription_id: String(data.id) });
      
      const subData = {
        user_email: userEmail,
        lemon_subscription_id: String(data.id),
        lemon_customer_id: String(attrs.customer_id),
        variant_id: variantId,
        plan_type: planType,
        status: mappedStatus,
        product_name: planType === "yearly" ? "SkyCareer Pro Yearly" : "SkyCareer Pro Monthly",
        renews_at: attrs.renews_at || null,
        ends_at: attrs.ends_at || null,
        amount: attrs.price,
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Subscription.update(existing[0].id, subData);
      } else {
        await base44.asServiceRole.entities.Subscription.create(subData);
      }
    } else if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
      const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: userEmail, lemon_subscription_id: String(data.id) });
      if (existing.length > 0) {
        const newStatus = eventName === "subscription_cancelled" ? "cancelled" : "expired";
        await base44.asServiceRole.entities.Subscription.update(existing[0].id, {
          status: newStatus,
          ends_at: attrs.ends_at || null,
        });
      }
    } else if (eventName === "subscription_paused") {
      const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: userEmail, lemon_subscription_id: String(data.id) });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.Subscription.update(existing[0].id, {
          status: "paused",
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});