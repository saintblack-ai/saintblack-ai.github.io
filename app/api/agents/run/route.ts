import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../../lib/dashboardAuth";
import { executeNextAgentTask, getAgentQueueSnapshot } from "../../../agents/agentExecutor";
import { scheduleAgentTasks } from "../../../scheduler/agentScheduler";
import { writeAgentLog } from "../../../lib/agentLogs";

async function authorizeCronTrigger(request: Request) {
  const token = process.env.WORKER_AUTH_TOKEN;
  if (!token) {
    return true;
  }

  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${token}`;
}

async function runExecutorCycle() {
  await writeAgentLog({
    agentName: "ARCHAIOS Executor",
    message: "Executor cycle started.",
    metadata: {
      cycle_started_at: new Date().toISOString()
    }
  });

  const scheduled = await scheduleAgentTasks();
  const execution = await executeNextAgentTask();
  const queue = await getAgentQueueSnapshot();

  await writeAgentLog({
    agentName: "ARCHAIOS Executor",
    message: "Executor cycle completed.",
    metadata: {
      cycle_completed_at: new Date().toISOString(),
      inserted_tasks: scheduled.insertedCount,
      executed: execution.executed
    }
  });

  return {
    ok: true,
    scheduled,
    execution,
    queue
  };
}

export async function GET(request: Request) {
  const allowed = await authorizeCronTrigger(request);
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runExecutorCycle());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run agent executor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  await request.json().catch(() => null);

  try {
    return NextResponse.json(await runExecutorCycle());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run agent executor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
