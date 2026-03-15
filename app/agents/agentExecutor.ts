import { supabaseAdmin } from "../lib/supabaseAdmin";
import { writeAgentLog } from "../lib/agentLogs";
import { fetchWorker, getWorkerHeaders } from "../lib/workerClient";
import { buildExperimentExecutionDraft, buildExperimentProposal } from "./ExperimentAgent";

const MAX_ATTEMPTS = 3;
const EXECUTOR_AGENT_NAME = "ARCHAIOS Executor";

export const AGENT_EXECUTION_TARGETS = {
  "Brief Agent": "/api/agents/intelligence",
  "Market Intel Agent": "/api/agents/intelligence",
  "Revenue Agent": "/api/agents/revenue",
  "Growth Agent": "/api/agents/marketing",
  "Media Ops Agent": "/api/agents/content",
  "Experiment Agent": null
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
};

type AgentTaskStatusCounts = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
};

function buildRetrySchedule(attempts: number) {
  const delaySeconds = Math.min(300, Math.max(30, attempts * 30));
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

async function selectNextPendingTask() {
  const { data, error } = await supabaseAdmin
    .from("agent_tasks")
    .select("id, agent_name, task_type, payload, status, priority, attempts, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load next agent task: ${error.message}`);
  }

  return (data || null) as AgentTaskRecord | null;
}

async function lockTask(task: AgentTaskRecord) {
  const startedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("agent_tasks")
    .update({
      status: "running",
      started_at: startedAt,
      attempts: task.attempts + 1
    })
    .eq("id", task.id)
    .eq("status", "pending")
    .select("id, agent_name, task_type, payload, status, priority, attempts, scheduled_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to lock agent task: ${error.message}`);
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
      result
    })
    .eq("id", task.id);

  if (error) {
    throw new Error(`Unable to complete agent task: ${error.message}`);
  }

  await writeAgentMemory(task, result);
}

async function markFailed(task: AgentTaskRecord, errorMessage: string) {
  const nextAttempts = task.attempts + 1;
  const exhausted = nextAttempts >= MAX_ATTEMPTS;
  const { error } = await supabaseAdmin
    .from("agent_tasks")
    .update({
      status: exhausted ? "failed" : "pending",
      scheduled_at: exhausted ? task.scheduled_at : buildRetrySchedule(nextAttempts),
      completed_at: exhausted ? new Date().toISOString() : null,
      result: {
        error: errorMessage,
        retried_at: new Date().toISOString()
      }
    })
    .eq("id", task.id);

  if (error) {
    throw new Error(`Unable to update failed agent task: ${error.message}`);
  }
}

async function runTask(task: AgentTaskRecord) {
  if (task.task_type === "experiment_proposal") {
    const proposal = await buildExperimentProposal(task.payload || {});
    const { data, error } = await supabaseAdmin
      .from("agent_approvals")
      .insert({
        agent_name: task.agent_name,
        action_type: "experiment_execution",
        payload: proposal.experiment,
        status: "pending",
        risk_score: Number(proposal.experiment.risk_score || 0),
        reason: "Experiment launch affects pricing and outbound messaging, so human approval is required."
      })
      .select("id, status, risk_score")
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to create experiment approval: ${error.message}`);
    }

    await writeAgentLog({
      agentName: "Experiment Agent",
      message: "Experiment proposal created for approval queue.",
      metadata: {
        task_id: task.id,
        approval_id: data?.id || null,
        experiment_id: proposal.experiment.experiment_id
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
  const nextTask = await selectNextPendingTask();
  if (!nextTask) {
    return { executed: false, reason: "no_pending_tasks" };
  }

  const lockedTask = await lockTask(nextTask);
  if (!lockedTask) {
    return { executed: false, reason: "task_locked_elsewhere" };
  }

  await writeAgentLog({
    agentName: EXECUTOR_AGENT_NAME,
    message: "Executor started task.",
    metadata: {
      task_id: lockedTask.id,
      agent_name: lockedTask.agent_name,
      task_type: lockedTask.task_type
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
        status: "completed"
      }
    });
    return {
      executed: true,
      status: "completed",
      task: lockedTask,
      result
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
        error: message
      }
    });
    return {
      executed: true,
      status: "failed",
      task: lockedTask,
      error: message
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
