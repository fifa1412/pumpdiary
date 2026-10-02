"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutUser, type CurrentUser } from "@/lib/auth";

export type DashboardScore = {
  id: number;
  score: number;
  grade: string;
  plate: string | null;
  played_at: string;
  screenshotUrl: string | null;
  stepchart: {
    step_type: "SINGLE" | "DOUBLE" | "HALFDOUBLE";
    level: number;
    song: { title: string } | null;
  } | null;
};

export function DashboardView({ user, scores, scoresFailed = false, historyPage, historyPages }: {
  user: CurrentUser;
  scores: DashboardScore[];
  scoresFailed?: boolean;
  historyPage: number;
  historyPages: number;
}) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const locale = useLocale();
  const myScoresLabel = t.has("myScores") ? t("myScores") : t("title");
  const noScoresLabel = t.has("noScores") ? t("noScores") : t("emptyTitle");

  async function handleLogout() {
    try {
      await logoutUser();
      router.replace("/");
    } catch {
      toast.error(tc("errors.generic"));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:py-12">
      <h1 className="text-center font-display text-3xl font-bold">
        {t("greeting", { name: user.name })}
      </h1>
      <section aria-labelledby="my-scores-heading" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="my-scores-heading" className="font-display text-2xl font-bold">{myScoresLabel}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link href="/scores/bests">{t("personalBests")}</Link></Button>
            <Button asChild><Link href="/scores/new">{t("addScore")}</Link></Button>
          </div>
        </div>
        {scoresFailed ? (
          <p role="alert" className="text-sm text-destructive">{tc("errors.generic")}</p>
        ) : scores.length === 0 ? (
          <Card>
            <CardHeader><CardTitle className="font-display text-xl">{t("emptyTitle")}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-muted-foreground">{noScoresLabel}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {scores.map((score) => {
              const chart = score.stepchart;
              if (!chart?.song) return null;
              const chartPrefix = chart.step_type === "SINGLE" ? "S" : chart.step_type === "DOUBLE" ? "D" : "HD";
              const playedDate = new Date(score.played_at).toLocaleDateString(locale, {
                timeZone: "UTC",
                year: "numeric", month: "short", day: "numeric",
              });
              return (
                <li key={score.id} className="h-full">
                  <Link href={`/scores/${score.id}/edit`} className="group block h-full rounded-[3px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <Card className="flex h-full min-h-56 flex-col transition-colors group-hover:border-primary/50 group-focus-visible:border-primary">
                      <CardHeader className="pb-3">
                        <CardTitle title={chart.song.title} className="line-clamp-2 min-h-12 font-display text-lg leading-tight">{chart.song.title}</CardTitle>
                        <div className="relative aspect-video overflow-hidden rounded-sm bg-muted/60">
                          {score.screenshotUrl ? (
                            <Image
                              src={score.screenshotUrl}
                              alt=""
                              fill
                              unoptimized
                              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                              className="object-cover"
                            />
                          ) : null}
                          <span className="absolute right-2 top-2 rounded-sm bg-background/90 px-2 py-1 text-xs font-semibold text-foreground shadow-sm">
                            {chartPrefix}{chart.level}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="mt-auto space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-2xl font-bold text-accent">{score.grade}</span>
                          <span className="font-numeric text-lg font-semibold tabular-nums">{score.score.toLocaleString(locale)}</span>
                        </div>
                        {score.plate ? <p className="truncate text-xs font-medium text-muted-foreground">{score.plate}</p> : null}
                        <p className="text-sm text-muted-foreground">{playedDate}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!scoresFailed && historyPages > 1 ? (
          <nav aria-label={t("pagination.label")} className="flex items-center justify-center gap-2">
            {historyPage > 1 ? (
              <Button variant="outline" size="sm" asChild><Link href={`/dashboard?page=${historyPage - 1}`}>{t("pagination.previous")}</Link></Button>
            ) : <Button variant="outline" size="sm" disabled>{t("pagination.previous")}</Button>}
            <span className="font-numeric text-sm text-muted-foreground">
              {t("pagination.page", { page: historyPage, total: historyPages })}
            </span>
            {historyPage < historyPages ? (
              <Button variant="outline" size="sm" asChild><Link href={`/dashboard?page=${historyPage + 1}`}>{t("pagination.next")}</Link></Button>
            ) : <Button variant="outline" size="sm" disabled>{t("pagination.next")}</Button>}
          </nav>
        ) : null}
      </section>
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleLogout}>{tc("nav.logout")}</Button>
      </div>
    </div>
  );
}
