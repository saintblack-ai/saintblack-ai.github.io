import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function startOfDayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export async function GET() {
  try {
    const todayStart = startOfDayIso();
    const [
      pendingTasks,
      runningTasks,
      completedToday,
      failedToday,
      lastExecutorRun,
      revenueSummary,
      latestLogs
    ] = await Promise.all([
      supabaseAdmin.from("agent_tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("agent_tasks").select("id", { count: "exact", head: true }).eq("status", "running"),
      supabaseAdmin.from("agent_tasks").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", todayStart),
      supabaseAdmin.from("agent_tasks").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", todayStart),
      supabaseAdmin
        .from("agent_logs")
        .select("created_at")
        .eq("agent_name", "ARCHAIOS Executor")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("revenue_summary")
        .select("*")
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("agent_logs")
        .select("id, agent_name, level, message, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    const firstError = [
      pendingTasks.error,
      runningTasks.error,
      completedToday.error,
      failedToday.error,
      lastExecutorRun.error,
      revenueSummary.error,
      latestLogs.error
    ].find(Boolean);

    if (firstError) {
      throw new Error(firstError.message || "Unable to read ARCHAIOS status");
    }

    return NextResponse.json({
      time: new Date().toISOString(),
      tasks: {
        pending: pendingTasks.count || 0,
        running: runningTasks.count || 0,
        completed_today: completedToday.count || 0,
        failed_today: failedToday.count || 0
      },
      revenue_summary: revenueSummary.data || null,
      logs: latestLogs.data || [],
      last_executor_run: lastExecutorRun.data?.created_at || "unknown"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load ARCHAIOS status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
