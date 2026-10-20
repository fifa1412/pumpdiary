import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LevelSelect } from "@/components/overview/level-select";
import { GradeBadge } from "@/components/scores/grade-badge";
import { VersionTabs, versionHref } from "@/components/scores/version-tabs";
import { Button } from "@/components/ui/button";
import { DEFAULT_GAME_VERSION, fetchGameVersions, pickGameVersion } from "@/lib/scores/game-versions";
import { levelKey, parseLevelFilter, type LevelFilter } from "@/lib/scores/level-filter";
import { jacketUrl } from "@/lib/songs/jackets";
import { songDisplayTitle } from "@/lib/songs/song-title";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Highest level each step type has in the catalog.
const MAX_LEVEL = { SINGLE: 26, DOUBLE: 29 } as const;
const LEVELS: LevelFilter[] = (["SINGLE", "DOUBLE"] as const).flatMap((stepType) =>
  Array.from({ length: MAX_LEVEL[stepType] }, (_, index) => ({ stepType, level: index + 1 })));
const FALLBACK_LEVEL: LevelFilter = { stepType: "SINGLE", level: 20 };

type OverviewChart = {
  id: number;
  is_available: boolean;
  song: { title: string; song_type: string; jacket_path: string | null; is_available: boolean } | null;
};
type BestScore = { id: number; stepchart_id: number; score: number; grade: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("overview");
  return { title: t("title") };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string | string[]; version?: string | string[] }>;
}) {
  const [user, params, t, tc] = await Promise.all([
    getCurrentUser(), searchParams, getTranslations("overview"), getTranslations("common"),
  ]);
  if (!user) redirect("/login");

  const supabase = await createClient();
  const versions = await fetchGameVersions(supabase);
  const version = pickGameVersion(versions, params.version);
  if (!version) notFound();

  // Without a level in the URL, open the level of the player's latest score.
  let level = parseLevelFilter(Array.isArray(params.level) ? params.level[0] : params.level);
  if (!level || !LEVELS.some((option) => levelKey(option) === levelKey(level!))) {
    const { data: latest } = await supabase
      .from("scores")
      .select("stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const chart = latest?.stepchart as unknown as { step_type: LevelFilter["stepType"]; level: number } | null;
    const fromLatest = chart ? { stepType: chart.step_type, level: chart.level } : null;
    level = fromLatest && LEVELS.some((option) => levelKey(option) === levelKey(fromLatest)) ? fromLatest : FALLBACK_LEVEL;
  }
  const currentKey = levelKey(level);
  const index = LEVELS.findIndex((option) => levelKey(option) === currentKey);
  const previous = LEVELS[index - 1];
  const next = LEVELS[index + 1];

  const { data: chartRows, error: chartError } = await supabase
    .from("stepcharts")
    .select("id, is_available, song:songs!stepcharts_song_id_fkey(title, song_type, jacket_path, is_available)")
    .eq("step_type", level.stepType)
    .eq("level", level.level);
  const charts = ((chartRows ?? []) as unknown as OverviewChart[]).filter((chart) => chart.is_available && chart.song?.is_available);
  const { data: bestRows, error: bestError } = charts.length
    ? await supabase
      .from("best_scores")
      .select("id, stepchart_id, score, grade")
      .eq("user_id", user.id)
      .eq("series_id", version.id)
      .in("stepchart_id", charts.map((chart) => chart.id))
    : { data: [], error: null };
  const bestByChart = new Map(((bestRows ?? []) as BestScore[]).map((best) => [best.stepchart_id, best]));

  // Logged charts first, best score first; the rest by title.
  const tiles = charts
    .map((chart) => ({ chart, title: songDisplayTitle(chart.song!.title, chart.song!.song_type), best: bestByChart.get(chart.id) }))
    .sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1) || a.title.localeCompare(b.title));
  const logged = tiles.filter((tile) => tile.best).length;

  const stepLabel = (stepType: LevelFilter["stepType"]) =>
    tc(stepType === "SINGLE" ? "stepTypes.single" : stepType === "DOUBLE" ? "stepTypes.double" : "stepTypes.halfDouble");
  const levelHref = (option: LevelFilter) => versionHref(`/overview?level=${levelKey(option)}`, version);
  const options = (["SINGLE", "DOUBLE"] as const).map((stepType) => ({
    stepLabel: stepLabel(stepType),
    keys: LEVELS.filter((option) => option.stepType === stepType)
      .map((option) => ({ key: levelKey(option), label: `${stepLabel(stepType)} ${option.level}` })),
  }));
  // The score as a percentage, as the game shows it; XX and Prime scores have no cap.
  const percent = (score: number) => version.rules === "phoenix" ? (Math.floor(score / 1000) / 10).toFixed(1) : null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-10 sm:py-12">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <VersionTabs versions={versions} current={version} path={`/overview?level=${currentKey}`} label={t("version")} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild={Boolean(previous)} disabled={!previous} aria-label={t("previous")}>
          {previous ? <Link href={levelHref(previous)}><ChevronLeft aria-hidden="true" /></Link> : <ChevronLeft aria-hidden="true" />}
        </Button>
        <LevelSelect key={currentKey} level={currentKey} options={options}
          versionId={version.name === DEFAULT_GAME_VERSION ? undefined : version.id} />
        <Button variant="outline" size="icon" asChild={Boolean(next)} disabled={!next} aria-label={t("next")}>
          {next ? <Link href={levelHref(next)}><ChevronRight aria-hidden="true" /></Link> : <ChevronRight aria-hidden="true" />}
        </Button>
        {tiles.length ? (
          <p className="ml-auto text-sm text-muted-foreground">{t("progress", { logged, total: tiles.length })}</p>
        ) : null}
      </div>

      {chartError || bestError ? (
        <p role="alert" className="text-sm text-destructive">{tc("errors.generic")}</p>
      ) : tiles.length === 0 ? (
        <p className="text-muted-foreground">{t("noCharts")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {tiles.map(({ chart, title, best }) => {
            const label = best
              ? t("loggedLabel", { title, grade: best.grade, score: best.score.toLocaleString("en-US") })
              : t("notLoggedLabel", { title });
            const shown = best ? percent(best.score) : null;
            return (
              <li key={chart.id} className="bg-background">
                <Link
                  href={best ? `/scores/${best.id}` : `/scores/new?chart=${chart.id}`}
                  aria-label={label}
                  title={label}
                  className="group relative block aspect-[4/3] overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {chart.song?.jacket_path ? (
                    <Image src={jacketUrl(chart.song.jacket_path)} alt="" fill unoptimized sizes="(min-width: 1024px) 12vw, (min-width: 640px) 20vw, 33vw"
                      className={cn("object-cover transition", best ? "brightness-[0.55]" : "opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0")} />
                  ) : (
                    <span className={cn("absolute inset-0 flex items-center justify-center p-1 text-center text-[11px] font-semibold leading-tight", best ? "" : "text-muted-foreground")}>
                      {title}
                    </span>
                  )}
                  {best ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <GradeBadge grade={best.grade} version={version.name} imageClassName="h-1/2 max-w-[85%] drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
                        className="font-display text-2xl font-bold text-accent drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]" />
                    </span>
                  ) : null}
                  {shown ? (
                    <span className="absolute right-1 top-0.5 font-numeric text-xs font-semibold text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      {shown}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
