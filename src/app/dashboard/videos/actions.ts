"use server";

import { revalidatePath } from "next/cache";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fetchVideoStats, VIDEOS_PER_CALL, youtubeApiKey, type VideoStats } from "@/lib/youtube/stats";
import { youtubeVideoId } from "@/lib/youtube/video-id";

export type SyncResult =
  | { ok: true; synced: number; missing: number }
  | { ok: false; error: "signedOut" | "noKey" | "failed" };

/** Reads the views, likes and comments of every clip on the player's scores from YouTube and saves them. */
export async function syncVideoStats(): Promise<SyncResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signedOut" };
  const key = youtubeApiKey();
  if (!key) return { ok: false, error: "noKey" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, video_url, youtube_video_id")
    .eq("user_id", user.id)
    .or("youtube_video_id.not.is.null,video_url.neq.");
  if (error) return { ok: false, error: "failed" };

  const scoreIdsByVideo = new Map<string, number[]>();
  for (const row of data ?? []) {
    const videoId = row.youtube_video_id || (row.video_url ? youtubeVideoId(row.video_url) : null);
    if (videoId) scoreIdsByVideo.set(videoId, [...(scoreIdsByVideo.get(videoId) ?? []), row.id]);
  }
  const videoIds = [...scoreIdsByVideo.keys()];

  const stats = new Map<string, VideoStats>();
  try {
    for (let start = 0; start < videoIds.length; start += VIDEOS_PER_CALL) {
      // Logged before the call, like the browser's calls: YouTube charges failed calls too.
      await supabase.from("youtube_api_calls").insert({ call: "videos.list" });
      const batch = await fetchVideoStats(videoIds.slice(start, start + VIDEOS_PER_CALL), key);
      batch.forEach((value, id) => stats.set(id, value));
    }
  } catch {
    return { ok: false, error: "failed" };
  }

  const syncedAt = new Date().toISOString();
  const updates = [...scoreIdsByVideo].flatMap(([videoId, scoreIds]) => {
    const found = stats.get(videoId);
    const row = {
      youtube_title: found?.title || null,
      youtube_published_at: found?.publishedAt ?? null,
      youtube_views: found?.views ?? null,
      youtube_likes: found?.likes ?? null,
      youtube_comments: found?.comments ?? null,
      youtube_synced_at: syncedAt,
    };
    return scoreIds.map((id) => ({ id, row }));
  });
  // A few updates at a time keeps the database connection pool calm.
  let failed = false;
  for (let start = 0; start < updates.length; start += 10) {
    const results = await Promise.all(updates.slice(start, start + 10).map(({ id, row }) =>
      supabase.from("scores").update(row).eq("id", id).eq("user_id", user.id)));
    failed ||= results.some((result) => result.error);
  }
  revalidatePath("/dashboard/videos");
  if (failed) return { ok: false, error: "failed" };
  return { ok: true, synced: stats.size, missing: videoIds.length - stats.size };
}
