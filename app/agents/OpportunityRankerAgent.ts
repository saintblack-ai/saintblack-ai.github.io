import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

function clampScore(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function buildOpportunityFromSignal(signal: Record<string, unknown>) {
  const topic = String(signal.topic || "Operator demand signal");
  const momentum = Number(signal.momentum_score || 0);
  const audienceSize = Number(signal.audience_size || 0);
  const problem = String(signal.problem_detected || "Teams are struggling to convert demand into action.");
  const urgency = clampScore(momentum * 0.8);
  const marketSize = clampScore(audienceSize / 1000);
  const monetizationPotential = clampScore(momentum * 0.65 + marketSize * 0.35);
  const competitionLevel = clampScore(40 + momentum * 0.3);
  const confidenceScore = Number(((urgency + monetizationPotential + (100 - competitionLevel)) / 300).toFixed(2));
  const priceCents = momentum >= 80 ? 29900 : momentum >= 70 ? 14900 : 7900;
  const billingType = monetizationPotential >= 70 ? "subscription" : "one_time";

  return {
    title: `${topic} Operator Offer`,
    problem,
    solution: `Package ${topic.toLowerCase()} into a guided offer that turns signal detection into a fast launch plan.`,
    promise: `Turn ${topic.toLowerCase()} demand into a structured venture launch path with approval-safe execution.`,
    audience: "Founders, operators, and creators looking for a fast monetization wedge.",
    price_cents: priceCents,
    billing_type: billingType,
    trial_enabled: billingType === "subscription",
    cta: billingType === "subscription" ? "Start the signal sprint" : "Launch the offer",
    reasoning: {
      market_size: marketSize,
      urgency,
      monetization_potential: monetizationPotential,
      competition_level: competitionLevel
    },
    expected_outcome: "Validate an opportunity with a stronger signal-to-offer pipeline and clearer monetization path.",
    confidence_score: confidenceScore,
    risk_score: Number((0.18 + competitionLevel / 200).toFixed(2))
  };
}

export async function rankTrendOpportunities() {
  const { data: signals, error: signalsError } = await supabaseAdmin
    .from("trend_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .order("momentum_score", { ascending: false })
    .limit(5);

  if (signalsError) {
    throw new Error(`Unable to load trend signals: ${signalsError.message}`);
  }

  const candidates = signals || [];
  if (candidates.length === 0) {
    return {
      created: []
    };
  }

  const created = [];

  for (const signal of candidates) {
    const draft = buildOpportunityFromSignal(signal);
    const { data: existing } = await supabaseAdmin
      .from("venture_offers")
      .select("id")
      .eq("title", draft.title)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { data: offer, error: offerError } = await supabaseAdmin
      .from("venture_offers")
      .insert({
        title: draft.title,
        promise: draft.promise,
        problem: draft.problem,
        solution: draft.solution,
        audience: draft.audience,
        price_cents: draft.price_cents,
        billing_type: draft.billing_type,
        trial_enabled: draft.trial_enabled,
        cta: draft.cta,
        confidence_score: draft.confidence_score,
        status: "pending_approval",
        source_agent: "Opportunity Ranker Agent",
        metadata: {
          trend_signal_id: signal.id,
          source: signal.source,
          reasoning: draft.reasoning,
          expected_outcome: draft.expected_outcome
        }
      })
      .select("*")
      .maybeSingle();

    if (offerError || !offer) {
      throw new Error(`Unable to store ranked opportunity: ${offerError?.message || "Unknown error"}`);
    }

    const { data: approval, error: approvalError } = await supabaseAdmin
      .from("agent_approvals")
      .insert({
        agent_name: "Opportunity Ranker Agent",
        action_type: "venture_offer",
        payload: {
          offer_id: offer.id,
          offer: draft,
          trend_signal_id: signal.id
        },
        status: "pending",
        risk_score: draft.risk_score,
        reason: "Autonomous opportunities require human approval before experiment planning and launch preparation."
      })
      .select("*")
      .maybeSingle();

    if (approvalError || !approval) {
      throw new Error(`Unable to create opportunity approval: ${approvalError?.message || "Unknown error"}`);
    }

    const { error: offerUpdateError } = await supabaseAdmin
      .from("venture_offers")
      .update({
        approval_id: approval.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", offer.id);

    if (offerUpdateError) {
      throw new Error(`Unable to link opportunity approval: ${offerUpdateError.message}`);
    }

    await writeAgentLog({
      agentName: "Opportunity Ranker Agent",
      message: "opportunity_generated",
      metadata: {
        offer_id: offer.id,
        approval_id: approval.id,
        trend_signal_id: signal.id,
        confidence_score: draft.confidence_score
      }
    });

    created.push({
      offer,
      approval
    });
  }

  return {
    created
  };
}
