import { NextResponse } from "next/server";
import { HEARTBEAT_STALE_MS } from "../../../lib/archaiosConfig";
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
      taskStatuses,
      taskResultsToday,
      latestLogs,
      errorLogsToday,
      heartbeats,
      approvals
    ] = await Promise.all([
      supabaseAdmin
        .from("agent_tasks")
        .select("status"),
      supabaseAdmin
        .from("agent_tasks")
        .select("agent_name, status")
        .gte("created_at", todayStart),
      supabaseAdmin
        .from("agent_logs")
        .select("id, agent_name, level, message, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("agent_logs")
        .select("agent_name, message, created_at")
        .eq("level", "error")
        .gte("created_at", todayStart)
        .limit(100),
      supabaseAdmin
        .from("worker_heartbeat")
        .select("*")
        .order("last_seen", { ascending: false }),
      supabaseAdmin
        .from("agent_approvals")
        .select("status")
    ]);

    const firstError = [
      taskStatuses.error,
      taskResultsToday.error,
      latestLogs.error,
      errorLogsToday.error,
      heartbeats.error,
      approvals.error
    ].find(Boolean);

    if (firstError) {
      throw new Error(firstError.message || "Unable to load ARCHAIOS monitor data");
    }

    const tasksByStatus = (taskStatuses.data || []).reduce<Record<string, number>>((acc, row) => {
      const key = String(row.status || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const agentStats = (taskResultsToday.data || []).reduce<Record<string, { completed: number; failed: number; total: number }>>((acc, row) => {
      const key = String(row.agent_name || "unknown");
      if (!acc[key]) {
        acc[key] = { completed: 0, failed: 0, total: 0 };
      }
      acc[key].total += 1;
      if (row.status === "completed") {
        acc[key].completed += 1;
      }
      if (row.status === "failed") {
        acc[key].failed += 1;
      }
      return acc;
    }, {});

    const successRateByAgent = Object.entries(agentStats).map(([agentName, stats]) => ({
      agent_name: agentName,
      failures_today: stats.failed,
      success_rate: stats.total > 0 ? Number((stats.completed / stats.total).toFixed(2)) : 0
    }));

    const topErrorsToday = Object.entries(
      (errorLogsToday.data || []).reduce<Record<string, number>>((acc, row) => {
        const key = String(row.message || "unknown_error");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    const heartbeatCutoff = Date.now() - HEARTBEAT_STALE_MS;
    const workerHeartbeats = (heartbeats.data || []).map((entry) => ({
      ...entry,
      state: Date.parse(entry.last_seen) >= heartbeatCutoff ? "active" : "stale"
    }));

    const approvalQueueCounts = (approvals.data || []).reduce<Record<string, number>>((acc, row) => {
      const key = String(row.status || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      tasks_by_status: tasksByStatus,
      executor_counts: {
        workers_total: workerHeartbeats.length,
        workers_active: workerHeartbeats.filter((entry) => entry.state === "active").length
      },
      agent_metrics: successRateByAgent,
      top_errors_today: topErrorsToday,
      latest_logs: latestLogs.data || [],
      worker_heartbeats: workerHeartbeats,
      approval_queue_counts: approvalQueueCounts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load ARCHAIOS monitor data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
