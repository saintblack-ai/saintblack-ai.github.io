import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const ASSET_TYPES = [
  "landing_page_copy",
  "email_launch_copy",
  "short_ad_copy",
  "social_launch_post"
] as const;

function buildAssetContent(assetType: typeof ASSET_TYPES[number], offer: Record<string, unknown>) {
  const title = String(offer.title || "ARCHAIOS Offer");
  const promise = String(offer.promise || "");
  const audience = String(offer.audience || "");
  const cta = String(offer.cta || "Learn more");
  const tone = Number(offer.price_cents || 0) >= 10000 ? "decisive" : "inviting";

  switch (assetType) {
    case "landing_page_copy":
      return {
        headline: title,
        body: `${promise} Built for ${audience}.`,
        cta,
        audience,
        tone
      };
    case "email_launch_copy":
      return {
        headline: `${title} is ready`,
        body: `We built ${title} for ${audience}. ${promise}`,
        cta,
        audience,
        tone
      };
    case "short_ad_copy":
      return {
        headline: title,
        body: `${promise} ${cta}.`,
        cta,
        audience,
        tone: "concise"
      };
    case "social_launch_post":
      return {
        headline: `Launch: ${title}`,
        body: `${promise} Built for ${audience}.`,
        cta,
        audience,
        tone: "bold"
      };
  }
}

export async function generateLaunchCampaign(input: Record<string, unknown> = {}) {
  const offerId = String(input.offer_id || "");
  if (!offerId) {
    throw new Error("Launch campaign generation requires offer_id");
  }

  const { data: offer, error } = await supabaseAdmin
    .from("venture_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    throw new Error(`Unable to load venture offer for launch campaign: ${error?.message || "Not found"}`);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("venture_launch_assets")
    .delete()
    .eq("offer_id", offer.id);

  if (deleteError) {
    throw new Error(`Unable to reset venture launch assets: ${deleteError.message}`);
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
    throw new Error(`Unable to store launch campaign assets: ${insertError.message}`);
  }

  await writeAgentLog({
    agentName: "Launch Campaign Agent",
    message: "Launch campaign assets generated for approved venture offer.",
    metadata: {
      offer_id: offer.id,
      asset_count: data?.length || 0
    }
  });

  return {
    assets: data || []
  };
}
