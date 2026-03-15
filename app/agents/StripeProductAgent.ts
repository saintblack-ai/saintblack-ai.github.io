import { stripe } from "../lib/stripe";
import { ALLOW_STRIPE_LIVE_CREATE } from "../lib/archaiosConfig";
import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

function buildRecurringInterval(billingType: string) {
  return billingType === "subscription" ? "month" : null;
}

export async function createStripeProduct(input: Record<string, unknown> = {}) {
  const offerId = String(input.offer_id || "");
  if (!offerId) {
    throw new Error("Stripe product creation requires offer_id");
  }

  const { data: offer, error } = await supabaseAdmin
    .from("venture_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    throw new Error(`Unable to load venture offer for Stripe product creation: ${error?.message || "Not found"}`);
  }

  const productDraft = {
    product: {
      name: offer.title,
      description: offer.promise,
      metadata: {
        venture_offer_id: offer.id,
        source_agent: offer.source_agent || "Offer Generator Agent",
        billing_type: offer.billing_type
      }
    },
    price: {
      unit_amount: offer.price_cents,
      currency: "usd",
      recurring: buildRecurringInterval(offer.billing_type)
        ? {
            interval: buildRecurringInterval(offer.billing_type) as "month"
          }
        : undefined,
      metadata: {
        venture_offer_id: offer.id
      }
    }
  };

  if (!ALLOW_STRIPE_LIVE_CREATE) {
    const nextResult = {
      ...(offer.result && typeof offer.result === "object" ? offer.result : {}),
      stripe_product_draft: productDraft,
      live_create_enabled: false
    };

    const { error: updateError } = await supabaseAdmin
      .from("venture_offers")
      .update({
        result: nextResult,
        updated_at: new Date().toISOString()
      })
      .eq("id", offer.id);

    if (updateError) {
      throw new Error(`Unable to store Stripe product draft payload: ${updateError.message}`);
    }

    await writeAgentLog({
      agentName: "Stripe Product Agent",
      message: "Stripe-ready product payload stored for review.",
      metadata: {
        offer_id: offer.id,
        live_create_enabled: false
      }
    });

    return {
      live_created: false,
      draft: productDraft
    };
  }

  const product = await stripe.products.create(productDraft.product);
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: offer.price_cents,
    product: product.id,
    recurring: productDraft.price.recurring,
    metadata: productDraft.price.metadata
  });

  const nextResult = {
    ...(offer.result && typeof offer.result === "object" ? offer.result : {}),
    stripe_live_create: {
      product_id: product.id,
      price_id: price.id
    },
    live_create_enabled: true
  };

  const { error: updateError } = await supabaseAdmin
    .from("venture_offers")
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      result: nextResult,
      updated_at: new Date().toISOString()
    })
    .eq("id", offer.id);

  if (updateError) {
    throw new Error(`Unable to persist Stripe product IDs: ${updateError.message}`);
  }

  await writeAgentLog({
    agentName: "Stripe Product Agent",
    message: "Stripe product and price created for approved venture offer.",
    metadata: {
      offer_id: offer.id,
      product_id: product.id,
      price_id: price.id,
      live_create_enabled: true
    }
  });

  return {
    live_created: true,
    product_id: product.id,
    price_id: price.id
  };
}
