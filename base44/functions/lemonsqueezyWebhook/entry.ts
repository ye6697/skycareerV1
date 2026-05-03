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

    // Catalog item delivery (type-rating, aircraft, SC$ packs)
    if (eventName === "order_created" && customData.sku) {
      const sku = String(customData.sku);
      console.log(`Catalog purchase: sku=${sku}, user=${userEmail}`);

      // Idempotency: skip if already delivered (same order_id)
      const existing = await base44.asServiceRole.entities.Subscription.filter({
        user_email: userEmail,
        lemon_order_id: String(data.id),
      });
      if (existing.length > 0) {
        return Response.json({ ok: true, note: 'already delivered' });
      }

      // Resolve company
      const allUsers = await base44.asServiceRole.entities.User.filter({ email: userEmail });
      const targetUser = allUsers[0];
      const companyId = targetUser?.company_id;
      let company = null;
      if (companyId) {
        const cs = await base44.asServiceRole.entities.Company.filter({ id: companyId });
        company = cs[0] || null;
      }
      if (!company && targetUser) {
        const cs = await base44.asServiceRole.entities.Company.filter({ created_by: userEmail });
        company = cs[0] || null;
      }

      const meta = {};

      // 1) SC$ pack
      if (sku.startsWith('sc_pack_')) {
        const SC_PACKS_MAP = {
          sc_pack_s:        100000,
          sc_pack_m:        600000,
          sc_pack_l:       1500000,
          sc_pack_xl:      4000000,
          sc_pack_xxl:    12000000,
          sc_pack_ultimate:300000000,
        };
        const scAmount = SC_PACKS_MAP[sku] || 0;
        if (company && scAmount > 0) {
          await base44.asServiceRole.entities.Company.update(company.id, {
            balance: (company.balance || 0) + scAmount,
          });
          await base44.asServiceRole.entities.Transaction.create({
            company_id: company.id,
            type: 'income',
            category: 'other',
            amount: scAmount,
            description: `SC$ Pack purchase (${sku})`,
            date: new Date().toISOString(),
          });
          meta.sc_amount = scAmount;
        }
      }

      // 2) Type-rating instant unlock
      if (sku === 'type_rating_unlock') {
        const model = String(customData.aircraft_model || '');
        if (targetUser && model) {
          const ratings = Array.isArray(targetUser.type_ratings) ? targetUser.type_ratings : [];
          if (!ratings.includes(model)) {
            await base44.asServiceRole.entities.User.update(targetUser.id, {
              type_ratings: [...ratings, model],
              active_type_rating: null,
            });
          }
          meta.aircraft_model = model;
        }
      }

      // 3) Aircraft instant unlock — credit company balance with the listed
      //    purchase price so the player can buy the aircraft normally.
      if (sku.startsWith('aircraft_tier')) {
        const listingId = String(customData.listing_id || '');
        const listingPrice = Number(customData.listing_price || 0);
        if (company && listingPrice > 0) {
          await base44.asServiceRole.entities.Company.update(company.id, {
            balance: (company.balance || 0) + listingPrice,
          });
          await base44.asServiceRole.entities.Transaction.create({
            company_id: company.id,
            type: 'income',
            category: 'other',
            amount: listingPrice,
            description: `Aircraft Instant Unlock (${listingId})`,
            date: new Date().toISOString(),
          });
          meta.listing_id = listingId;
          meta.listing_price = listingPrice;
        }
      }

      await base44.asServiceRole.entities.Subscription.create({
        user_email: userEmail,
        plan_type: 'catalog',
        status: 'delivered',
        lemon_order_id: String(data.id),
        variant_id: variantId,
        product_name: sku,
        amount: attrs.total,
        sku,
        metadata: meta,
      });

      return Response.json({ ok: true, delivered: sku });
    }

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