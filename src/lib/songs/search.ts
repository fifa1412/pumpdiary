export function sanitizeSongSearchQuery(
  raw: string | string[] | undefined,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 100).replace(/[,()*%\\]/g, "");
}
