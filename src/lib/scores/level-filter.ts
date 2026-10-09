type StepType = "SINGLE" | "DOUBLE" | "HALFDOUBLE";
export type LevelFilter = { stepType: StepType; level: number };

const CODES: Record<StepType, string> = { SINGLE: "S", DOUBLE: "D", HALFDOUBLE: "HD" };
const ORDER: Record<StepType, number> = { SINGLE: 0, DOUBLE: 1, HALFDOUBLE: 2 };

/** "S20" -> Single 20, "D22" -> Double 22, "HD8" -> Half-Double 8; anything else is no filter. */
export function parseLevelFilter(raw: string | undefined): LevelFilter | null {
  const match = raw?.match(/^(HD|S|D)(\d{1,2})$/);
  if (!match) return null;
  const stepType = match[1] === "S" ? "SINGLE" : match[1] === "D" ? "DOUBLE" : "HALFDOUBLE";
  return { stepType, level: Number(match[2]) };
}

export function levelKey({ stepType, level }: LevelFilter): string {
  return `${CODES[stepType]}${level}`;
}

/** The chart levels a player has scores on, Singles then Doubles, low to high. */
export function levelOptions(rows: { stepchart: unknown }[]): LevelFilter[] {
  const seen = new Map<string, LevelFilter>();
  for (const { stepchart } of rows) {
    const chart = (Array.isArray(stepchart) ? stepchart[0] : stepchart) as LevelFilter & { step_type?: StepType } | null;
    if (!chart?.step_type) continue;
    const option = { stepType: chart.step_type, level: chart.level };
    seen.set(levelKey(option), option);
  }
  return [...seen.values()].sort((a, b) => ORDER[a.stepType] - ORDER[b.stepType] || a.level - b.level);
}
