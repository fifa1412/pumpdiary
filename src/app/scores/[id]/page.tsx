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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link href="/dashboard"><ArrowLeft aria-hidden="true" />{t("personalBests.backToDashboard")}</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <DeleteScoreButton scoreId={row.id} screenshotPath={row.screenshot_path} youtubeVideoId={row.youtube_video_id}
            label={scoreLabel(song.title, chart, row.score)} />
          <Button asChild>
            <Link href={`/scores/${row.id}/edit`}><Wrench aria-hidden="true" />{t("detail.edit")}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            {song.jacket_path ? (
              <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                <Image src={jacketUrl(song.jacket_path)} alt="" fill unoptimized sizes="96px" className="object-cover" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold leading-tight">{song.title}</h1>
              <p className="truncate text-sm text-muted-foreground">{song.composer}</p>
            </div>
            <LevelRingBadge stepType={chart.step_type} level={chart.level} label={stepLabel} size={56} />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-4xl font-bold text-accent">{row.grade}</span>
              <span className="font-numeric text-3xl font-semibold tabular-nums">{row.score.toLocaleString(locale)}</span>
            </div>
            {row.plate || !row.stage_pass ? (
              <p className="text-sm font-medium text-muted-foreground">{row.plate ?? t("detail.stageFailed")}</p>
            ) : null}

            <section aria-labelledby="judgments-heading" className="space-y-3">
              <h2 id="judgments-heading" className="text-sm font-medium">{t("fields.judgments")}</h2>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {judgments.map(([key, value]) => (
                  <div key={key} className="rounded-md border bg-surface-deep px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{t(key)}</dt>
                    <dd className="font-numeric text-lg font-semibold tabular-nums">{value.toLocaleString(locale)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t("detail.playedAt")}</dt>
                <dd>{playedDate}</dd>
              </div>
              {row.cabinet ? (
                <div>
                  <dt className="text-xs text-muted-foreground">{t("detail.cabinet")}</dt>
                  <dd>{[row.cabinet.name, row.cabinet.model].filter(Boolean).join(" · ")}<span className="block text-sm text-muted-foreground">{row.cabinet.location}</span></dd>
                </div>
              ) : null}
              {row.note ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t("detail.note")}</dt>
                  <dd className="whitespace-pre-wrap break-words">{row.note}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {videoId || screenshot?.signedUrl ? (
          <div className="space-y-6 lg:sticky lg:top-20">
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
            {screenshot?.signedUrl ? (
              <ScreenshotZoom src={screenshot.signedUrl} alt={t("fields.screenshotPreview")} closeLabel={t("fields.closePreview")} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
