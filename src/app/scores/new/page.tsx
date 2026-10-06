import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ScoreEntryForm } from "@/components/scores/score-entry-form";
import type { SongOption } from "@/components/scores/types";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

type CabinetOption = {
  id: number;
  serial_number: string;
  name: string;
  location: string;
  country: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores");
  return { title: t("pageTitle") };
}

export default async function NewScorePage({
  searchParams,
}: {
  searchParams: Promise<{ chart?: string | string[]; cabinet?: string | string[] }>;
}) {
  const [user, params, t] = await Promise.all([
    getCurrentUser(),
    searchParams,
    getTranslations("scores"),
  ]);
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: cabinets } = await supabase
    .from("cabinets")
    .select("id, serial_number, name, location, country")
    .order("name")
    .limit(250);

  const rawChart = Array.isArray(params.chart) ? params.chart[0] : params.chart;
  const chartId = rawChart && /^\d+$/.test(rawChart) ? Number(rawChart) : 0;
  let initialSong: SongOption | null = null;
  let initialChartId = 0;

  if (Number.isSafeInteger(chartId) && chartId > 0) {
    const { data: chart } = await supabase
      .from("stepcharts")
      .select("id, song_id")
      .eq("id", chartId)
      .maybeSingle();

    if (chart) {
      const [{ data: song }, { data: charts }] = await Promise.all([
        supabase
          .from("songs")
          .select("id, title, composer, is_available")
          .eq("id", chart.song_id)
          .maybeSingle(),
        supabase
          .from("stepcharts")
          .select("id, step_type, level, is_available")
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
      <ScoreEntryForm
        initialSong={initialSong}
        initialChartId={initialChartId}
        cabinets={(cabinets ?? []) as CabinetOption[]}
        initialCabinetId={Number(Array.isArray(params.cabinet) ? params.cabinet[0] : params.cabinet) || null}
      />
    </div>
  );
}
