import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 24;

type PersonalBestRow = {
  id: number;
  stepchart_id: number;
  score: number;
  grade: string;
  plate: string | null;
  played_at: string;
};

type ChartDetails = {
  id: number;
  step_type: "SINGLE" | "DOUBLE" | "HALFDOUBLE";
  level: number;
  song: { title: string } | { title: string }[] | null;
};

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function chartPrefix(type: ChartDetails["step_type"]) {
  return type === "SINGLE" ? "S" : type === "DOUBLE" ? "D" : "HD";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores.personalBests");
  return { title: t("title") };
}

export default async function PersonalBestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [user, params, t, locale] = await Promise.all([
    getCurrentUser(), searchParams, getTranslations("scores.personalBests"), getLocale(),
  ]);
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("best_scores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const page = Math.min(parsePage(params.page), totalPages);
  const { data, error } = await supabase
    .from("best_scores")
    .select("id, stepchart_id, score, grade, plate, played_at")
    .eq("user_id", user.id)
    .order("score", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const scores = (data ?? []) as unknown as PersonalBestRow[];
  const chartIds = [...new Set(scores.map((score) => score.stepchart_id))];
  const { data: charts, error: chartError } = chartIds.length
    ? await supabase.from("stepcharts")
      .select("id, step_type, level, song:songs!stepcharts_song_id_fkey(title)")
      .in("id", chartIds)
    : { data: [], error: null };
  const chartById = new Map(((charts ?? []) as ChartDetails[]).map((chart) => [chart.id, chart]));
  const failed = Boolean(countError || error || chartError);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="outline" asChild><Link href="/dashboard">{t("backToDashboard")}</Link></Button>
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">{t("error")}</p>
      ) : scores.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">{t("empty")}</p></CardContent></Card>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scores.map((score) => {
              const chart = chartById.get(score.stepchart_id);
              const song = chart && (Array.isArray(chart.song) ? chart.song[0] : chart.song);
              if (!chart || !song) return null;
              const playedDate = new Date(score.played_at).toLocaleDateString(locale, {
                timeZone: "UTC", year: "numeric", month: "short", day: "numeric",
              });
              return (
                <li key={score.stepchart_id}>
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle title={song.title} className="line-clamp-2 font-display text-lg leading-tight">
                        {song.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{chartPrefix(chart.step_type)}{chart.level}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <Badge variant="secondary" className="font-numeric">{score.grade}</Badge>
                        <span className="font-display text-2xl font-bold tabular-nums text-accent">
                          {score.score.toLocaleString(locale)}
                        </span>
                      </div>
                      {score.plate ? <p className="truncate text-xs font-medium text-muted-foreground">{score.plate}</p> : null}
                      <p className="text-sm text-muted-foreground">{playedDate}</p>
                      <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/charts/${score.stepchart_id}/leaderboard`}>
                        {t("viewLeaderboard")}
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 ? (
            <nav aria-label={t("pagination.label")} className="mt-8 flex items-center justify-center gap-2">
              {page > 1 ? (
                <Button variant="outline" size="sm" asChild><Link href={`/scores/bests?page=${page - 1}`}>{t("pagination.previous")}</Link></Button>
              ) : <Button variant="outline" size="sm" disabled>{t("pagination.previous")}</Button>}
              <span className="font-numeric text-sm text-muted-foreground">{t("pagination.page", { page, total: totalPages })}</span>
              {page < totalPages ? (
                <Button variant="outline" size="sm" asChild><Link href={`/scores/bests?page=${page + 1}`}>{t("pagination.next")}</Link></Button>
              ) : <Button variant="outline" size="sm" disabled>{t("pagination.next")}</Button>}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
