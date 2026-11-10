import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DashboardView, type DashboardScore, type MediaFilter } from "@/components/dashboard/dashboard-view";
import { getCurrentUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { levelKey, levelOptions, parseLevelFilter } from "@/lib/scores/level-filter";
import { chartOn, VERSION_LEVELS, type VersionLevel } from "@/lib/songs/chart-levels";
import { sanitizeSongSearchQuery } from "@/lib/songs/search";

const MY_SCORES_LIMIT = 50;

type LeveledChart = { step_type: "SINGLE" | "DOUBLE" | "HALFDOUBLE"; level: number; levels: VersionLevel[] };
type LevelRow = { id: number; series_id: number; screenshot_path: string | null; video_url: string | null; stepchart: LeveledChart | null };
type ListRow = { series_id: number; screenshot_path: string | null; stepchart: LeveledChart | null };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[]; level?: string | string[]; media?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/login");

  const supabase = await createClient();
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = typeof rawPage === "string" && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const query = sanitizeSongSearchQuery(params.q);
  const level = parseLevelFilter(Array.isArray(params.level) ? params.level[0] : params.level);
  const rawMedia = Array.isArray(params.media) ? params.media[0] : params.media;
  const media: MediaFilter = rawMedia === "video" || rawMedia === "screenshot" ? rawMedia : "";

  // Every score of the player, each chart at its level on the score's version.
  const { data: allRows } = await supabase
    .from("scores")
    .select(`id, series_id, screenshot_path, video_url, stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level, ${VERSION_LEVELS})`)
    .eq("user_id", user.id);
  const levelRows = ((allRows ?? []) as unknown as LevelRow[]).map((row) => ({
    ...row,
    stepchart: row.stepchart && chartOn(row.stepchart, row.series_id),
  }));

  // An inner join lets the song title filter the scores themselves.
  let countRequest = supabase
    .from("scores")
    .select("id, stepchart:stepcharts!scores_stepchart_id_fkey!inner(song:songs!stepcharts_song_id_fkey!inner(title))", { count: "exact", head: true })
    .eq("user_id", user.id);
  let listRequest = supabase
    .from("scores")
    .select(`id, score, grade, plate, played_at, screenshot_path, video_url, youtube_video_id, series_id, series:game_series(name), stepchart:stepcharts!scores_stepchart_id_fkey!inner(step_type, level, ${VERSION_LEVELS}, song:songs!stepcharts_song_id_fkey!inner(title, song_type, jacket_path))`)
    .eq("user_id", user.id);
  if (level) {
    // The level depends on the version each score was played on, so match by score.
    const ids = levelRows
      .filter((row) => row.stepchart?.step_type === level.stepType && row.stepchart.level === level.level)
      .map((row) => row.id);
    countRequest = countRequest.in("id", ids);
    listRequest = listRequest.in("id", ids);
  }
  if (query) {
    countRequest = countRequest.ilike("stepchart.song.title", `%${query}%`);
    listRequest = listRequest.ilike("stepchart.song.title", `%${query}%`);
  }
  // "video": a clip and a screenshot; "screenshot": a screenshot and no clip.
  if (media) {
    countRequest = countRequest.not("screenshot_path", "is", null);
    listRequest = listRequest.not("screenshot_path", "is", null);
  }
  if (media === "video") {
    countRequest = countRequest.not("video_url", "is", null).neq("video_url", "");
    listRequest = listRequest.not("video_url", "is", null).neq("video_url", "");
  } else if (media === "screenshot") {
    countRequest = countRequest.or("video_url.is.null,video_url.eq.");
    listRequest = listRequest.or("video_url.is.null,video_url.eq.");
  }

  const { count, error: countError } = await countRequest;
  // Totals over every saved score, counted the same way as the media filter.
  const mediaCounts = { video: 0, screenshot: 0 };
  for (const row of levelRows) {
    if (!row.screenshot_path) continue;
    if (row.video_url) mediaCounts.video += 1;
    else mediaCounts.screenshot += 1;
  }
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / MY_SCORES_LIMIT));
  const page = Math.min(Math.max(1, parsedPage), totalPages);
  const { data, error } = await listRequest
    .order("created_at", { ascending: false })
    .range((page - 1) * MY_SCORES_LIMIT, page * MY_SCORES_LIMIT - 1);

  // One request signs every screenshot on the page.
  const paths = (data ?? []).flatMap((score) => (score.screenshot_path ? [score.screenshot_path] : []));
  const { data: signed } = paths.length
    ? await supabase.storage.from("score-screenshots").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlByPath = new Map((signed ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])));
  const scores = ((data ?? []) as unknown as ListRow[]).map((score) => ({
    ...score,
    stepchart: score.stepchart && chartOn(score.stepchart, score.series_id),
    screenshotUrl: score.screenshot_path ? urlByPath.get(score.screenshot_path) ?? null : null,
  }));

  return <DashboardView
    scores={scores as unknown as DashboardScore[]}
    scoresFailed={Boolean(countError || error)}
    historyPage={page}
    historyPages={totalPages}
    query={query}
    level={level ? levelKey(level) : ""}
    media={media}
    mediaCounts={mediaCounts}
    levelOptions={levelOptions(levelRows)}
  />;
}
