import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ScoreEntryForm } from "@/components/scores/score-entry-form";
import type { SongOption } from "@/components/scores/types";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores");
  return { title: t("pageTitle") };
}

export default async function NewScorePage({
  searchParams,
}: {
  searchParams: Promise<{ chart?: string | string[] }>;
}) {
  const [user, params, t] = await Promise.all([
    getCurrentUser(),
    searchParams,
    getTranslations("scores"),
  ]);
  if (!user) redirect("/login");

  const rawChart = Array.isArray(params.chart) ? params.chart[0] : params.chart;
  const chartId = rawChart && /^\d+$/.test(rawChart) ? Number(rawChart) : 0;
  let initialSong: SongOption | null = null;
  let initialChartId = 0;

  if (Number.isSafeInteger(chartId) && chartId > 0) {
    const supabase = await createClient();
    const { data: chart } = await supabase
      .from("stepcharts")
      .select("id, song_id")
      .eq("id", chartId)
      .maybeSingle();

    if (chart) {
      const [{ data: song }, { data: charts }] = await Promise.all([
        supabase
          .from("songs")
          .select("id, title, composer")
          .eq("id", chart.song_id)
          .maybeSingle(),
        supabase
          .from("stepcharts")
          .select("id, step_type, level")
          .eq("song_id", chart.song_id),
      ]);

      if (song) {
        initialSong = {
          ...song,
          stepcharts: charts ?? [],
        } as SongOption;
        initialChartId = chart.id;
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="mb-6 w-full max-w-2xl">
        <h1 className="font-display text-3xl font-bold">{t("pageTitle")}</h1>
      </div>
      <ScoreEntryForm initialSong={initialSong} initialChartId={initialChartId} />
    </div>
  );
}
