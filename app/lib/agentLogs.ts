import { supabaseAdmin } from "./supabaseAdmin";

export async function writeAgentLog({
  agentName,
  level = "info",
  message,
  metadata = {}
}: {
  agentName: string;
  level?: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("agent_logs").insert({
    agent_name: agentName,
    level,
    message,
    metadata
  });

  if (error) {
    throw new Error(`Unable to write agent log: ${error.message}`);
  }
}
