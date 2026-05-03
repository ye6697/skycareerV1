// Generic checkout for one-time catalog items (type-rating unlock,
// aircraft instant unlock, SC$ packs). Resolves the SKU to a Lemon Squeezy
// variant_id (stored in LemonCatalogItem) and returns a checkout URL.
//
// Custom data carries the SKU + per-purchase metadata (e.g. aircraft_model
// or listing_id) so the webhook can deliver the correct effect.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY");
const BASE_URL = "https://api.lemonsqueezy.com/v1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sku, metadata = {} } = await req.json();
    if (!sku) return Response.json({ error: 'Missing sku' }, { status: 400 });

    // Look up variant_id for this SKU
    const items = await base44.asServiceRole.entities.LemonCatalogItem.filter({ sku });
    const item = items[0];
    if (!item?.variant_id) {
      return Response.json({
        error: `SKU ${sku} not configured in Lemon Squeezy. Run lemonsqueezySetupProducts first.`,
      }, { status: 400 });
    }

    // Get store ID
    const storesRes = await fetch(`${BASE_URL}/stores`, {
      headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/vnd.api+json" },
    });
    const storesData = await storesRes.json();
    const storeId = storesData.data?.[0]?.id;

    // Create checkout
    const res = await fetch(`${BASE_URL}/checkouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              email: user.email,
              name: user.full_name || "",
              custom: {
                user_email: user.email,
                sku,
                ...metadata,
              },
            },
          },
          relationships: {
            store: { data: { type: "stores", id: storeId } },
            variant: { data: { type: "variants", id: String(item.variant_id) } },
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Checkout error: ${res.status} - ${text}`);
    }

    const data = await res.json();
    return Response.json({ checkout_url: data.data.attributes.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});