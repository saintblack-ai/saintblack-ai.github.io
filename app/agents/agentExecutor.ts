import { hostname } from "node:os";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  calculateBackoffUntil,
  CLAIM_STALE_MS,
  MAX_ATTEMPTS,
  MAX_AUTOMATIC_APPROVED_RISK_SCORE
} from "../lib/archaiosConfig";
import { writeAgentLog } from "../lib/agentLogs";
import { fetchWorker, getWorkerHeaders } from "../lib/workerClient";
import { planVentureExperiment } from "./ExperimentPlannerAgent";
import { buildExperimentExecutionDraft, buildExperimentProposal } from "./ExperimentAgent";
import { generateLaunchCampaign } from "./LaunchCampaignAgent";
import { generateOfferDraft } from "./OfferGeneratorAgent";
import { rankTrendOpportunities } from "./OpportunityRankerAgent";
import { createStripeProduct } from "./StripeProductAgent";
import { scanTrendSignals } from "./TrendScannerAgent";
import { updateVentureMetrics } from "./VentureMetricsAgent";

const EXECUTOR_AGENT_NAME = "ARCHAIOS Executor";

export const AGENT_EXECUTION_TARGETS = {
  "Brief Agent": "/api/agents/intelligence",
  "Market Intel Agent": "/api/agents/intelligence",
  "Revenue Agent": "/api/agents/revenue",
  "Growth Agent": "/api/agents/marketing",
  "Media Ops Agent": "/api/agents/content",
  "Experiment Agent": null,
  "Trend Scanner Agent": null,
  "Opportunity Ranker Agent": null,
  "Experiment Planner Agent": null,
  "Offer Generator Agent": null,
  "Stripe Product Agent": null,
  "Launch Campaign Agent": null,
  "Venture Metrics Agent": null,
  "Stripe Draft Agent": null,
  "Launch Asset Agent": null
} as const;

export type AgentTaskRecord = {
  id: string;
  agent_name: keyof typeof AGENT_EXECUTION_TARGETS;
  task_type: string;
  payload: Record<string, unknown> | null;
  status: string;
  priority: number;
  attempts: number;
  scheduled_at: string;
  claimed_by?: string | null;
  claimed_at?: string | null;
  backoff_until?: string | null;
};

type AgentTaskStatusCounts = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
};

function getExecutorWorkerId() {
  return process.env.ARCHAIOS_WORKER_ID || `${hostname()}-${process.pid}`;
}

async function writeWorkerHeartbeat(workerId: string, stats: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("worker_heartbeat")
    .upsert({
      worker_id: workerId,
      last_seen: new Date().toISOString(),
      stats
    }, { onConflict: "worker_id" });

  if (error) {
    throw new Error(`Unable to update worker heartbeat: ${error.message}`);
  }
}

async function listPendingTaskCandidates(limit = 10) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("agent_tasks")
    .select("id, agent_name, task_type, payload, status, priority, attempts, scheduled_at, claimed_by, claimed_at, backoff_until")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(limit * 3);

  if (error) {
    throw new Error(`Unable to load next agent task candidates: ${error.message}`);
  }

  const staleClaimCutoff = Date.now() - CLAIM_STALE_MS;

  return ((data || []) as AgentTaskRecord[]).filter((task) => {
    const backoffReady = !task.backoff_until || Date.parse(task.backoff_until) <= Date.now();
    const claimAvailable = !task.claimed_by || !task.claimed_at || Date.parse(task.claimed_at) <= staleClaimCutoff;
    return backoffReady && claimAvailable;
  }).slice(0, limit);
}

async function claimTask(task: AgentTaskRecord, workerId: string) {
  if (task.claimed_by && task.claimed_at && Date.parse(task.claimed_at) <= Date.now() - CLAIM_STALE_MS) {
    const { error: resetError } = await supabaseAdmin
      .from("agent_tasks")
      .update({
        claimed_by: null,
        claimed_at: null
      })
      .eq("id", task.id)
      .eq("status", "pending");

    if (resetError) {
      throw new Error(`Unable to clear stale claim on agent task: ${resetError.message}`);
    }
  }

  const startedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("agent_tasks")
    .update({
      status: "running",
      started_at: startedAt,
      attempts: task.attempts + 1,
      claimed_by: workerId,
      claimed_at: startedAt,
      backoff_until: null
    })
    .eq("id", task.id)
    .eq("status", "pending")
    .is("claimed_by", null)
    .select("id, agent_name, task_type, payload, status, priority, attempts, scheduled_at, claimed_by, claimed_at, backoff_until")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to claim agent task: ${error.message}`);
  }

  return (data || null) as AgentTaskRecord | null;
}

async function writeAgentMemory(task: AgentTaskRecord, result: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("agent_memory")
    .insert({
      agent_name: task.agent_name,
      context: {
        task_id: task.id,
        task_type: task.task_type,
        payload: task.payload || {}
      },
      result
    });

  if (error) {
    throw new Error(`Unable to persist agent memory: ${error.message}`);
  }
}

async function markCompleted(task: AgentTaskRecord, result: Record<string, unknown>) {
  const completedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("agent_tasks")
    .update({
      status: "completed",
      completed_at: completedAt,
      result,
      backoff_until: null
    })
    .eq("id", task.id);

  if (error) {
    throw new Error(`Unable to complete agent task: ${error.message}`);
  }

  await writeAgentMemory(task, result);
}

async function markFailed(task: AgentTaskRecord, errorMessage: string) {
  const exhausted = task.attempts >= MAX_ATTEMPTS;
  const { error } = await supabaseAdmin
    .from("agent_tasks")
    .update({
      status: exhausted ? "failed" : "pending",
      backoff_until: exhausted ? null : calculateBackoffUntil(task.attempts),
      completed_at: exhausted ? new Date().toISOString() : null,
      claimed_by: null,
      claimed_at: null,
      result: {
        error: errorMessage,
        retried_at: new Date().toISOString(),
        attempts: task.attempts
      }
    })
    .eq("id", task.id);

  if (error) {
    throw new Error(`Unable to update failed agent task: ${error.message}`);
  }
}

async function runTask(task: AgentTaskRecord) {
  if (task.task_type === "trend_scan") {
    const signals = await scanTrendSignals(task.payload || {});
    return {
      ok: true,
      status: 200,
      payload: signals
    };
  }

  if (task.task_type === "opportunity_rank") {
    const opportunities = await rankTrendOpportunities();
    return {
      ok: true,
      status: 200,
      payload: opportunities
    };
  }

  if (task.task_type === "offer_generation") {
    const offerDraft = await generateOfferDraft(task.payload || {});
    return {
      ok: true,
      status: 200,
      payload: offerDraft
    };
  }

  if (task.task_type === "experiment_proposal") {
    const proposal = await buildExperimentProposal(task.payload || {});
    const autoApproved = Number(proposal.experiment.risk_score || 0) <= MAX_AUTOMATIC_APPROVED_RISK_SCORE;
    const approvalStatus = autoApproved ? "approved" : "pending";
    const approvalTimestamp = autoApproved ? new Date().toISOString() : null;
    const { data, error } = await supabaseAdmin
      .from("agent_approvals")
      .insert({
        agent_name: task.agent_name,
        action_type: "experiment_execution",
        payload: proposal.experiment,
        status: approvalStatus,
        risk_score: Number(proposal.experiment.risk_score || 0),
        reason: autoApproved
          ? "Auto-approved under the low-risk threshold."
          : "Experiment launch affects pricing and outbound messaging, so human approval is required.",
        approved_at: approvalTimestamp
      })
      .select("id, status, risk_score")
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to create experiment approval: ${error.message}`);
    }

    if (autoApproved && data?.id) {
      const { error: taskInsertError } = await supabaseAdmin
        .from("agent_tasks")
        .insert({
          agent_name: task.agent_name,
          task_type: "experiment_execution",
          payload: {
            approval_id: data.id,
            experiment: proposal.experiment
          },
          status: "pending",
          priority: 2,
          scheduled_at: new Date().toISOString()
        });

      if (taskInsertError) {
        throw new Error(`Unable to enqueue auto-approved experiment execution: ${taskInsertError.message}`);
      }
    }

    await writeAgentLog({
      agentName: "Experiment Agent",
      message: "Experiment proposal created for approval queue.",
      metadata: {
        task_id: task.id,
        approval_id: data?.id || null,
        experiment_id: proposal.experiment.experiment_id,
        auto_approved: autoApproved
      }
    });

    return {
      ok: true,
      status: 200,
      payload: {
        approval: data,
        proposal
      }
    };
  }

  if (task.task_type === "experiment_execution") {
    const approvalId = String(task.payload?.approval_id || "");
    if (!approvalId) {
      throw new Error("Experiment execution requires approval_id");
    }

    const { data: approval, error: approvalError } = await supabaseAdmin
      .from("agent_approvals")
      .select("*")
      .eq("id", approvalId)
      .maybeSingle();

    if (approvalError) {
      throw new Error(`Unable to load experiment approval: ${approvalError.message}`);
    }

    if (!approval || approval.status !== "approved") {
      throw new Error("Experiment execution blocked until approval is approved");
    }

    const executionDraft = await buildExperimentExecutionDraft({
      experiment: approval.payload
    });

    const { error: approvalUpdateError } = await supabaseAdmin
      .from("agent_approvals")
      .update({
        status: "executed",
        executed_at: new Date().toISOString()
      })
      .eq("id", approvalId);

    if (approvalUpdateError) {
      throw new Error(`Unable to update approval execution state: ${approvalUpdateError.message}`);
    }

    await writeAgentLog({
      agentName: "Experiment Agent",
      message: "Approved experiment execution draft generated.",
      metadata: {
        task_id: task.id,
        approval_id: approvalId,
        experiment_id: executionDraft.experiment_id
      }
    });

    return {
      ok: true,
      status: 200,
      payload: executionDraft
    };
  }

  if (task.task_type === "stripe_product_creation" || task.task_type === "stripe_draft") {
    const draft = await createStripeProduct(task.payload || {});
    return {
      ok: true,
      status: 200,
      payload: draft
    };
  }

  if (task.task_type === "launch_asset_generation") {
    const assets = await generateLaunchCampaign(task.payload || {});
    return {
      ok: true,
      status: 200,
      payload: assets
    };
  }

  if (task.task_type === "experiment_plan") {
    const experiment = await planVentureExperiment(task.payload || {});
    return {
      ok: true,
      status: 200,
      payload: experiment
    };
  }

  if (task.task_type === "venture_metrics_update" || task.task_type === "metrics_update") {
    const metrics = await updateVentureMetrics(task.payload || {});
    return {
      ok: true,
      status: 200,
      payload: metrics
    };
  }

  const route = AGENT_EXECUTION_TARGETS[task.agent_name];
  if (!route) {
    throw new Error(`No execution target configured for ${task.agent_name}`);
  }
  const response = await fetchWorker(route, {
    method: "POST",
    headers: getWorkerHeaders(true),
    body: JSON.stringify(task.payload || {})
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Worker request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return {
    ok: true,
    status: response.status,
    payload
  };
}

export async function executeNextAgentTask() {
  const workerId = getExecutorWorkerId();
  const candidates = await listPendingTaskCandidates();
  if (candidates.length === 0) {
    await writeWorkerHeartbeat(workerId, {
      state: "idle",
      reason: "no_pending_tasks"
    });
    return { executed: false, reason: "no_pending_tasks", workerId };
  }

  let lockedTask: AgentTaskRecord | null = null;
  for (const candidate of candidates) {
    lockedTask = await claimTask(candidate, workerId);
    if (lockedTask) {
      break;
    }
  }

  if (!lockedTask) {
    await writeWorkerHeartbeat(workerId, {
      state: "idle",
      reason: "task_locked_elsewhere"
    });
    return { executed: false, reason: "task_locked_elsewhere", workerId };
  }

  await writeWorkerHeartbeat(workerId, {
    state: "running",
    task_id: lockedTask.id,
    agent_name: lockedTask.agent_name,
    task_type: lockedTask.task_type
  });

  await writeAgentLog({
    agentName: EXECUTOR_AGENT_NAME,
    message: "Executor started task.",
    metadata: {
      task_id: lockedTask.id,
      agent_name: lockedTask.agent_name,
      task_type: lockedTask.task_type,
      worker_id: workerId
    }
  });

  try {
    const result = await runTask(lockedTask);
    await markCompleted(lockedTask, result);
    await writeAgentLog({
      agentName: EXECUTOR_AGENT_NAME,
      message: "Executor completed task.",
      metadata: {
        task_id: lockedTask.id,
        agent_name: lockedTask.agent_name,
        task_type: lockedTask.task_type,
        status: "completed",
        worker_id: workerId
      }
    });
    await writeWorkerHeartbeat(workerId, {
      state: "idle",
      last_task_id: lockedTask.id,
      last_status: "completed",
      agent_name: lockedTask.agent_name
    });
    return {
      executed: true,
      status: "completed",
      task: lockedTask,
      result,
      workerId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent executor failure";
    await markFailed(lockedTask, message);
    await writeAgentLog({
      agentName: EXECUTOR_AGENT_NAME,
      level: "error",
      message: "Executor failed task.",
      metadata: {
        task_id: lockedTask.id,
        agent_name: lockedTask.agent_name,
        task_type: lockedTask.task_type,
        status: "failed",
        error: message,
        worker_id: workerId
      }
    });
    await writeWorkerHeartbeat(workerId, {
      state: "idle",
      last_task_id: lockedTask.id,
      last_status: "failed",
      agent_name: lockedTask.agent_name,
      error: message
    });
    return {
      executed: true,
      status: "failed",
      task: lockedTask,
      error: message,
      workerId
    };
  }
}

export async function getAgentQueueSnapshot() {
  const [{ data: countsData, error: countsError }, { data: tasksData, error: tasksError }] = await Promise.all([
    supabaseAdmin
      .from("agent_tasks")
      .select("status"),
    supabaseAdmin
      .from("agent_tasks")
      .select("id, agent_name, task_type, status, priority, attempts, scheduled_at, started_at, completed_at, created_at, result")
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  if (countsError) {
    throw new Error(`Unable to load agent queue counts: ${countsError.message}`);
  }

  if (tasksError) {
    throw new Error(`Unable to load recent agent tasks: ${tasksError.message}`);
  }

  const counts = (countsData || []).reduce<AgentTaskStatusCounts>(
    (acc, task) => {
      const status = String(task.status || "");
      if (status === "pending" || status === "running" || status === "completed" || status === "failed") {
        acc[status] += 1;
      }
      return acc;
    },
    { pending: 0, running: 0, completed: 0, failed: 0 }
  );

  return {
    counts,
    tasks: tasksData || []
  };
}
