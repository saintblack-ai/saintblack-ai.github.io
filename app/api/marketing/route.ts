import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../lib/dashboardAuth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET() {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const [draftsQuery, scheduledQuery, draftCountQuery, queueCountQuery, leadsQuery, settingsQuery] = await Promise.all([
    supabaseAdmin
      .from("marketing_drafts")
      .select("id, channel, content, status, scheduled_for, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("marketing_drafts")
      .select("id, channel, content, status, scheduled_for, created_at, metadata")
      .in("status", ["approved", "scheduled"])
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .limit(20),
    supabaseAdmin
      .from("marketing_drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    supabaseAdmin
      .from("marketing_drafts")
      .select("id", { count: "exact", head: true })
      .in("status", ["approved", "scheduled"]),
    supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("next_actions")
      .select("payload")
      .eq("action_key", "marketing_settings")
      .maybeSingle()
  ]);

  if (draftsQuery.error) {
    return NextResponse.json({ error: draftsQuery.error.message }, { status: 500 });
  }
  if (scheduledQuery.error) {
    return NextResponse.json({ error: scheduledQuery.error.message }, { status: 500 });
  }
  if (draftCountQuery.error) {
    return NextResponse.json({ error: draftCountQuery.error.message }, { status: 500 });
  }
  if (queueCountQuery.error) {
    return NextResponse.json({ error: queueCountQuery.error.message }, { status: 500 });
  }
  if (leadsQuery.error) {
    return NextResponse.json({ error: leadsQuery.error.message }, { status: 500 });
  }

  const drafts = draftsQuery.data || [];
  const queue = scheduledQuery.data || [];

  return NextResponse.json({
    drafts,
    queue,
    metrics: {
      draftsProduced: draftCountQuery.count || 0,
      draftsApproved: queueCountQuery.count || 0,
      leadsCaptured: leadsQuery.count || 0
    },
    settings: {
      sendingEnabled: Boolean(settingsQuery.data?.payload?.enabled === true)
    }
  });
}
