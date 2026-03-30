import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY");
const BASE_URL = "https://api.lemonsqueezy.com/v1";

async function lsApiFetch(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Accept": "application/vnd.api+json",
    }
  });
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
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all stores
    const storesData = await lsApiFetch("/stores");
    const store = storesData.data?.[0];
    if (!store) {
      return Response.json({ error: 'No store found' }, { status: 404 });
    }
    const storeId = store.id;

    // Get all products
    const productsData = await lsApiFetch("/products");
    const products = productsData.data || [];

    // Build response with variants per product
    const result = [];
    for (const p of products) {
      const vData = await lsApiFetch(`/products/${p.id}/variants`);
      const productVariants = vData.data || [];
      result.push({
        id: p.id,
        name: p.attributes.name,
        description: p.attributes.description,
        price: p.attributes.price,
        price_formatted: p.attributes.price_formatted,
        variants: productVariants.map(v => ({
          id: v.id,
          name: v.attributes.name,
          price: v.attributes.price,
          price_formatted: v.attributes.price_formatted,
          is_subscription: v.attributes.is_subscription,
          interval: v.attributes.interval,
          interval_count: v.attributes.interval_count,
        }))
      });
    }

    return Response.json({ store_id: storeId, products: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});