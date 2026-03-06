import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../../lib/dashboardAuth";
import { fetchWorker, getWorkerHeaders } from "../../../lib/workerClient";

export async function GET() {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const response = await fetchWorker("/api/agents/status", {
    method: "GET",
    headers: getWorkerHeaders(false)
  });

  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.status });
}
