import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../../lib/dashboardAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { fetchWorker, getWorkerBaseUrl } from "../../../lib/workerClient";

async function readWorkflowPresence() {
  const workflowPath = path.join(process.cwd(), ".github", "workflows", "worker_heartbeat.yml");
  try {
    await fs.access(workflowPath);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const workerBaseUrl = getWorkerBaseUrl();
  const worker = await fetchWorker("/api/health")
    .then(async (response) => ({
      ok: response.ok,
      status: response.status,
      payload: await response.json().catch(() => null)
    }))
    .catch((error: Error) => ({
      ok: false,
      status: 0,
      error: error.message
    }));

  const supabase = await supabaseAdmin
    .from("agents")
    .select("name", { count: "exact", head: true });

  const stripeWebhookEvents = await supabaseAdmin
    .from("agent_logs")
    .select("id", { count: "exact", head: true })
    .eq("agent_name", "stripe_webhook");

  const githubActionsConfigured = await readWorkflowPresence();

  return NextResponse.json({
    worker: {
      url: workerBaseUrl,
      status: worker.ok ? "healthy" : "error",
      detail: worker
    },
    supabase: {
      status: !supabase.error ? "connected" : "error",
      detail: supabase.error?.message || null
    },
    stripe: {
      status: process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET ? "configured" : "missing_config",
      webhook_events: stripeWebhookEvents.count ?? 0
    },
    githubActions: {
      status: githubActionsConfigured ? "configured" : "missing_workflow"
    },
    activeAgents: supabase.count ?? 0,
    errorAlerts: stripeWebhookEvents.error ? 1 : 0
  });
}
