import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../lib/dashboardAuth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const CORE_AGENT_NAMES = ["intelligence_agent", "content_agent", "marketing_agent", "revenue_agent"];

export async function GET() {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("name, description, schedule, enabled")
    .in("name", CORE_AGENT_NAMES)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (data || []).map(async (agent) => {
      const latestRun = await supabaseAdmin
        .from("agent_runs")
        .select("created_at, status")
        .eq("agent_name", agent.name)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...agent,
        tags: agent.schedule ? [agent.schedule] : [],
        last_run: latestRun.data?.created_at || null,
        last_status: latestRun.data?.status || "never_run"
      };
    })
  );

  return NextResponse.json({ agents: enriched });
}

export async function PATCH(request: Request) {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const agentName = String(body?.agent || "").trim();
  if (!agentName) {
    return NextResponse.json({ error: "Missing agent" }, { status: 400 });
  }
  if (!CORE_AGENT_NAMES.includes(agentName)) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body?.enabled === "boolean") {
    updates.enabled = body.enabled;
  }
  if (typeof body?.schedule === "string") {
    if (["daily", "hourly", "weekly"].includes(body.schedule)) {
      updates.schedule = body.schedule;
    }
  } else if (Array.isArray(body?.tags)) {
    const nextSchedule = body.tags
      .map((value: unknown) => String(value))
      .find((value: string) => value === "daily" || value === "hourly" || value === "weekly");
    if (nextSchedule) {
      updates.schedule = nextSchedule;
    }
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update(updates)
    .eq("name", agentName)
    .select("name, description, schedule, enabled")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    agent: data
      ? {
          ...data,
          tags: data.schedule ? [data.schedule] : []
        }
      : null
  });
}
