export type StripeTier = "free" | "pro" | "elite" | "enterprise";

type StripeTierEnv = {
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ELITE?: string;
  STRIPE_PRICE_ENTERPRISE?: string;
  STRIPE_PRICE_ID?: string;
  PRICE_ID?: string;
};

const PURCHASEABLE_TIERS: StripeTier[] = ["pro", "elite", "enterprise"];

export function normalizeTier(raw: string | null | undefined): StripeTier {
  if (raw === "pro" || raw === "elite" || raw === "enterprise") {
    return raw;
  }
  return "free";
}

export function resolveRequestedTier(raw: string | null | undefined): StripeTier {
  const tier = normalizeTier(raw);
  return tier === "free" ? "pro" : tier;
}

export function getPriceIdForTier(
  tier: StripeTier,
  env: StripeTierEnv = process.env
): string | null {
  if (tier === "pro") {
    return env.STRIPE_PRICE_PRO || env.STRIPE_PRICE_ID || env.PRICE_ID || null;
  }
  if (tier === "elite") {
    return env.STRIPE_PRICE_ELITE || null;
  }
  if (tier === "enterprise") {
    return env.STRIPE_PRICE_ENTERPRISE || null;
  }
  return null;
}

export function tierFromPriceId(
  priceId: string | null | undefined,
  env: StripeTierEnv = process.env
): StripeTier {
  if (!priceId) {
    return "free";
  }

  if (env.STRIPE_PRICE_ENTERPRISE && priceId === env.STRIPE_PRICE_ENTERPRISE) {
    return "enterprise";
  }
  if (env.STRIPE_PRICE_ELITE && priceId === env.STRIPE_PRICE_ELITE) {
    return "elite";
  }
  if (
    (env.STRIPE_PRICE_PRO && priceId === env.STRIPE_PRICE_PRO) ||
    (env.STRIPE_PRICE_ID && priceId === env.STRIPE_PRICE_ID) ||
    (env.PRICE_ID && priceId === env.PRICE_ID)
  ) {
    return "pro";
  }

  return "free";
}

export function getPurchaseableTiers(): StripeTier[] {
  return [...PURCHASEABLE_TIERS];
}
