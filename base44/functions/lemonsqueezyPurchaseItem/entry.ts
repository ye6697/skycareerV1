// Generic checkout for one-time catalog items. If the SKU isn't yet mapped
// to a Lemon Squeezy variant_id in the LemonCatalogItem entity, this function
// auto-discovers the product in your LS store by matching the product name
// to the SKU. Then it stores the mapping for next time.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY");
const BASE_URL = "https://api.lemonsqueezy.com/v1";

const SKU_TO_PRODUCT_NAMES = {
  type_rating_unlock:  ['type-rating instant unlock'],
  aircraft_tier1:      ['aircraft instant unlock — tier 1', 'aircraft instant unlock - tier 1'],
  aircraft_tier2:      ['aircraft instant unlock — tier 2', 'aircraft instant unlock - tier 2'],
  aircraft_tier3:      ['aircraft instant unlock — tier 3', 'aircraft instant unlock - tier 3'],
  sc_pack_s:           ['sc$ pack s'],
  sc_pack_m:           ['sc$ pack m'],
  sc_pack_l:           ['sc$ pack l'],
  sc_pack_xl:          ['sc$ pack xl'],
  sc_pack_xxl:         ['sc$ pack xxl'],
  sc_pack_ultimate:    ['sc$ pack ultimate'],
};

function normalizeName(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function lsApi(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/vnd.api+json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LS API ${endpoint}: ${res.status} - ${text}`);
  }
  return res.json();
}

async function autoDiscoverVariant(sku) {
  const expectedNames = SKU_TO_PRODUCT_NAMES[sku] || [];
  if (expectedNames.length === 0) return null;

  const productsData = await lsApi('/products?page[size]=100');
  const products = productsData.data || [];
  const product = products.find((p) => expectedNames.includes(normalizeName(p.attributes?.name)));
  if (!product) return null;

  const vData = await lsApi(`/products/${product.id}/variants`);
  const variant = vData.data?.[0];
  if (!variant) return null;

  return {
    product_id: String(product.id),
    variant_id: String(variant.id),
    label: product.attributes?.name || sku,
    price_cents: variant.attributes?.price || 0,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { sku, metadata = {} } = await req.json();
    if (!sku) return Response.json({ error: 'Missing sku' }, { status: 400 });

    // 1. Look up variant_id for this SKU in DB
    let items = await base44.asServiceRole.entities.LemonCatalogItem.filter({ sku });
    let item = items[0];

    // 2. If not found, auto-discover from LS store by product name
    if (!item?.variant_id) {
      const discovered = await autoDiscoverVariant(sku);
      if (!discovered) {
        return Response.json({
          error: `SKU "${sku}" konnte nicht in deinem Lemon Squeezy Store gefunden werden. Bitte lege das Produkt mit dem korrekten Namen an. Erwartet: ${(SKU_TO_PRODUCT_NAMES[sku] || []).join(' oder ')}`,
        }, { status: 400 });
      }
      // Store for next time
      if (item) {
        await base44.asServiceRole.entities.LemonCatalogItem.update(item.id, discovered);
      } else {
        item = await base44.asServiceRole.entities.LemonCatalogItem.create({ sku, ...discovered });
      }
      item = { ...item, ...discovered };
    }

    // 3. Get store ID
    const storesRes = await fetch(`${BASE_URL}/stores`, {
      headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/vnd.api+json" },
    });
    const storesData = await storesRes.json();
    const storeId = storesData.data?.[0]?.id;
    if (!storeId) return Response.json({ error: 'No Lemon Squeezy store found' }, { status: 500 });

    // 4. Create checkout
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
            store: { data: { type: "stores", id: String(storeId) } },
            variant: { data: { type: "variants", id: String(item.variant_id) } },
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Checkout error: ${res.status} - ${text}` }, { status: 400 });
    }

    const data = await res.json();
    return Response.json({ checkout_url: data.data.attributes.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});