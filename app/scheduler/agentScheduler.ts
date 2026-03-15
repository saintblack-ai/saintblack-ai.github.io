import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  MAX_CONCURRENT_TASKS_PER_AGENT,
  MAX_TASKS_PER_DAY_PER_AGENT,
  TASK_RESULT_STALE_MS
} from "../lib/archaiosConfig";

const SCHEDULED_AGENTS = [
  { agent_name: "Brief Agent", task_type: "brief_refresh", priority: 1 },
  { agent_name: "Market Intel Agent", task_type: "market_intel", priority: 2 },
  { agent_name: "Revenue Agent", task_type: "revenue_review", priority: 2 },
  { agent_name: "Growth Agent", task_type: "growth_scan", priority: 3 },
  { agent_name: "Media Ops Agent", task_type: "media_ops_sync", priority: 3 },
  { agent_name: "Experiment Agent", task_type: "experiment_proposal", priority: 4 }
] as const;

const SCHEDULER_WINDOW_MS = 60 * 1000;

function startOfDayIso(nowIso: string) {
  const date = new Date(nowIso);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

async function hasFreshCompletedTask(agentName: string, taskType: string, nowIso: string) {
  const staleCutoff = new Date(Date.parse(nowIso) - TASK_RESULT_STALE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("agent_tasks")
    .select("id")
    .eq("agent_name", agentName)
    .eq("task_type", taskType)
    .eq("status", "completed")
    .gte("completed_at", staleCutoff)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to inspect fresh task results: ${error.message}`);
  }

  return Boolean(data);
}

async function hasRecentQueuedTask(agentName: string, taskType: string, nowIso: string) {
  const windowStart = new Date(Date.parse(nowIso) - SCHEDULER_WINDOW_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("agent_tasks")
    .select("id")
    .eq("agent_name", agentName)
    .eq("task_type", taskType)
    .in("status", ["pending", "running"])
    .gte("created_at", windowStart)
    .limit(MAX_CONCURRENT_TASKS_PER_AGENT);

  if (error) {
    throw new Error(`Unable to inspect scheduled tasks: ${error.message}`);
  }

  return (data || []).length >= MAX_CONCURRENT_TASKS_PER_AGENT;
}

async function exceedsDailyLimit(agentName: string, nowIso: string) {
  const { count, error } = await supabaseAdmin
    .from("agent_tasks")
    .select("id", { count: "exact", head: true })
    .eq("agent_name", agentName)
    .gte("created_at", startOfDayIso(nowIso));

  if (error) {
    throw new Error(`Unable to inspect daily task volume: ${error.message}`);
  }

  return (count || 0) >= MAX_TASKS_PER_DAY_PER_AGENT;
}

export async function scheduleAgentTasks(now = new Date()) {
  const nowIso = now.toISOString();
  const inserted = [];

  for (const definition of SCHEDULED_AGENTS) {
    const exists = await hasRecentQueuedTask(definition.agent_name, definition.task_type, nowIso);
    if (exists) {
      continue;
    }

    const dailyLimitReached = await exceedsDailyLimit(definition.agent_name, nowIso);
    if (dailyLimitReached) {
      continue;
    }

    const freshResult = await hasFreshCompletedTask(definition.agent_name, definition.task_type, nowIso);
    if (freshResult) {
      continue;
    }

    const { data, error } = await supabaseAdmin
      .from("agent_tasks")
      .insert({
        agent_name: definition.agent_name,
        task_type: definition.task_type,
        payload: {
          source: "agent_scheduler",
          scheduled_for: nowIso
        },
        priority: definition.priority,
        status: "pending",
        scheduled_at: nowIso
      })
      .select("id, agent_name, task_type, status, priority, scheduled_at")
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to schedule ${definition.agent_name}: ${error.message}`);
    }

    if (data) {
      inserted.push(data);
    }
  }

  return {
    scheduledAt: nowIso,
    insertedCount: inserted.length,
    inserted
  };
}
