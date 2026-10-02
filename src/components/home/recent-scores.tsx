import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const RECENT_SCORE_LIMIT = 6;
type StepType = "SINGLE" | "DOUBLE" | "HALFDOUBLE";

type RecentScore = {
  id: number;
  score: number;
  grade: string;
  plate: string | null;
  profile: { player_name: string } | null;
  stepchart: {
    step_type: StepType;
    level: number;
    song: { title: string } | null;
  } | null;
};

function chartLabel(stepType: StepType, level: number): string {
  const prefix = stepType === "SINGLE" ? "S" : stepType === "DOUBLE" ? "D" : "HD";
  return `${prefix}${level}`;
}

export async function RecentScores() {
  const [t, common, locale, supabase] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getLocale(),
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("scores")
    .select("id, score, grade, plate, profile:profiles!scores_user_id_fkey(player_name), stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level, song:songs!stepcharts_song_id_fkey(title))")
    .order("created_at", { ascending: false })
    .limit(RECENT_SCORE_LIMIT);

  const scores = (data ?? []) as unknown as RecentScore[];

  return (
    <section aria-labelledby="recent-scores-heading">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 id="recent-scores-heading" className="font-display text-3xl font-bold text-balance sm:text-4xl">
          {t("recentScores.title")}
        </h2>
        {error ? (
          <p className="mt-6 text-sm text-destructive">{common("errors.generic")}</p>
        ) : scores.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border px-5 py-8 text-center text-muted-foreground">
            {t("recentScores.empty")}
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scores.map((score) => {
              const chart = score.stepchart;
              const title = chart?.song?.title;
              if (!chart || !title) return null;

              return (
                <li key={score.id}>
                  <Card className="h-full border-t-[3px] border-t-primary">
                    <CardHeader>
                      <CardTitle className="font-display text-xl leading-tight">
                        {title}
                      </CardTitle>
                      <CardDescription>{score.profile?.player_name ?? ""}</CardDescription>
                      <CardAction>
                        <Badge variant="outline" className="font-display">
                        {chartLabel(chart.step_type, chart.level)}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between gap-4">
                      <span className="font-display text-3xl font-bold leading-none text-accent">
                        {score.grade}
                      </span>
                      <span className="font-numeric text-2xl font-semibold leading-none tabular-nums">
                        {score.score.toLocaleString(locale)}
                      </span>
                    </CardContent>
                    {score.plate ? (
                      <div className="px-6 pb-5">
                        <Badge>{score.plate}</Badge>
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
