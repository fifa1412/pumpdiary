/**
 * A chart can sit at a different level on another game version (Odin S20 in
 * Phoenix 2 was S21 in Phoenix). stepcharts.level is the Phoenix 2 level, and
 * stepchart_levels holds the versions where it differs.
 */
export type VersionLevel = { series_id: number; level: number };

/** Select fragment that embeds a chart's per-version levels. */
export const VERSION_LEVELS = "levels:stepchart_levels(series_id, level)";

type LeveledChart = { level: number; levels?: VersionLevel[] | null };

/** The chart's level on a game version (game_series id). */
export function levelOn(chart: LeveledChart, seriesId: number | null | undefined): number {
  if (seriesId == null) return chart.level;
  return chart.levels?.find((entry) => entry.series_id === seriesId)?.level ?? chart.level;
}

/** The chart with `level` set to its level on the game version. */
export function chartOn<T extends LeveledChart>(chart: T, seriesId: number | null | undefined): T {
  const level = levelOn(chart, seriesId);
  return level === chart.level ? chart : { ...chart, level };
}
