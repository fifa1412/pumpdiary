import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { DeleteScoreButton } from "@/components/scores/delete-score-button";
import { ScreenshotZoom } from "@/components/scores/screenshot-zoom";
import { LevelRingBadge } from "@/components/songs/level-ring-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { scoreLabel } from "@/lib/scores/label";
import { jacketUrl } from "@/lib/songs/jackets";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { youtubeVideoId } from "@/lib/youtube/video-id";

type ScoreDetail = {
  id: number;
  user_id: string;
  score: number;
  grade: string;
  perfect: number;
  great: number;
  good: number;
  bad: number;
  miss: number;
  max_combo: number;
  played_at: string;
  video_url: string | null;
  youtube_video_id: string | null;
  note: string | null;
  plate: string | null;
  stage_pass: boolean;
  screenshot_path: string | null;
  cabinet: { name: string; location: string; model: string | null } | null;
  stepchart: {
    step_type: "SINGLE" | "DOUBLE" | "HALFDOUBLE";
    level: number;
    song: { title: string; composer: string; jacket_path: string | null } | null;
  } | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores.detail");
  return { title: t("title") };
}

export default async function ScoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: rawId }, user, t, tc, locale] = await Promise.all([
    params,
    getCurrentUser(),
    getTranslations("scores"),
    getTranslations("common"),
    getLocale(),
  ]);
  if (!user) redirect("/login");
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, user_id, score, grade, perfect, great, good, bad, miss, max_combo, played_at, video_url, youtube_video_id, note, plate, stage_pass, screenshot_path, cabinet:cabinets(name, location, model), stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level, song:songs!stepcharts_song_id_fkey(title, composer, jacket_path))")
    .eq("id", Number(rawId))
    .eq("user_id", user.id)
    .maybeSingle();
  const row = data as unknown as ScoreDetail | null;
  if (error || !row || row.user_id !== user.id) notFound();
  const chart = row.stepchart;
  const song = chart?.song;
  if (!chart || !song) notFound();

  const { data: screenshot } = row.screenshot_path
    ? await supabase.storage.from("score-screenshots").createSignedUrl(row.screenshot_path, 3600)
    : { data: null };
  const videoId = row.video_url ? youtubeVideoId(row.video_url) : null;
  const stepLabel = chart.step_type === "SINGLE" ? tc("stepTypes.single") : chart.step_type === "DOUBLE" ? tc("stepTypes.double") : tc("stepTypes.halfDouble");
  const playedDate = new Date(row.played_at).toLocaleDateString(locale, {
    timeZone: "UTC",
    year: "numeric", month: "long", day: "numeric",
  });
  const judgments = [
    ["fields.perfect", row.perfect], ["fields.great", row.great], ["fields.good", row.good],
    ["fields.bad", row.bad], ["fields.miss", row.miss], ["fields.maxCombo", row.max_combo],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link href="/dashboard"><ArrowLeft aria-hidden="true" />{t("detail.backToDashboard")}</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <DeleteScoreButton scoreId={row.id} screenshotPath={row.screenshot_path} youtubeVideoId={row.youtube_video_id} videoUrl={row.video_url}
            label={scoreLabel(song.title, chart, row.score)} />
          <Button asChild>
            <Link href={`/scores/${row.id}/edit`}><Wrench aria-hidden="true" />{t("detail.edit")}</Link>
          </Button>
        </div>
      </div>

      <Card className="py-4">
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
          <div className="flex items-center gap-4">
            {song.jacket_path ? (
              <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                <Image src={jacketUrl(song.jacket_path)} alt="" fill unoptimized sizes="80px" className="object-cover" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-bold leading-tight">{song.title}</h1>
              <p className="truncate text-xs text-muted-foreground">{song.composer}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4">
                <span className="font-display text-3xl font-bold text-accent">{row.grade}</span>
                <span className="font-numeric text-2xl font-semibold tabular-nums">{row.score.toLocaleString(locale)}</span>
                {row.plate || !row.stage_pass ? (
                  <span className="text-xs font-medium text-muted-foreground">{row.plate ?? t("detail.stageFailed")}</span>
                ) : null}
              </div>
            </div>
            <LevelRingBadge stepType={chart.step_type} level={chart.level} label={stepLabel} size={52} />
          </div>

          <div className="space-y-2">
            <section aria-labelledby="judgments-heading">
              <h2 id="judgments-heading" className="sr-only">{t("fields.judgments")}</h2>
              <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {judgments.map(([key, value]) => (
                  <div key={key} className="rounded-md border bg-surface-deep px-2 py-1.5">
                    <dt className="truncate text-xs text-muted-foreground">{t(key)}</dt>
                    <dd className="font-numeric text-base font-semibold tabular-nums">{value.toLocaleString(locale)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">{t("detail.playedAt")}</dt>
                <dd>{playedDate}</dd>
              </div>
              {row.cabinet ? (
                <div className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-muted-foreground">{t("detail.cabinet")}</dt>
                  <dd className="min-w-0">
                    {[row.cabinet.name, row.cabinet.model].filter(Boolean).join(" · ")}
                    <span className="text-muted-foreground"> ({row.cabinet.location})</span>
                  </dd>
                </div>
              ) : null}
              {row.note ? (
                <div className="flex w-full min-w-0 gap-2">
                  <dt className="shrink-0 text-muted-foreground">{t("detail.note")}</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words">{row.note}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </CardContent>
      </Card>

      {videoId || screenshot?.signedUrl ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {screenshot?.signedUrl ? (
            <section aria-labelledby="screenshot-heading" className="space-y-2">
              <h2 id="screenshot-heading" className="text-sm font-medium">{t("detail.screenshot")}</h2>
              {/* Same 16:9 frame as the video so the two sit at the same size. */}
              <ScreenshotZoom src={screenshot.signedUrl} alt={t("fields.screenshotPreview")} closeLabel={t("fields.closePreview")}
                imageClassName="aspect-video w-full rounded-md border bg-black object-contain" />
            </section>
          ) : null}
          {videoId ? (
            <section aria-labelledby="video-heading" className="space-y-2">
              <h2 id="video-heading" className="text-sm font-medium">{t("detail.video")}</h2>
              <div className="relative aspect-video overflow-hidden rounded-md border bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                  title={`${song.title} ${stepLabel} ${chart.level}`}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("detail.videoHint")}{" "}
                <a href={row.video_url ?? undefined} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                  {t("detail.openOnYouTube")}<ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
