const VERSION_BANNER_BUCKET = "version-banners";

// Game versions with a title banner (the game logo), in <folder>.webp
// (uploaded by scripts/import-version-banners/upload_version_banner.mjs).
const VERSION_BANNERS: Record<string, string> = {
  "Phoenix 2": "phoenix2",
  Phoenix: "phoenix",
};

/** Public URL of a game version's title banner (game_series name), or null when it has none. */
export function versionBannerUrl(version: string): string | null {
  const folder = VERSION_BANNERS[version];
  return folder
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VERSION_BANNER_BUCKET}/${folder}.webp`
    : null;
}
