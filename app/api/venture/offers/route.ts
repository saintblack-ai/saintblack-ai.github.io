import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  const [offersResult, assetsResult] = await Promise.all([
    supabaseAdmin
      .from("venture_offers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("venture_launch_assets")
      .select("offer_id, asset_type")
  ]);

  if (offersResult.error) {
    return NextResponse.json({ error: offersResult.error.message }, { status: 500 });
  }

  if (assetsResult.error) {
    return NextResponse.json({ error: assetsResult.error.message }, { status: 500 });
  }

  const assetCounts = (assetsResult.data || []).reduce<Record<string, number>>((acc, asset) => {
    const key = String(asset.offer_id);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const offers = (offersResult.data || []).map((offer) => ({
    ...offer,
    stripe_draft_exists: Boolean(
      offer.stripe_product_id ||
      offer.stripe_price_id ||
      (offer.result && typeof offer.result === "object" && "stripe_draft" in offer.result)
    ),
    launch_asset_count: assetCounts[String(offer.id)] || 0
  }));

  return NextResponse.json({ offers });
}
