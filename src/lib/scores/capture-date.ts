import exifr from "exifr";

export function parseExifCaptureDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second] = match;
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00`);
  if (parsed.getFullYear() !== Number(year)
    || parsed.getMonth() + 1 !== Number(month)
    || parsed.getDate() !== Number(day)
    || Number(hour) > 23
    || Number(minute) > 59
    || Number(second) > 59) return undefined;

  return date;
}

export async function readCaptureDate(image: Blob): Promise<string | undefined> {
  try {
    const metadata = await exifr.parse(image, {
      pick: ["DateTimeOriginal"],
      reviveValues: false,
    });
    return parseExifCaptureDate(metadata?.DateTimeOriginal);
  } catch {
    return undefined;
  }
}
