import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const ASSET_TYPES = ["landing_copy", "email_copy", "ad_copy", "dashboard_note"] as const;

function buildAssetContent(assetType: typeof ASSET_TYPES[number], offer: Record<string, unknown>) {
  const title = String(offer.title || "ARCHAIOS Offer");
  const promise = String(offer.promise || "");
  const audience = String(offer.audience || "");
  const cta = String(offer.cta || "Learn more");
  const price = Number(offer.price_cents || 0) / 100;

  switch (assetType) {
    case "landing_copy":
      return {
        headline: title,
        subheadline: promise,
        bullets: [
          `Built for ${audience}`,
          `Price: $${price.toFixed(2)}`,
          `CTA: ${cta}`
        ]
      };
    case "email_copy":
      return {
        subject: `${title} is ready`,
        preview: promise,
        body: `We built ${title} for ${audience}. ${promise} ${cta}.`
      };
    case "ad_copy":
      return {
        headline: title,
        body: `${promise} Built for ${audience}.`,
        cta
      };
    case "dashboard_note":
      return {
        note: `${title} is approved and launch assets are ready for operator review.`,
        audience,
        cta
      };
  }
}

export async function generateLaunchAssets(input: Record<string, unknown> = {}) {
  const offerId = String(input.offer_id || "");
  if (!offerId) {
    throw new Error("Launch asset generation requires offer_id");
  }

  const { data: offer, error } = await supabaseAdmin
    .from("venture_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    throw new Error(`Unable to load venture offer for launch assets: ${error?.message || "Not found"}`);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("venture_launch_assets")
    .delete()
    .eq("offer_id", offer.id);

  if (deleteError) {
    throw new Error(`Unable to reset launch assets: ${deleteError.message}`);
  }

  const assets = ASSET_TYPES.map((assetType) => ({
    offer_id: offer.id,
    asset_type: assetType,
    content: buildAssetContent(assetType, offer)
  }));

  const { data, error: insertError } = await supabaseAdmin
    .from("venture_launch_assets")
    .insert(assets)
    .select("*");

  if (insertError) {
    throw new Error(`Unable to store launch assets: ${insertError.message}`);
  }

  await writeAgentLog({
    agentName: "Launch Asset Agent",
    message: "Launch assets generated for approved venture offer.",
    metadata: {
      offer_id: offer.id,
      asset_count: data?.length || 0
    }
  });

  return {
    assets: data || []
  };
}
