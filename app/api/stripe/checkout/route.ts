import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabaseServer";
import { stripe } from "../../../lib/stripe";
import { getPriceIdForTier, resolveRequestedTier } from "../../../lib/stripeTier";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const successUrl = new URL("/dashboard", request.url).toString();
  const cancelUrl = new URL("/pricing", request.url).toString();
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
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
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

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session URL." },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
