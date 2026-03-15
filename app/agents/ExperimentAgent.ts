import { supabaseAdmin } from "../lib/supabaseAdmin";

function buildExperimentId() {
  return `exp-${Date.now()}`;
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
    throw new Error(`Unable to load market intel memory: ${error.message}`);
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
    throw new Error(`Unable to load revenue summary: ${error.message}`);
  }

  return data || null;
}

export async function buildExperimentProposal(input: Record<string, unknown> = {}) {
  const [marketIntel, revenueSummary] = await Promise.all([
    readLatestMarketIntel(),
    readRevenueSummary()
  ]);

  const marketSignal =
    String(
      (marketIntel && typeof marketIntel === "object" && "headline" in marketIntel && marketIntel.headline) ||
      input.market_signal ||
      "AI operators are responding to concrete, monetizable workflows."
    );

  const mrr = Number(
    (revenueSummary && typeof revenueSummary === "object" && "mrr" in revenueSummary && revenueSummary.mrr) || 0
  );
  const totalRevenue = Number(
    (revenueSummary && typeof revenueSummary === "object" && "total_revenue" in revenueSummary && revenueSummary.total_revenue) || 0
  );

  const focus =
    String(input.focus || input.system_focus || "Revenue expansion");
  const audience =
    "Founders and operators evaluating AI workflow automation for revenue and market intelligence.";
  const riskScore = mrr > 0 ? 0.62 : 0.48;

  const experiment = {
    experiment_id: buildExperimentId(),
    hypothesis:
      mrr > 0
        ? "A tightly framed operator offer can increase conversion from current demand and improve expansion revenue."
        : "A focused low-friction offer can convert early demand into first revenue faster than a broad landing page.",
    offer: {
      name: mrr > 0 ? "Operator Revenue Sprint" : "ARCHAIOS Signal Sprint",
      price: mrr > 0 ? 149 : 49,
      cadence: mrr > 0 ? "one-time sprint" : "weekly pilot",
      audience
    },
    copy: {
      headline: mrr > 0
        ? "Turn ARCHAIOS intelligence into immediate revenue action."
        : "Launch a focused ARCHAIOS signal sprint for your next growth move.",
      body: `Focus: ${focus}. Test a sharp ${mrr > 0 ? "upsell" : "entry"} offer around ARCHAIOS. Lead with: ${marketSignal}`,
      cta: mrr > 0 ? "Book the sprint" : "Start the pilot"
    },
    expected_metric: mrr > 0 ? "Upgrade conversion rate" : "First paid conversion rate",
    risk_score: riskScore,
    supporting_context: {
      market_signal: marketSignal,
      current_mrr: mrr,
      total_revenue: totalRevenue
    }
  };

  return {
    market_intel: marketIntel,
    revenue_summary: revenueSummary,
    system_focus: focus,
    experiment
  };
}

export async function buildExperimentExecutionDraft(input: Record<string, unknown> = {}) {
  const proposal =
    input.experiment && typeof input.experiment === "object"
      ? input.experiment
      : (await buildExperimentProposal(input)).experiment;

  return {
    experiment_id: String((proposal as Record<string, unknown>).experiment_id || buildExperimentId()),
    content_draft: {
      title: `Launch draft for ${String((proposal as Record<string, unknown>).offer && ((proposal as Record<string, unknown>).offer as Record<string, unknown>).name || "ARCHAIOS experiment")}`,
      summary: String((proposal as Record<string, unknown>).hypothesis || ""),
      body: `Audience: ${String((proposal as Record<string, unknown>).offer && ((proposal as Record<string, unknown>).offer as Record<string, unknown>).audience || "")}\n\nHeadline: ${String((proposal as Record<string, unknown>).copy && ((proposal as Record<string, unknown>).copy as Record<string, unknown>).headline || "")}\n\nBody:\n${String((proposal as Record<string, unknown>).copy && ((proposal as Record<string, unknown>).copy as Record<string, unknown>).body || "")}\n\nCTA: ${String((proposal as Record<string, unknown>).copy && ((proposal as Record<string, unknown>).copy as Record<string, unknown>).cta || "")}\n\nExpected Metric: ${String((proposal as Record<string, unknown>).expected_metric || "")}`
    },
    stripe_product_draft: {
      name: String((proposal as Record<string, unknown>).offer && ((proposal as Record<string, unknown>).offer as Record<string, unknown>).name || "ARCHAIOS Offer"),
      price: Number((proposal as Record<string, unknown>).offer && ((proposal as Record<string, unknown>).offer as Record<string, unknown>).price || 0),
      cadence: String((proposal as Record<string, unknown>).offer && ((proposal as Record<string, unknown>).offer as Record<string, unknown>).cadence || "one-time")
    }
  };
}
