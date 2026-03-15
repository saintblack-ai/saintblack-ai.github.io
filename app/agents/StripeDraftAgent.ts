import { stripe } from "../lib/stripe";
import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const ALLOW_STRIPE_LIVE_CREATE = process.env.ALLOW_STRIPE_LIVE_CREATE === "true";

function buildRecurringInterval(billingType: string) {
  return billingType === "subscription" ? "month" : null;
}

export async function generateStripeDraft(input: Record<string, unknown> = {}) {
  const offerId = String(input.offer_id || "");
  if (!offerId) {
    throw new Error("Stripe draft generation requires offer_id");
  }

  const { data: offer, error } = await supabaseAdmin
    .from("venture_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !offer) {
    throw new Error(`Unable to load venture offer for Stripe draft: ${error?.message || "Not found"}`);
  }

  const draftPayload = {
    product: {
      name: offer.title,
      description: offer.promise,
      metadata: {
        venture_offer_id: offer.id,
        source_agent: offer.source_agent || "Offer Generator Agent"
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
    const { error: updateError } = await supabaseAdmin
      .from("venture_offers")
      .update({
        result: {
          stripe_draft: draftPayload,
          live_create_enabled: false
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", offer.id);

    if (updateError) {
      throw new Error(`Unable to store Stripe draft payload: ${updateError.message}`);
    }

    await writeAgentLog({
      agentName: "Stripe Draft Agent",
      message: "Stripe-ready product draft stored for review.",
      metadata: {
        offer_id: offer.id,
        live_create_enabled: false
      }
    });

    return {
      live_created: false,
      draft: draftPayload
    };
  }

  const product = await stripe.products.create(draftPayload.product);
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: offer.price_cents,
    product: product.id,
    recurring: draftPayload.price.recurring,
    metadata: draftPayload.price.metadata
  });

  const { error: updateError } = await supabaseAdmin
    .from("venture_offers")
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      result: {
        stripe_live_create: {
          product_id: product.id,
          price_id: price.id
        }
      },
      updated_at: new Date().toISOString()
    })
    .eq("id", offer.id);

  if (updateError) {
    throw new Error(`Unable to persist Stripe live create IDs: ${updateError.message}`);
  }

  await writeAgentLog({
    agentName: "Stripe Draft Agent",
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
