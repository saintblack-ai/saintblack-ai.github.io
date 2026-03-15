import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  const [offersResult, assetsResult, metricsResult] = await Promise.all([
    supabaseAdmin
      .from("venture_offers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("venture_launch_assets")
      .select("offer_id, asset_type"),
    supabaseAdmin
      .from("venture_metrics")
      .select("*")
      .order("created_at", { ascending: false })
  ]);

  if (offersResult.error) {
    return NextResponse.json({ error: offersResult.error.message }, { status: 500 });
  }

  if (assetsResult.error) {
    return NextResponse.json({ error: assetsResult.error.message }, { status: 500 });
  }

  if (metricsResult.error) {
    return NextResponse.json({ error: metricsResult.error.message }, { status: 500 });
  }

  const assetCounts = (assetsResult.data || []).reduce<Record<string, number>>((acc, asset) => {
    const key = String(asset.offer_id);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const latestMetrics = (metricsResult.data || []).reduce<Record<string, Record<string, unknown>>>((acc, metric) => {
    const key = String(metric.offer_id);
    if (!acc[key]) {
      acc[key] = metric;
    }
    return acc;
  }, {});

  const offers = (offersResult.data || []).map((offer) => ({
    ...offer,
    stripe_product_created: Boolean(offer.stripe_product_id && offer.stripe_price_id),
    stripe_draft_exists: Boolean(
      offer.stripe_product_id ||
      offer.stripe_price_id ||
      (offer.result && typeof offer.result === "object" && ("stripe_product_draft" in offer.result || "stripe_draft" in offer.result))
    ),
    approval_state: offer.status === "pending_approval" ? "pending" : offer.status,
    launch_asset_count: assetCounts[String(offer.id)] || 0,
    launch_assets_ready: (assetCounts[String(offer.id)] || 0) >= 4,
    metrics: latestMetrics[String(offer.id)] || null
  }));

  return NextResponse.json({ offers });
}
