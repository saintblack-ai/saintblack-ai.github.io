import { createSupabaseServerClient } from "./supabaseServer";

export async function requireDashboardUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "Unauthorized" as const };
  }

  return { user, supabase };
}
