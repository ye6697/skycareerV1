import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY");
const BASE_URL = "https://api.lemonsqueezy.com/v1";
const STORE_ID = "330610";

async function lsRequest(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Accept": "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lemon Squeezy API error: ${res.status} - ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, ...params } = await req.json();

    // LIST existing discounts
    if (action === "list") {
      const data = await lsRequest(`/discounts?filter[store_id]=${STORE_ID}`);
      const discounts = (data.data || []).map(d => ({
        id: d.id,
        name: d.attributes.name,
        code: d.attributes.code,
        amount: d.attributes.amount,
        amount_type: d.attributes.amount_type,
        is_limited_to_products: d.attributes.is_limited_to_products,
        max_redemptions: d.attributes.max_redemptions,
        redemptions: d.attributes.redemptions || 0,
        starts_at: d.attributes.starts_at,
        expires_at: d.attributes.expires_at,
        status: d.attributes.status,
        created_at: d.attributes.created_at,
      }));
      return Response.json({ discounts });
    }

    // CREATE a new discount
    if (action === "create") {
      const { name, code, amount, amount_type, max_redemptions, duration, expires_at } = params;

      if (!name || !code || !amount || !amount_type) {
        return Response.json({ error: "Missing required fields: name, code, amount, amount_type" }, { status: 400 });
      }

      const attributes = {
        name,
        code: code.toUpperCase(),
        amount: Number(amount),
        amount_type, // "percent" or "fixed"
      };

      if (max_redemptions && max_redemptions > 0) {
        attributes.max_redemptions = Number(max_redemptions);
      }

      if (duration) {
        attributes.duration = duration; // "once", "repeating", "forever"
      }

      if (expires_at) {
        attributes.expires_at = expires_at;
      }

      const body = {
        data: {
          type: "discounts",
          attributes,
          relationships: {
            store: {
              data: { type: "stores", id: STORE_ID }
            }
          }
        }
      };

      const result = await lsRequest("/discounts", "POST", body);
      return Response.json({
        success: true,
        discount: {
          id: result.data.id,
          name: result.data.attributes.name,
          code: result.data.attributes.code,
          amount: result.data.attributes.amount,
          amount_type: result.data.attributes.amount_type,
        }
      });
    }

    // DELETE a discount
    if (action === "delete") {
      const { discount_id } = params;
      if (!discount_id) {
        return Response.json({ error: "Missing discount_id" }, { status: 400 });
      }
      await lsRequest(`/discounts/${discount_id}`, "DELETE");
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});