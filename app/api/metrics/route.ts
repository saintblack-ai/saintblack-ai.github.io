import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../lib/dashboardAuth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET() {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const [metricsQuery, salesQuery] = await Promise.all([
    supabaseAdmin
      .from("performance_metrics")
      .select("id, metric_type, value, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("sales_content")
      .select("id, content_type, content, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (metricsQuery.error) {
    return NextResponse.json({ error: metricsQuery.error.message }, { status: 500 });
  }
  if (salesQuery.error) {
    return NextResponse.json({ error: salesQuery.error.message }, { status: 500 });
  }

  return NextResponse.json({
    metrics: metricsQuery.data || [],
    salesContent: salesQuery.data || []
  });
}
