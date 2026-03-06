import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabaseServer";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default async function BriefPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: brief, error } = await supabase
    .from("briefs")
    .select("id, title, content, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        <h1>Brief</h1>
        <p style={{ color: "crimson" }}>Failed to load brief: {error.message}</p>
      </main>
    );
  }

  if (!brief) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>{brief.title?.trim() || "Untitled brief"}</h1>
      <p style={{ color: "#666" }}>{formatDate(brief.created_at)}</p>
      <article style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
        {brief.content || "(No content)"}
      </article>
    </main>
  );
}

