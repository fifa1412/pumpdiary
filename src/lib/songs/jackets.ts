const JACKET_BUCKET = "song-jackets";

/** Public URL of a song's jacket image (songs.jacket_path). */
export function jacketUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${JACKET_BUCKET}/${encodeURIComponent(path)}`;
}
