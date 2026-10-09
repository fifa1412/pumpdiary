const STEP_TYPE_CODES = { SINGLE: "S", DOUBLE: "D", HALFDOUBLE: "HD" } as const;

/** Short name for one logged play, e.g. "Odin S20 - Score 995,416". */
export function scoreLabel(
  songTitle: string,
  chart: { step_type: keyof typeof STEP_TYPE_CODES; level: number } | null | undefined,
  score: number,
): string {
  const chartCode = chart ? ` ${STEP_TYPE_CODES[chart.step_type]}${chart.level}` : "";
  return `${songTitle}${chartCode} - Score ${score.toLocaleString("en-US")}`;
}
