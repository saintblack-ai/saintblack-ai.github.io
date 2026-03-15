import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

export async function updateVentureMetrics(input: Record<string, unknown> = {}) {
  const offerId = String(input.offer_id || "");
  if (!offerId) {
    throw new Error("Venture metrics update requires offer_id");
  }

  const [{ data: offer, error: offerError }, { data: existingMetric, error: metricError }] = await Promise.all([
    supabaseAdmin
      .from("venture_offers")
      .select("id, title, price_cents, status, stripe_product_id, stripe_price_id")
      .eq("id", offerId)
      .maybeSingle(),
    supabaseAdmin
      .from("venture_metrics")
      .select("*")
      .eq("offer_id", offerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (offerError || !offer) {
    throw new Error(`Unable to load venture offer for metrics: ${offerError?.message || "Not found"}`);
  }

  if (metricError) {
    throw new Error(`Unable to load venture metrics: ${metricError.message}`);
  }

  const metricPayload = {
    offer_id: offer.id,
    views: Number(existingMetric?.views || 0),
    clicks: Number(existingMetric?.clicks || 0),
    conversions: Number(existingMetric?.conversions || 0),
    revenue_cents: Number(existingMetric?.revenue_cents || 0),
    updated_at: new Date().toISOString()
  };

  if (existingMetric?.id) {
    const { data, error } = await supabaseAdmin
      .from("venture_metrics")
      .update(metricPayload)
      .eq("id", existingMetric.id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to update venture metrics: ${error.message}`);
    }

    await writeAgentLog({
      agentName: "Venture Metrics Agent",
      message: "Venture metrics refreshed for offer.",
      metadata: {
        offer_id: offer.id,
        metric_id: data?.id || existingMetric.id,
        status: offer.status
      }
    });

    return {
      metric: data || existingMetric
    };
  }

  const { data, error } = await supabaseAdmin
    .from("venture_metrics")
    .insert(metricPayload)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to initialize venture metrics: ${error.message}`);
  }

  await writeAgentLog({
    agentName: "Venture Metrics Agent",
    message: "Venture metrics initialized for offer.",
    metadata: {
      offer_id: offer.id,
      metric_id: data?.id || null,
      status: offer.status
    }
  });

  return {
    metric: data
  };
}
