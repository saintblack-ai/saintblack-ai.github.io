import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() || "pending";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "20"), 1), 50);

  const { data, error } = await supabaseAdmin
    .from("agent_approvals")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ approvals: data || [] });
}
