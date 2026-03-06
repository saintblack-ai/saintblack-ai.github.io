import { NextResponse } from "next/server";
import { requireDashboardUser } from "../../../lib/dashboardAuth";
import { fetchWorker, getWorkerHeaders } from "../../../lib/workerClient";

export async function POST(request: Request) {
  const auth = await requireDashboardUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.id) {
    return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
  }

  const response = await fetchWorker("/api/marketing/approve", {
    method: "POST",
    headers: getWorkerHeaders(),
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload, { status: response.status });
}

