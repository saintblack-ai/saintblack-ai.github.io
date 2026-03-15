import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../../../../lib/dashboardAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const agentName = String(body?.agent_name || "").trim();
  const actionType = String(body?.action_type || "").trim();

  if (!agentName || !actionType) {
    return NextResponse.json({ error: "Missing agent_name or action_type" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("agent_approvals")
    .insert({
      agent_name: agentName,
      action_type: actionType,
      payload: body?.payload && typeof body.payload === "object" ? body.payload : {},
      risk_score: Number(body?.risk_score || 0),
      reason: typeof body?.reason === "string" ? body.reason : null
    })
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ approval: data });
}
