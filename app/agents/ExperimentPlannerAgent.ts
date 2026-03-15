import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

function buildExperimentPlan(offer: Record<string, unknown>) {
  const billingType = String(offer.billing_type || "one_time");
  return {
    traffic_source: billingType === "subscription" ? "organic_search" : "operator_referrals",
    launch_channel: billingType === "subscription" ? "email_waitlist" : "direct_outreach",
    pricing_model: billingType,
    test_duration: billingType === "subscription" ? 14 : 10,
    success_metric: billingType === "subscription"
      ? "Trial-to-paid conversion rate above 8%"
      : "Offer acceptance rate above 5%"
  };
}

export async function planVentureExperiment(input: Record<string, unknown> = {}) {
  const offerId = String(input.offer_id || "");
  if (!offerId) {
    throw new Error("Experiment planning requires offer_id");
  }

  const [{ data: offer, error: offerError }, { data: existingPlan, error: existingError }] = await Promise.all([
    supabaseAdmin
      .from("venture_offers")
      .select("*")
      .eq("id", offerId)
      .maybeSingle(),
    supabaseAdmin
      .from("venture_experiments")
      .select("*")
      .eq("offer_id", offerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (offerError || !offer) {
    throw new Error(`Unable to load venture offer for experiment planning: ${offerError?.message || "Not found"}`);
  }

  if (existingError) {
    throw new Error(`Unable to inspect existing venture experiment plan: ${existingError.message}`);
  }

  if (existingPlan) {
    return {
      experiment: existingPlan,
      reused: true
    };
  }

  const plan = buildExperimentPlan(offer);
  const { data, error } = await supabaseAdmin
    .from("venture_experiments")
    .insert({
      offer_id: offer.id,
      ...plan
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Unable to store venture experiment plan: ${error?.message || "Unknown error"}`);
  }

  await writeAgentLog({
    agentName: "Experiment Planner Agent",
    message: "experiment_planned",
    metadata: {
      offer_id: offer.id,
      experiment_id: data.id,
      launch_channel: data.launch_channel
    }
  });

  return {
    experiment: data,
    reused: false
  };
}
