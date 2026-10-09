const VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/;

/** The video ID from a youtube.com/watch, youtu.be, or youtube.com/shorts URL, or null. */
export function youtubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = parsed.pathname.slice(1);
  else if (host === "youtube.com" && parsed.pathname === "/watch") id = parsed.searchParams.get("v");
  else if (host === "youtube.com" && parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.slice("/shorts/".length);
  return id && VIDEO_ID.test(id) ? id : null;
}
