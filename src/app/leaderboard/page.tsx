import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ChartBadges } from "@/components/songs/chart-badges";
import { LevelRingBadge } from "@/components/songs/level-ring-badge";
import type { SongChart } from "@/components/songs/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jacketUrl } from "@/lib/songs/jackets";
import { sanitizeSongSearchQuery } from "@/lib/songs/search";
import { createClient } from "@/lib/supabase/server";

const SEARCH_LIMIT = 30;
const PLAYED_LIMIT = 30;

type SearchSong = { id: number; title: string; composer: string; jacket_path: string | null; stepcharts: SongChart[] };
type PlayedChart = {
  id: number;
  step_type: SongChart["step_type"];
  level: number;
  song: { title: string; jacket_path: string | null } | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores.leaderboard.index");
  return { title: t("title") };
}

function Jacket({ path }: { path: string | null }) {
  return (
    <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
      {path ? <Image src={jacketUrl(path)} alt="" fill unoptimized sizes="64px" className="object-cover" /> : null}
    </div>
  );
}

export default async function LeaderboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [params, t, ts, tc, locale] = await Promise.all([
    searchParams, getTranslations("scores.leaderboard.index"), getTranslations("songs"), getTranslations("common"), getLocale(),
  ]);
  const query = sanitizeSongSearchQuery(params.q);
  const supabase = await createClient();
  const stepLabel = (stepType: SongChart["step_type"]) =>
    tc(stepType === "SINGLE" ? "stepTypes.single" : stepType === "DOUBLE" ? "stepTypes.double" : "stepTypes.halfDouble");

  let songs: SearchSong[] = [];
  let played: { chart: PlayedChart; players: number; top: number }[] = [];
  let failed = false;

  if (query) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, title, composer, jacket_path, stepcharts(id, step_type, level, is_available)")
      .or(`title.ilike.%${query}%,composer.ilike.%${query}%`)
      .order("title", { ascending: true })
      .limit(SEARCH_LIMIT);
    failed = Boolean(error);
    songs = (data ?? []) as unknown as SearchSong[];
  } else {
    // Charts that have scores, busiest first.
    const { data: bests, error } = await supabase.from("best_scores").select("stepchart_id, score");
    const byChart = new Map<number, { players: number; top: number }>();
    for (const row of bests ?? []) {
      const entry = byChart.get(row.stepchart_id) ?? { players: 0, top: 0 };
      entry.players += 1;
      entry.top = Math.max(entry.top, row.score);
      byChart.set(row.stepchart_id, entry);
    }
    const ids = [...byChart.entries()]
      .sort((a, b) => b[1].players - a[1].players || b[1].top - a[1].top)
      .slice(0, PLAYED_LIMIT)
      .map(([id]) => id);
    const { data: charts, error: chartError } = ids.length
      ? await supabase
        .from("stepcharts")
        .select("id, step_type, level, song:songs!stepcharts_song_id_fkey(title, jacket_path)")
        .in("id", ids)
      : { data: [], error: null };
    failed = Boolean(error || chartError);
    const chartById = new Map(((charts ?? []) as unknown as PlayedChart[]).map((chart) => [chart.id, chart]));
    played = ids.flatMap((id) => {
      const chart = chartById.get(id);
      const stats = byChart.get(id);
      return chart?.song && stats ? [{ chart, ...stats }] : [];
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("description")}</p>

      <form role="search" action="/leaderboard" className="mt-6 flex gap-2 lg:max-w-xl">
        <Label htmlFor="leaderboard-search" className="sr-only">{ts("search.label")}</Label>
        <Input id="leaderboard-search" type="search" name="q" defaultValue={query} placeholder={ts("search.placeholder")} autoComplete="off" />
        <Button type="submit" className="shrink-0">{ts("search.submit")}</Button>
        {query ? <Button variant="ghost" asChild><Link href="/leaderboard">{ts("search.clear")}</Link></Button> : null}
      </form>

      {failed ? (
        <p role="alert" className="mt-8 text-destructive">{tc("errors.generic")}</p>
      ) : query ? (
        songs.length === 0 ? (
          <p className="mt-8 text-muted-foreground">{ts("noResults", { query })}</p>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {songs.map((song) => (
              <li key={song.id}>
                <Card className="h-full py-4">
                  <CardContent className="flex items-start gap-4 px-4">
                    <Jacket path={song.jacket_path} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="truncate font-display font-semibold">{song.title}</p>
                        <p className="truncate text-sm text-muted-foreground">{song.composer}</p>
                      </div>
                      <ChartBadges charts={song.stepcharts} label={ts("chartsLabel")} linkTo="leaderboard" />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : (
        <section aria-labelledby="played-charts" className="mt-8 space-y-4">
          <h2 id="played-charts" className="font-display text-xl font-semibold">{t("played")}</h2>
          {played.length === 0 ? (
            <p className="text-muted-foreground">{t("noPlayed")}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {played.map(({ chart, players, top }) => (
                <li key={chart.id}>
                  <Link href={`/charts/${chart.id}/leaderboard`}
                    className="flex items-center gap-3 rounded-[3px] border bg-card p-3 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <Jacket path={chart.song?.jacket_path ?? null} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-semibold">{chart.song?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("players", { count: players })} · {t("top", { score: top.toLocaleString(locale) })}
                      </p>
                    </div>
                    <LevelRingBadge stepType={chart.step_type} level={chart.level} label={stepLabel(chart.step_type)} size={44} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
