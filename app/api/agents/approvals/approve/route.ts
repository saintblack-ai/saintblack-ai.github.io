import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../../../../lib/dashboardAuth";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const approvalId = String(body?.id || "").trim();
  const decision = String(body?.decision || "").trim().toLowerCase();

  if (!approvalId || !["approved", "denied"].includes(decision)) {
    return NextResponse.json({ error: "Missing id or invalid decision" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data: approval, error: loadError } = await supabaseAdmin
    .from("agent_approvals")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }

  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("agent_approvals")
    .update({
      status: decision,
      approved_at: decision === "approved" ? nowIso : null
    })
    .eq("id", approvalId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (decision === "approved") {
    if (approval.action_type === "venture_offer") {
      const offerId = String(approval.payload?.offer_id || "");
      if (!offerId) {
        return NextResponse.json({ error: "Venture offer approval missing offer_id" }, { status: 400 });
      }

      const { error: offerUpdateError } = await supabaseAdmin
        .from("venture_offers")
        .update({
          status: "approved",
          updated_at: nowIso
        })
        .eq("id", offerId);

      if (offerUpdateError) {
        return NextResponse.json({ error: offerUpdateError.message }, { status: 500 });
      }
    } else {
      const { error: taskError } = await supabaseAdmin
        .from("agent_tasks")
        .insert({
          agent_name: approval.agent_name,
          task_type: approval.action_type,
          payload: {
            approval_id: approval.id,
            experiment: approval.payload
          },
          status: "pending",
          priority: 2,
          scheduled_at: nowIso
        });

      if (taskError) {
        return NextResponse.json({ error: taskError.message }, { status: 500 });
      }
    }
  } else if (approval.action_type === "venture_offer") {
    const offerId = String(approval.payload?.offer_id || "");
    if (offerId) {
      const { error: offerUpdateError } = await supabaseAdmin
        .from("venture_offers")
        .update({
          status: "archived",
          updated_at: nowIso
        })
        .eq("id", offerId);

      if (offerUpdateError) {
        return NextResponse.json({ error: offerUpdateError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ approval: data });
}
