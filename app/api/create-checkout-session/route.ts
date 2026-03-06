import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { stripe } from "../../../lib/stripe";
import { getPriceIdForTier, resolveRequestedTier } from "../../lib/stripeTier";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export async function POST(request: Request) {
  if (!SITE_URL) {
    return NextResponse.json(
      { error: "Missing env var: NEXT_PUBLIC_SITE_URL" },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedTier = resolveRequestedTier(String(body?.tier ?? "pro"));
  const priceId = getPriceIdForTier(requestedTier);

  if (!priceId) {
    return NextResponse.json(
      { error: `Missing Stripe price env var for tier '${requestedTier}'.` },
      { status: 500 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${SITE_URL}/dashboard`,
    cancel_url: `${SITE_URL}/pricing`,
    customer_email: user.email ?? undefined,
    metadata: {
      user_id: user.id,
      tier: requestedTier
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        tier: requestedTier
      }
    }
  });

  return NextResponse.json({ url: session.url });
}
