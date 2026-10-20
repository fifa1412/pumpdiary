import type { SongType } from "@/components/songs/types";

// Remix, Full Song, and Shortcut versions share their title with the normal
// song, so they are always shown with a tag in front: "[Remix] BEMERA".
export const SONG_TYPE_TAGS: Record<SongType, string> = {
  NORMAL: "",
  REMIX: "[Remix]",
  FULLSONG: "[Full Song]",
  SHORTCUT: "[Shortcut]",
};

/** The catalog title without a trailing "- SHORT CUT -" or "- FULL SONG -", which the tag replaces. */
export function baseSongTitle(title: string, songType?: string | null): string {
  if (songType !== "SHORTCUT" && songType !== "FULLSONG") return title;
  return title.replace(/\s*-\s*(short\s*cut|full\s*song)\s*-\s*$/i, "").trim() || title;
}

/** A song's title as shown everywhere: "[Shortcut] Bemera", or the plain title for a normal song. */
export function songDisplayTitle(title: string, songType?: string | null): string {
  const tag = songType && songType in SONG_TYPE_TAGS ? SONG_TYPE_TAGS[songType as SongType] : "";
  const base = baseSongTitle(title, songType);
  return tag ? `${tag} ${base}` : base;
}
