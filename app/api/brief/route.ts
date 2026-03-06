import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabaseServer";
import { getUserEntitlement } from "../../lib/entitlements";
import { getWorkerBaseUrl, getWorkerHeaders } from "../../lib/workerClient";

export async function POST(request: Request) {
  const workerUrl = getWorkerBaseUrl();
  if (!workerUrl) {
    return NextResponse.json(
      { error: "Missing worker env vars." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const isGuestFreeRequest =
    body.user_id === "guest-free" && body.tier === "free";

  if (isGuestFreeRequest) {
    const workerResponse = await fetch(`${workerUrl}/api/brief`, {
      method: "POST",
      headers: getWorkerHeaders(),
      body: JSON.stringify(body)
    });

    const workerPayload = await workerResponse.json().catch(() => null);
    return NextResponse.json(workerPayload, { status: workerResponse.status });
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlement = await getUserEntitlement(supabase, user.id).catch(
    (error: Error) => {
      return { error: error.message };
    }
  );

  if ("error" in entitlement) {
    return NextResponse.json(
      { error: `Failed to check entitlement: ${entitlement.error}` },
      { status: 500 }
    );
  }

  if (!entitlement.canGenerate) {
    return NextResponse.json(
      {
        error: "Daily brief limit reached for current tier",
        tier: entitlement.tier,
        daily_usage: entitlement.dailyUsage,
        daily_limit: entitlement.dailyLimit
      },
      { status: 403 }
    );
  }

  const workerResponse = await fetch(`${workerUrl}/api/brief`, {
    method: "POST",
    headers: getWorkerHeaders(),
    body: JSON.stringify({
      ...body,
      user_id: user.id
    })
  });

  const workerPayload = await workerResponse.json().catch(() => null);
  return NextResponse.json(workerPayload, { status: workerResponse.status });
}
