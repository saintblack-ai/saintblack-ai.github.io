import { supabaseAdmin } from "../lib/supabaseAdmin";
import { writeAgentLog } from "../lib/agentLogs";

function buildOfferTitle(focus: string, hasRevenue: boolean) {
  return hasRevenue ? `${focus} Revenue Sprint` : `${focus} Signal Pilot`;
}

async function readLatestMarketIntel() {
  const { data, error } = await supabaseAdmin
    .from("agent_memory")
    .select("result, created_at")
    .eq("agent_name", "Market Intel Agent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read latest market intel: ${error.message}`);
  }

  return data?.result || null;
}

async function readRevenueSummary() {
  const { data, error } = await supabaseAdmin
    .from("revenue_summary")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read revenue summary: ${error.message}`);
  }

  return data || null;
}

async function readRecentOffers() {
  const { data, error } = await supabaseAdmin
    .from("venture_offers")
    .select("title, status, price_cents, billing_type, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Unable to read recent venture offers: ${error.message}`);
  }

  return data || [];
}

export async function generateOfferDraft(input: Record<string, unknown> = {}) {
  const [marketIntel, revenueSummary, recentOffers] = await Promise.all([
    readLatestMarketIntel(),
    readRevenueSummary(),
    readRecentOffers()
  ]);

  const focus = String(input.focus || input.system_focus || "Operator");
  const marketSignal = String(
    (marketIntel && typeof marketIntel === "object" && "headline" in marketIntel && marketIntel.headline) ||
    "Operators are rewarding offers that convert intelligence into immediate action."
  );
  const totalRevenue = Number(
    (revenueSummary && typeof revenueSummary === "object" && "total_revenue" in revenueSummary && revenueSummary.total_revenue) || 0
  );
  const hasRevenue = totalRevenue > 0;
  const priceCents = hasRevenue ? 14900 : 4900;
  const billingType = hasRevenue ? "one_time" : "subscription";
  const trialEnabled = !hasRevenue;
  const title = buildOfferTitle(focus, hasRevenue);

  const offerDraft = {
    title,
    promise: hasRevenue
      ? "Compress market intelligence into a revenue action plan in one focused sprint."
      : "Turn live AI market signals into a first paid offer without weeks of guesswork.",
    audience: "Founders, operators, and creators building revenue-generating AI products.",
    price_cents: priceCents,
    billing_type: billingType,
    trial_enabled: trialEnabled,
    cta: hasRevenue ? "Book the sprint" : "Start the pilot",
    reasoning: `Latest market signal: ${marketSignal}. Revenue baseline: ${totalRevenue > 0 ? `$${totalRevenue}` : "pre-revenue"}.`,
    expected_outcome: hasRevenue ? "Higher conversion into premium operator services." : "First paid conversion and clearer offer-market fit.",
    risk_score: hasRevenue ? 0.42 : 0.36,
    metadata: {
      market_signal: marketSignal,
      focus,
      recent_offers: recentOffers
    }
  };

  const { data: offer, error: offerError } = await supabaseAdmin
    .from("venture_offers")
    .insert({
      title: offerDraft.title,
      promise: offerDraft.promise,
      audience: offerDraft.audience,
      price_cents: offerDraft.price_cents,
      billing_type: offerDraft.billing_type,
      trial_enabled: offerDraft.trial_enabled,
      cta: offerDraft.cta,
      status: "pending_approval",
      source_agent: "Offer Generator Agent",
      metadata: {
        reasoning: offerDraft.reasoning,
        expected_outcome: offerDraft.expected_outcome,
        risk_score: offerDraft.risk_score,
        context: offerDraft.metadata
      }
    })
    .select("*")
    .maybeSingle();

  if (offerError || !offer) {
    throw new Error(`Unable to store venture offer draft: ${offerError?.message || "Unknown error"}`);
  }

  const { data: approval, error: approvalError } = await supabaseAdmin
    .from("agent_approvals")
    .insert({
      agent_name: "Offer Generator Agent",
      action_type: "venture_offer",
      payload: {
        offer_id: offer.id,
        offer: offerDraft
      },
      status: "pending",
      risk_score: offerDraft.risk_score,
      reason: "New venture offers require human approval before Stripe draft preparation."
    })
    .select("*")
    .maybeSingle();

  if (approvalError || !approval) {
    throw new Error(`Unable to create venture offer approval: ${approvalError?.message || "Unknown error"}`);
  }

  const { error: offerUpdateError } = await supabaseAdmin
    .from("venture_offers")
    .update({
      approval_id: approval.id,
      updated_at: new Date().toISOString()
    })
    .eq("id", offer.id);

  if (offerUpdateError) {
    throw new Error(`Unable to link venture offer approval: ${offerUpdateError.message}`);
  }

  await writeAgentLog({
    agentName: "Offer Generator Agent",
    message: "Venture offer draft generated and sent to approval queue.",
    metadata: {
      offer_id: offer.id,
      approval_id: approval.id,
      title: offerDraft.title,
      risk_score: offerDraft.risk_score
    }
  });

  return {
    offer: {
      ...offer,
      approval_id: approval.id
    },
    approval,
    draft: offerDraft
  };
}
