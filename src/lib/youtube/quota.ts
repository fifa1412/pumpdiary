import { createClient } from "@/lib/supabase/client";

// YouTube offers no way to read the remaining quota, so the site logs each
// call it makes (youtube_api_calls) and works the rest out from YouTube's
// published limits. The quota belongs to the site's Google Cloud project and
// is shared by every player.

export type YouTubeCall =
  | "videos.insert"
  | "thumbnails.set"
  | "playlists.list"
  | "playlists.insert"
  | "playlistItems.insert"
  | "videos.delete";

/** Uploads a project may make a day; they have their own limit outside the units. */
export const DAILY_UPLOAD_LIMIT = 100;
/** Units a project may spend a day on every other call. */
export const DAILY_UNIT_LIMIT = 10_000;
// Units one upload usually spends besides the upload: finding its playlist
// (1), adding the video to it (50) and setting a thumbnail (50).
const UNITS_PER_UPLOAD = 101;

/** Logs a call before it is made, since YouTube charges for failed calls too. Never throws. */
export function recordYouTubeCall(call: YouTubeCall): void {
  void Promise.resolve(createClient().from("youtube_api_calls").insert({ call })).catch(() => undefined);
}

export type YouTubeQuota = {
  uploads: number;
  units: number;
  resetsAt: Date;
  /** Estimated uploads left today: whichever limit runs out first. */
  clipsLeft: number;
};

export async function fetchYouTubeQuota(): Promise<YouTubeQuota> {
  const { data, error } = await createClient().rpc("youtube_quota_usage");
  const row = (Array.isArray(data) ? data[0] : null) as { uploads: number | string; units: number | string; resets_at: string } | null;
  if (error || !row) throw new Error("quota-unavailable");
  const uploads = Number(row.uploads);
  const units = Number(row.units);
  const clipsLeft = Math.max(0, Math.min(DAILY_UPLOAD_LIMIT - uploads, Math.floor((DAILY_UNIT_LIMIT - units) / UNITS_PER_UPLOAD)));
  return { uploads, units, resetsAt: new Date(row.resets_at), clipsLeft };
}
