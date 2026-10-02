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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, score, grade, plate, played_at, stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level, song:songs!stepcharts_song_id_fkey(title))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MY_SCORES_LIMIT);

  return <DashboardView user={user} scores={(data ?? []) as unknown as DashboardScore[]} scoresFailed={Boolean(error)} />;
}
