import { NextResponse } from "next/server";
import { getAgentQueueSnapshot } from "../../../agents/agentExecutor";

export async function GET() {
  try {
    const snapshot = await getAgentQueueSnapshot();
    return NextResponse.json({
      pending_tasks: snapshot.counts.pending,
      running_tasks: snapshot.counts.running,
      completed_tasks: snapshot.counts.completed,
      failed_tasks: snapshot.counts.failed,
      recent_tasks: snapshot.tasks
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load agent queue status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
