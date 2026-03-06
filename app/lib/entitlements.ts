import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "pro" | "elite" | "enterprise";

const TIER_LIMITS: Record<Tier, number> = {
  free: 1,
  pro: 5,
  elite: 20,
  enterprise: Number.POSITIVE_INFINITY
};

type UserWithSubscription = {
  subscription?: {
    tier?: string | null;
    status?: string | null;
  } | null;
};

export function getTier(user: UserWithSubscription | null | undefined): Tier {
  const tier = user?.subscription?.tier;
  const status = user?.subscription?.status;

  if (status !== "active") {
    return "free";
  }

  if (tier === "pro" || tier === "elite" || tier === "enterprise") {
    return tier;
  }

  return "free";
}

export function canGenerateBrief(user: { tier: Tier; dailyUsage: number }): boolean {
  const limit = TIER_LIMITS[user.tier];
  return user.dailyUsage < limit;
}

export async function getUserEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  tier: Tier;
  dailyUsage: number;
  dailyLimit: number;
  canGenerate: boolean;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ data: subscription }, { count }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("tier,status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("briefs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString())
  ]);

  const tier = getTier({ subscription });
  const dailyUsage = count ?? 0;
  const dailyLimit = TIER_LIMITS[tier];

  return {
    tier,
    dailyUsage,
    dailyLimit,
    canGenerate: canGenerateBrief({ tier, dailyUsage })
  };
}
