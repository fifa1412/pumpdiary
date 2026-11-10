import "server-only";

const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
/** videos.list takes up to 50 ids per call, for 1 quota unit. */
export const VIDEOS_PER_CALL = 50;

export type VideoStats = {
  title: string;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
};

type VideosResponse = {
  items?: {
    id: string;
    snippet?: { title?: string; publishedAt?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }[];
};

function count(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** The server's YouTube Data API key, or null when it isn't set. */
export function youtubeApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

/**
 * Public title and counts of up to 50 videos. Videos YouTube doesn't return
 * (deleted, private) are missing from the map. Likes and comments are null
 * when the owner hides them.
 */
export async function fetchVideoStats(ids: string[], key: string): Promise<Map<string, VideoStats>> {
  const url = new URL(VIDEOS_URL);
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("maxResults", String(VIDEOS_PER_CALL));
  url.searchParams.set("key", key);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`videos.list failed: ${response.status}`);
  const body = (await response.json()) as VideosResponse;
  return new Map((body.items ?? []).map((item) => [item.id, {
    title: item.snippet?.title ?? "",
    publishedAt: item.snippet?.publishedAt ?? null,
    views: count(item.statistics?.viewCount),
    likes: count(item.statistics?.likeCount),
    comments: count(item.statistics?.commentCount),
  }]));
}
