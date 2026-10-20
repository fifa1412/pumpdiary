import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DashboardView, type DashboardScore, type MediaFilter } from "@/components/dashboard/dashboard-view";
import { getCurrentUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { levelKey, levelOptions, parseLevelFilter } from "@/lib/scores/level-filter";
import { sanitizeSongSearchQuery } from "@/lib/songs/search";

const MY_SCORES_LIMIT = 20;

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

  // Inner joins let the song title and chart level filter the scores themselves.
  let countRequest = supabase
    .from("scores")
    .select("id, stepchart:stepcharts!scores_stepchart_id_fkey!inner(step_type, level, song:songs!stepcharts_song_id_fkey!inner(title))", { count: "exact", head: true })
    .eq("user_id", user.id);
  let listRequest = supabase
    .from("scores")
    .select("id, score, grade, plate, played_at, screenshot_path, video_url, youtube_video_id, series:game_series(name), stepchart:stepcharts!scores_stepchart_id_fkey!inner(step_type, level, song:songs!stepcharts_song_id_fkey!inner(title, jacket_path))")
    .eq("user_id", user.id);
  if (level) {
    countRequest = countRequest.eq("stepchart.step_type", level.stepType).eq("stepchart.level", level.level);
    listRequest = listRequest.eq("stepchart.step_type", level.stepType).eq("stepchart.level", level.level);
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

  const [{ count, error: countError }, { data: levelRows }] = await Promise.all([
    countRequest,
    supabase
      .from("scores")
      .select("stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level)")
      .eq("user_id", user.id),
  ]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / MY_SCORES_LIMIT));
  const page = Math.min(Math.max(1, parsedPage), totalPages);
  const { data, error } = await listRequest
    .order("created_at", { ascending: false })
    .range((page - 1) * MY_SCORES_LIMIT, page * MY_SCORES_LIMIT - 1);

  const scores = await Promise.all((data ?? []).map(async (score) => {
    const { data: screenshot } = score.screenshot_path
      ? await supabase.storage.from("score-screenshots").createSignedUrl(score.screenshot_path, 3600)
      : { data: null };

    return {
      ...score,
      screenshotUrl: screenshot?.signedUrl ?? null,
    };
  }));

  return <DashboardView
    scores={scores as unknown as DashboardScore[]}
    scoresFailed={Boolean(countError || error)}
    historyPage={page}
    historyPages={totalPages}
    query={query}
    level={level ? levelKey(level) : ""}
    media={media}
    levelOptions={levelOptions(levelRows ?? [])}
  />;
}
