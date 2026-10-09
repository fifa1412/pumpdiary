import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ScoreEntryForm, type EditableScore } from "@/components/scores/score-entry-form";
import type { CabinetOption } from "@/components/cabinets/types";
import type { SongOption } from "@/components/scores/types";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores");
  return { title: t.has("editTitle") ? t("editTitle") : t("pageTitle") };
}

export default async function EditScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id: rawId }, user, t] = await Promise.all([
    params,
    getCurrentUser(),
    getTranslations("scores"),
  ]);
  if (!user) redirect("/login");
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) notFound();

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("scores")
    .select("id, user_id, stepchart_id, score, grade, perfect, great, good, bad, miss, max_combo, played_at, video_url, note, plate, stage_pass, screenshot_path, cabinet_id, cabinet:cabinets(id, serial_number, name, location, country, model), stepchart:stepcharts!scores_stepchart_id_fkey(id, song_id)")
    .eq("id", Number(rawId))
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !row || row.user_id !== user.id) notFound();

  const chart = Array.isArray(row.stepchart) ? row.stepchart[0] : row.stepchart;
  const cabinet = (Array.isArray(row.cabinet) ? row.cabinet[0] : row.cabinet) as CabinetOption | null | undefined;
  if (!chart) notFound();
  const [{ data: song }, { data: charts }, screenshotResult] = await Promise.all([
    supabase.from("songs").select("id, title, composer, is_available").eq("id", chart.song_id).maybeSingle(),
    supabase.from("stepcharts").select("id, step_type, level, is_available").eq("song_id", chart.song_id),
    row.screenshot_path
      ? supabase.storage.from("score-screenshots").createSignedUrl(row.screenshot_path, 3600)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (!song) notFound();

  const initialSong: SongOption = {
    ...song,
    stepcharts: charts ?? [],
  };
  const initialScore: EditableScore = {
    id: row.id,
    stepchartId: row.stepchart_id,
    score: row.score,
    grade: row.grade as EditableScore["grade"],
    perfect: row.perfect,
    great: row.great,
    good: row.good,
    bad: row.bad,
    miss: row.miss,
    maxCombo: row.max_combo,
    playedAt: row.played_at.slice(0, 10),
    videoUrl: row.video_url ?? "",
    note: row.note ?? "",
    plate: (row.plate ?? "") as EditableScore["plate"],
    stagePass: row.stage_pass,
    screenshotPath: row.screenshot_path,
    screenshotUrl: screenshotResult.data?.signedUrl ?? null,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="mb-6 w-full max-w-2xl lg:max-w-none">
        <h1 className="font-display text-3xl font-bold">{t.has("editTitle") ? t("editTitle") : t("pageTitle")}</h1>
      </div>
      <ScoreEntryForm
        initialSong={initialSong}
        initialChartId={row.stepchart_id}
        initialScore={initialScore}
        cabinets={cabinet ? [cabinet] : []}
        initialCabinetId={cabinet ? row.cabinet_id : null}
      />
    </div>
  );
}
