"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutUser, type CurrentUser } from "@/lib/auth";
import { LevelRingBadge } from "@/components/songs/level-ring-badge";
import { ScreenshotLightbox } from "@/components/scores/screenshot-lightbox";
import { jacketUrl } from "@/lib/songs/jackets";

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
    song: { title: string; jacket_path: string | null } | null;
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
  const ts = useTranslations("scores");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [zoomedScreenshot, setZoomedScreenshot] = useState<{ scoreId: number; src: string } | null>(null);
  const zoomTrigger = useRef<HTMLButtonElement>(null);
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
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {scores.map((score) => {
              const chart = score.stepchart;
              if (!chart?.song) return null;
              const screenshotUrl = score.screenshotUrl;
              const playedDate = new Date(score.played_at).toLocaleDateString(locale, {
                timeZone: "UTC",
                year: "numeric", month: "short", day: "numeric",
              });
              return (
                <li key={score.id} className="h-full">
                  <Card className="group relative flex h-full min-h-0 flex-col gap-0 overflow-hidden p-0 transition-colors hover:border-primary/50">
                    <Link
                      href={`/scores/${score.id}/edit`}
                      aria-label={chart.song.title}
                      className="absolute inset-0 z-0 rounded-[3px] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="sr-only">{chart.song.title}</span>
                    </Link>
                    <div className="pointer-events-none relative z-10 flex h-full flex-col">
                      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted/60">
                        {screenshotUrl ? (
                          <button
                            ref={zoomTrigger}
                            type="button"
                            aria-label={ts("fields.screenshotPreview")}
                            aria-haspopup="dialog"
                            onClick={(event) => {
                              zoomTrigger.current = event.currentTarget;
                              setZoomedScreenshot({ scoreId: score.id, src: screenshotUrl });
                            }}
                            className="pointer-events-auto absolute inset-0 z-30 h-full w-full cursor-zoom-in rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70"
                          >
                            <Image
                              src={screenshotUrl}
                              alt=""
                              fill
                              unoptimized
                              sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
                              className="object-cover"
                            />
                          </button>
                        ) : null}
                        <LevelRingBadge
                          stepType={chart.step_type}
                          level={chart.level}
                          label={chart.step_type === "SINGLE" ? tc("stepTypes.single") : chart.step_type === "DOUBLE" ? tc("stepTypes.double") : tc("stepTypes.halfDouble")}
                          size={56}
                          className="pointer-events-none absolute right-1 top-1 z-30"
                        />
                        <CardTitle title={chart.song.title} className="absolute inset-x-0 bottom-0 z-30 truncate bg-background/90 px-3 py-2 text-sm font-semibold leading-tight">
                          {chart.song.title}
                        </CardTitle>
                      </div>
                      <CardContent className="mt-auto space-y-2 px-3 pb-3 pt-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-2xl font-bold text-accent">{score.grade}</span>
                          <span className="font-numeric text-lg font-semibold tabular-nums">{score.score.toLocaleString(locale)}</span>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="min-w-0 space-y-2">
                            {score.plate ? <p className="truncate text-xs font-medium text-muted-foreground">{score.plate}</p> : null}
                            <p className="text-sm text-muted-foreground">{playedDate}</p>
                          </div>
                          {chart.song.jacket_path ? (
                            <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                              <Image
                                src={jacketUrl(chart.song.jacket_path)}
                                alt=""
                                fill
                                unoptimized
                                sizes="64px"
                                className="object-cover"
                              />
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                  {zoomedScreenshot?.scoreId === score.id ? (
                    <ScreenshotLightbox
                      open
                      src={zoomedScreenshot.src}
                      alt={ts("fields.screenshotPreview")}
                      closeLabel={ts("fields.closePreview")}
                      onClose={() => setZoomedScreenshot(null)}
                      triggerRef={zoomTrigger}
                    />
                  ) : null}
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
