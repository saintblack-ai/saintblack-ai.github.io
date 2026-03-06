import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../../lib/dashboardAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Missing enabled flag" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("next_actions")
    .upsert(
      {
        action_key: "marketing_settings",
        payload: {
          enabled: body.enabled,
          requires_confirmation: true,
          updated_by: "dashboard"
        },
        updated_at: new Date().toISOString()
      },
      { onConflict: "action_key" }
    )
    .select("payload")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: {
      sendingEnabled: Boolean(data?.payload?.enabled === true)
    }
  });
}
