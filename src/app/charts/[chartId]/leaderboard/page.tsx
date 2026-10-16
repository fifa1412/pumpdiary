import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import { VersionTabs } from "@/components/scores/version-tabs";
import { LevelRingBadge } from "@/components/songs/level-ring-badge";
import { fetchGameVersions, pickGameVersion } from "@/lib/scores/game-versions";
import { createClient } from "@/lib/supabase/server";

type BestScoreRow = {
  id: number;
  user_id: string;
  score: number;
  grade: string;
  plate: string | null;
  played_at: string;
};

type PlayerProfile = { id: string; player_name: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores.leaderboard");
  return { title: t("title") };
}

export default async function ChartLeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ chartId: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const [{ chartId: rawChartId }, search, t, locale, common] = await Promise.all([
    params, searchParams, getTranslations("scores.leaderboard"), getLocale(), getTranslations("common"),
  ]);
  if (!/^\d+$/.test(rawChartId) || !Number.isSafeInteger(Number(rawChartId)) || Number(rawChartId) < 1) notFound();
  const chartId = Number(rawChartId);
  const supabase = await createClient();
  const versions = await fetchGameVersions(supabase);
  const version = pickGameVersion(versions, search.version);
  if (!version) notFound();
  const [{ data: chart, error: chartError }, { data: rows, error: scoreError }] = await Promise.all([
    supabase.from("stepcharts").select("id, step_type, level, song_id").eq("id", chartId).maybeSingle(),
    supabase.from("best_scores")
      .select("id, user_id, score, grade, plate, played_at")
      .eq("stepchart_id", chartId)
      .eq("series_id", version.id)
      .order("score", { ascending: false })
      .order("played_at", { ascending: true })
      .limit(50),
  ]);
  if (chartError || !chart) notFound();

  const { data: song, error: songError } = await supabase
    .from("songs")
    .select("title")
    .eq("id", chart.song_id)
    .maybeSingle();
  if (songError || !song) notFound();

  const scores = (rows ?? []) as BestScoreRow[];
  const playerIds = [...new Set(scores.map((score) => score.user_id))];
  const { data: players, error: playerError } = playerIds.length
    ? await supabase.from("profiles").select("id, player_name").in("id", playerIds)
    : { data: [], error: null };
  const playerById = new Map(((players ?? []) as PlayerProfile[]).map((player) => [player.id, player.player_name]));
  const failed = Boolean(scoreError || playerError);
  // XX and Prime have no plates.
  const showPlate = version.rules === "phoenix";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{song.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <LevelRingBadge
          stepType={chart.step_type}
          level={chart.level}
          label={chart.step_type === "SINGLE" ? common("stepTypes.single") : chart.step_type === "DOUBLE" ? common("stepTypes.double") : common("stepTypes.halfDouble")}
          size={72}
        />
      </div>

      <div className="mb-6">
        <VersionTabs versions={versions} current={version} path={`/charts/${chartId}/leaderboard`} label={t("version")} />
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">{t("error")}</p>
      ) : scores.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">{t("empty")}</p></CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-[3px] border">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-surface-deep text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">{t("rank")}</th>
                <th scope="col" className="px-4 py-3">{t("player")}</th>
                <th scope="col" className="px-4 py-3">{t("score")}</th>
                <th scope="col" className="px-4 py-3">{t("grade")}</th>
                {showPlate ? <th scope="col" className="px-4 py-3">{t("plate")}</th> : null}
                <th scope="col" className="px-4 py-3">{t("date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scores.map((score, index) => (
                <tr key={score.id}>
                  <td className="px-4 py-3 font-numeric tabular-nums">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{playerById.get(score.user_id) || t("unknownPlayer")}</td>
                  <td className="px-4 py-3 font-numeric font-semibold tabular-nums">{score.score.toLocaleString(locale)}</td>
                  <td className="px-4 py-3">{score.grade}</td>
                  {showPlate ? <td className="px-4 py-3">{score.plate}</td> : null}
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(score.played_at).toLocaleDateString(locale, {
                      timeZone: "UTC", year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
