import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DashboardView, type DashboardScore } from "@/components/dashboard/dashboard-view";
import { getCurrentUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

const MY_SCORES_LIMIT = 20;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/login");

  const supabase = await createClient();
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = typeof rawPage === "string" && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const { count, error: countError } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / MY_SCORES_LIMIT));
  const page = Math.min(Math.max(1, parsedPage), totalPages);
  const { data, error } = await supabase
    .from("scores")
    .select("id, score, grade, plate, played_at, stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level, song:songs!stepcharts_song_id_fkey(title))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * MY_SCORES_LIMIT, page * MY_SCORES_LIMIT - 1);

  return <DashboardView
    user={user}
    scores={(data ?? []) as unknown as DashboardScore[]}
    scoresFailed={Boolean(countError || error)}
    historyPage={page}
    historyPages={totalPages}
  />;
}
