import type { SongChart } from "@/components/songs/types";

/**
 * The charts to offer for a song: those still in the current game version.
 * A removed song keeps all of its charts, since nothing replaced them.
 * `keepId` stays in the list either way, so a score already logged on a
 * retired chart still shows its chart as selected.
 */
export function playableCharts<T extends Pick<SongChart, "id" | "is_available">>(
  charts: T[],
  songAvailable: boolean,
  keepId?: number,
): T[] {
  if (!songAvailable) return charts;
  return charts.filter((chart) => chart.is_available || chart.id === keepId);
}
