"use client";

import { Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutUser } from "@/lib/auth";
import { LevelRingBadge } from "@/components/songs/level-ring-badge";
import { DeleteScoreButton } from "@/components/scores/delete-score-button";
import { GradeBadge } from "@/components/scores/grade-badge";
import { ScreenshotLightbox } from "@/components/scores/screenshot-lightbox";
import { gameVersionLabel, gameVersionTone } from "@/lib/scores/game-versions";
import { scoreLabel } from "@/lib/scores/label";
import { versionBannerUrl } from "@/lib/scores/version-banners";
import { levelKey, type LevelFilter } from "@/lib/scores/level-filter";
import { jacketUrl } from "@/lib/songs/jackets";
import { songDisplayTitle } from "@/lib/songs/song-title";

/** Which scores to list by what they have: all, a clip and a screenshot, or a screenshot only. */
export type MediaFilter = "" | "video" | "screenshot";

export type DashboardScore = {
  id: number;
  score: number;
  grade: string;
  plate: string | null;
  played_at: string;
  screenshot_path: string | null;
  youtube_video_id: string | null;
  video_url: string | null;
  screenshotUrl: string | null;
  series: { name: string } | null;
  stepchart: {
    step_type: "SINGLE" | "DOUBLE" | "HALFDOUBLE";
    level: number;
    song: { title: string; song_type: string; jacket_path: string | null } | null;
  } | null;
};

export function DashboardView({
  scores, scoresFailed = false, historyPage, historyPages, query = "", level = "", levelOptions = [], media = "",
}: {
  scores: DashboardScore[];
  scoresFailed?: boolean;
  historyPage: number;
  historyPages: number;
  query?: string;
  /** Active level filter such as "S20"; empty for all levels. */
  level?: string;
  levelOptions?: LevelFilter[];
  media?: MediaFilter;
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
  const filtered = Boolean(query || level || media);
  const stepLabel = (stepType: LevelFilter["stepType"]) =>
    tc(stepType === "SINGLE" ? "stepTypes.single" : stepType === "DOUBLE" ? "stepTypes.double" : "stepTypes.halfDouble");

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (level) params.set("level", level);
    if (media) params.set("media", media);
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `/dashboard?${search}` : "/dashboard";
  }

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
      <section aria-labelledby="my-scores-heading" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="my-scores-heading" className="font-display text-2xl font-bold">{myScoresLabel}</h1>
          <Button asChild><Link href="/scores/new">{t("addScore")}</Link></Button>
        </div>
        <form role="search" action="/dashboard" className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="dashboard-search" className="sr-only">{t("filters.searchLabel")}</Label>
          <Input id="dashboard-search" type="search" name="q" defaultValue={query} placeholder={t("filters.searchPlaceholder")}
            autoComplete="off" className="sm:max-w-xs" />
          <Label htmlFor="dashboard-level" className="sr-only">{t("filters.level")}</Label>
          <select id="dashboard-level" name="level" defaultValue={level}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-48">
            <option value="">{t("filters.allLevels")}</option>
            {(["SINGLE", "DOUBLE", "HALFDOUBLE"] as const).map((stepType) => {
              const options = levelOptions.filter((option) => option.stepType === stepType);
              return options.length ? (
                <optgroup key={stepType} label={stepLabel(stepType)}>
                  {options.map((option) => (
                    <option key={levelKey(option)} value={levelKey(option)}>{`${stepLabel(stepType)} ${option.level}`}</option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <Label htmlFor="dashboard-media" className="sr-only">{t("filters.media")}</Label>
          <select id="dashboard-media" name="media" defaultValue={media}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-48">
            <option value="">{t("filters.mediaAll")}</option>
            <option value="video">{t("filters.mediaVideo")}</option>
            <option value="screenshot">{t("filters.mediaScreenshot")}</option>
          </select>
          <div className="flex gap-2 sm:ml-auto">
            <Button type="submit" size="sm" variant="outline">{t("filters.submit")}</Button>
            {filtered ? <Button size="sm" variant="ghost" asChild><Link href="/dashboard">{t("filters.clear")}</Link></Button> : null}
          </div>
        </form>
        {scoresFailed ? (
          <p role="alert" className="text-sm text-destructive">{tc("errors.generic")}</p>
        ) : scores.length === 0 && filtered ? (
          <p className="text-muted-foreground">{t("filters.noMatches")}</p>
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
              const songTitle = songDisplayTitle(chart.song.title, chart.song.song_type);
              const screenshotUrl = score.screenshotUrl;
              const playedDate = new Date(score.played_at).toLocaleDateString(locale, {
                timeZone: "UTC",
                year: "numeric", month: "short", day: "numeric",
              });
              return (
                <li key={score.id} className="h-full">
                  <Card className="group relative flex h-full min-h-0 flex-col gap-0 overflow-hidden p-0 transition-colors hover:border-primary/50">
                    <Link
                      href={`/scores/${score.id}`}
                      aria-label={songTitle}
                      className="absolute inset-0 z-0 rounded-[3px] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="sr-only">{songTitle}</span>
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
                          version={score.series?.name}
                          size={56}
                          className="pointer-events-none absolute right-1 top-1 z-30"
                        />
                        <CardTitle title={songTitle} className="absolute inset-x-0 bottom-0 z-30 truncate bg-background/90 px-3 py-2 text-sm font-semibold leading-tight">
                          {songTitle}
                        </CardTitle>
                      </div>
                      <CardContent className="mt-auto space-y-2 px-3 pb-3 pt-3">
                        <div className="flex h-10 items-center justify-between gap-2">
                          <GradeBadge grade={score.grade} version={score.series?.name} imageClassName="h-8"
                            className="font-display text-2xl font-bold text-accent" />
                          {score.series ? <VersionBanner version={score.series.name} /> : null}
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="min-w-0 space-y-2">
                            {score.plate ? <p className="truncate text-xs font-medium text-muted-foreground">{score.plate}</p> : null}
                            <p className="font-numeric text-lg font-semibold leading-none tabular-nums">{score.score.toLocaleString(locale)}</p>
                            <p className="text-sm text-muted-foreground">{playedDate}</p>
                          </div>
                          <div className="flex shrink-0 items-end gap-1.5">
                            {chart.song.jacket_path ? (
                              <div className="relative aspect-[4/3] w-14 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                                <Image
                                  src={jacketUrl(chart.song.jacket_path)}
                                  alt=""
                                  fill
                                  unoptimized
                                  sizes="56px"
                                  className="object-cover"
                                />
                              </div>
                            ) : null}
                            <div className="flex flex-col gap-1">
                              <Button variant="outline" size="icon" asChild className="pointer-events-auto relative z-30 size-7">
                                <Link href={`/scores/${score.id}/edit`} aria-label={ts("editTitle")} title={ts("editTitle")}>
                                  <Wrench aria-hidden="true" />
                                </Link>
                              </Button>
                              <DeleteScoreButton
                                compact
                                scoreId={score.id}
                                screenshotPath={score.screenshot_path}
                                youtubeVideoId={score.youtube_video_id}
                                videoUrl={score.video_url}
                                label={scoreLabel(songTitle, chart, score.score)}
                                className="pointer-events-auto relative z-30 size-7"
                              />
                            </div>
                          </div>
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
              <Button variant="outline" size="sm" asChild><Link href={pageHref(historyPage - 1)}>{t("pagination.previous")}</Link></Button>
            ) : <Button variant="outline" size="sm" disabled>{t("pagination.previous")}</Button>}
            <span className="font-numeric text-sm text-muted-foreground">
              {t("pagination.page", { page: historyPage, total: historyPages })}
            </span>
            {historyPage < historyPages ? (
              <Button variant="outline" size="sm" asChild><Link href={pageHref(historyPage + 1)}>{t("pagination.next")}</Link></Button>
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

// The version's title banner, or its name in the version colour when it has none.
function VersionBanner({ version }: { version: string }) {
  const url = versionBannerUrl(version);
  const label = gameVersionLabel(version);
  if (!url) return <span className={`truncate text-xs font-medium ${gameVersionTone(version).text}`}>{label}</span>;
  // The banners differ in shape, so a plain img keeps each one's own aspect ratio.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={label} title={label} className="h-10 w-auto min-w-0 max-w-[60%] object-contain object-right" />;
}
