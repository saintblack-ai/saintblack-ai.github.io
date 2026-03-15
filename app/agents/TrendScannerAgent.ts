import { writeAgentLog } from "../lib/agentLogs";
import { supabaseAdmin } from "../lib/supabaseAdmin";

type TrendSignal = {
  source: string;
  topic: string;
  momentum_score: number;
  audience_size: number;
  problem_detected: string;
};

async function readLatestMarketIntel() {
  const { data, error } = await supabaseAdmin
    .from("agent_memory")
    .select("result")
    .eq("agent_name", "Market Intel Agent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read market intel for trend scanner: ${error.message}`);
  }

  return data?.result || null;
}

function fallbackSignals(contextHeadline: string) {
  return [
    {
      source: "reddit",
      topic: "AI operators want faster offer validation",
      momentum_score: 82,
      audience_size: 54000,
      problem_detected: "Founders are struggling to turn noisy AI demand into a sellable first offer."
    },
    {
      source: "producthunt",
      topic: "Launch tooling for solo founders",
      momentum_score: 76,
      audience_size: 21000,
      problem_detected: "Operators want launch systems, not another analytics dashboard."
    },
    {
      source: "hackernews",
      topic: "Agent reliability and approval gating",
      momentum_score: 79,
      audience_size: 17000,
      problem_detected: "Teams want autonomous systems with clear human checkpoints."
    },
    {
      source: "google_trends",
      topic: contextHeadline || "AI workflow automation for revenue teams",
      momentum_score: 74,
      audience_size: 68000,
      problem_detected: "Revenue teams are searching for automation that produces measurable output quickly."
    },
    {
      source: "twitter_x",
      topic: "Monetizable AI agents for creators",
      momentum_score: 71,
      audience_size: 43000,
      problem_detected: "Creators want packaged offers and launch assets without building an in-house growth team."
    }
  ] satisfies TrendSignal[];
}

async function tryFetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ARCHAIOS/1.0"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return await response.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLiveSignals(): Promise<TrendSignal[]> {
  const [redditPayload, hnPayload] = await Promise.all([
    tryFetchJson("https://www.reddit.com/r/all/hot.json?limit=3"),
    tryFetchJson("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=3")
  ]);

  const liveSignals: TrendSignal[] = [];

  const redditChildren = redditPayload?.data?.children;
  if (Array.isArray(redditChildren)) {
    redditChildren.forEach((entry: any, index: number) => {
      const post = entry?.data;
      if (!post?.title) {
        return;
      }

      liveSignals.push({
        source: "reddit",
        topic: String(post.title),
        momentum_score: Math.max(55, 90 - index * 7),
        audience_size: Number(post.ups || 0) * 20,
        problem_detected: "Communities are signaling immediate pain around scaling, automation, or monetization."
      });
    });
  }

  const hnHits = hnPayload?.hits;
  if (Array.isArray(hnHits)) {
    hnHits.forEach((entry: any, index: number) => {
      if (!entry?.title) {
        return;
      }

      liveSignals.push({
        source: "hackernews",
        topic: String(entry.title),
        momentum_score: Math.max(58, 88 - index * 6),
        audience_size: Number(entry.points || 0) * 30,
        problem_detected: "Builders are debating a fresh problem worth packaging into a clear venture offer."
      });
    });
  }

  return liveSignals;
}

export async function scanTrendSignals(input: Record<string, unknown> = {}) {
  const marketIntel = await readLatestMarketIntel();
  const contextHeadline = String(
    input.focus ||
    input.system_focus ||
    (marketIntel && typeof marketIntel === "object" && "headline" in marketIntel ? marketIntel.headline : "") ||
    ""
  );

  const liveSignals = await fetchLiveSignals();
  const signals = liveSignals.length > 0 ? liveSignals : fallbackSignals(contextHeadline);

  const { data, error } = await supabaseAdmin
    .from("trend_signals")
    .insert(signals)
    .select("*");

  if (error) {
    throw new Error(`Unable to store trend signals: ${error.message}`);
  }

  await writeAgentLog({
    agentName: "Trend Scanner Agent",
    message: "trend_scan_complete",
    metadata: {
      signal_count: data?.length || 0,
      live_sources_used: liveSignals.length > 0
    }
  });

  return {
    signals: data || [],
    live_sources_used: liveSignals.length > 0
  };
}
