// Admin function: maps existing Lemon Squeezy products to in-app SKUs.
//
// IMPORTANT: Lemon Squeezy does NOT allow creating products/variants via API
// (only GET is supported on /products and /variants). You must create the
// products manually in the LS dashboard, then this function reads them back
// and stores the variant_id mapping by matching product name → SKU.
//
// Required product names in your LS store (one variant each, one-time, no subscription):
//   - "Type-Rating Instant Unlock"          ($0.99)
//   - "Aircraft Instant Unlock — Tier 1"    ($0.99)
//   - "Aircraft Instant Unlock — Tier 2"    ($2.99)
//   - "Aircraft Instant Unlock — Tier 3"    ($4.99)
//   - "SC$ Pack S"                          ($0.99)
//   - "SC$ Pack M"                          ($4.99)
//   - "SC$ Pack L"                          ($9.99)
//   - "SC$ Pack XL"                         ($14.99)
//   - "SC$ Pack XXL"                        ($19.99)
//   - "SC$ Pack Ultimate"                   ($29.99)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY");
const BASE_URL = "https://api.lemonsqueezy.com/v1";

const NAME_TO_SKU = {
  'type-rating instant unlock':           'type_rating_unlock',
  'aircraft instant unlock — tier 1':      'aircraft_tier1',
  'aircraft instant unlock - tier 1':      'aircraft_tier1',
  'aircraft instant unlock — tier 2':      'aircraft_tier2',
  'aircraft instant unlock - tier 2':      'aircraft_tier2',
  'aircraft instant unlock — tier 3':      'aircraft_tier3',
  'aircraft instant unlock - tier 3':      'aircraft_tier3',
  'sc$ pack s':                           'sc_pack_s',
  'sc$ pack m':                           'sc_pack_m',
  'sc$ pack l':                           'sc_pack_l',
  'sc$ pack xl':                          'sc_pack_xl',
  'sc$ pack xxl':                         'sc_pack_xxl',
  'sc$ pack ultimate':                    'sc_pack_ultimate',
};

async function lsApi(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/vnd.api+json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LS API ${endpoint} failed: ${res.status} - ${text}`);
  }
  return res.json();
}

function normalizeName(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Fetch all products
    const productsData = await lsApi('/products?page[size]=100');
    const products = productsData.data || [];

    const existing = await base44.asServiceRole.entities.LemonCatalogItem.list();
    const existingBySku = {};
    existing.forEach((it) => { existingBySku[it.sku] = it; });

    const results = [];
    const matched = new Set();

    for (const p of products) {
      const name = p.attributes?.name || '';
      const sku = NAME_TO_SKU[normalizeName(name)];
      if (!sku) {
        results.push({ name, status: 'unmapped' });
        continue;
      }
      // Get variant for this product
      const vData = await lsApi(`/products/${p.id}/variants`);
      const variant = vData.data?.[0];
      if (!variant) {
        results.push({ name, sku, status: 'no_variant' });
        continue;
      }

      const payload = {
        sku,
        label: name,
        price_cents: variant.attributes?.price || 0,
        product_id: String(p.id),
        variant_id: String(variant.id),
        metadata: {},
      };
      const prev = existingBySku[sku];
      if (prev) {
        await base44.asServiceRole.entities.LemonCatalogItem.update(prev.id, payload);
      } else {
        await base44.asServiceRole.entities.LemonCatalogItem.create(payload);
      }
      matched.add(sku);
      results.push({ name, sku, variant_id: String(variant.id), status: 'mapped' });
    }

    const expected = Object.values(NAME_TO_SKU);
    const missing = [...new Set(expected)].filter((sku) => !matched.has(sku) && !existingBySku[sku]?.variant_id);

    return Response.json({ ok: true, results, missing });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});