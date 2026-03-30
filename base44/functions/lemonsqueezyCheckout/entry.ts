import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY");
const BASE_URL = "https://api.lemonsqueezy.com/v1";

// Variant IDs from Lemon Squeezy
const VARIANTS = {
  monthly: "1464586",
  yearly: "1464592",
  lifetime: "1464595",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan_type } = await req.json();
    const variantId = VARIANTS[plan_type];
    if (!variantId) {
      return Response.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    // Create checkout via Lemon Squeezy API
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
              }
            },
          },
          relationships: {
            store: {
              data: { type: "stores", id: "330610" }
            },
            variant: {
              data: { type: "variants", id: variantId }
            }
          }
        }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Checkout error: ${res.status} - ${text}`);
    }

    const data = await res.json();
    const checkoutUrl = data.data.attributes.url;

    return Response.json({ checkout_url: checkoutUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});