export function sanitizeSongSearchQuery(
  raw: string | string[] | undefined,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 100).replace(/[,()*%\\]/g, "");
}

/** Songs page URL; removed songs are shown unless showRemoved is false. */
export function songsHref(query: string, page: number, showRemoved: boolean): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (!showRemoved) params.set("removed", "0");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/songs?${qs}` : "/songs";
}
