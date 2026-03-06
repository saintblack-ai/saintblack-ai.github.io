import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../lib/dashboardAuth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET() {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("marketing_queue")
    .select("id, channel, content, scheduled_time, status, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ queue: data || [] });
}
