// Title and description suggested for a play video uploaded to YouTube, e.g.
//   [PIU Phoenix 2] Odin S20 - 1 Miss (99.54)
//
//   Odin S20 : 1 Miss - Score 995,416 (SSS)
//   Perfect 1,227 / Great 5 / Good 1 / Bad 0 / Miss 1 / Max Combo 859
//   Record Date : 2026-10-03 @ Let's Play MBK Center (Thailand)
//   Player : FIFAZ
// The text is always English so every upload reads the same on YouTube.

const TITLE_PREFIX = "[PIU Phoenix 2]";

// Added to every upload. The Thai tag is escaped because src/ holds no Thai text.
const GAME_TAGS = [
  "Pump It Up", "PIU", "pumpitup",
  "Pump It Up Phoenix 2", "PIU Phoenix 2", "Phoenix 2",
  "\uD38C\uD504\uC787\uC5C5",
  "gameplay", "rhythm game", "dance game", "arcade", "\u0E40\u0E01\u0E21\u0E40\u0E15\u0E49\u0E19",
];

const STEP_TYPE_NAMES = { SINGLE: "Single", DOUBLE: "Double", HALFDOUBLE: "Half-Double" } as const;
const STEP_TYPE_CODES = { SINGLE: "S", DOUBLE: "D", HALFDOUBLE: "HD" } as const;

export type VideoTextInput = {
  chart: string;
  song?: { title: string; stepType: keyof typeof STEP_TYPE_NAMES; level: number };
  score?: number;
  grade?: string;
  judgments: { perfect?: number; great?: number; good?: number; bad?: number; miss?: number; maxCombo?: number };
  recordDate?: string;
  cabinet?: { name: string; country: string } | null;
  /** In-game player name read from the screenshot; the Player line is left out without it. */
  player?: string;
};

function count(value: number): string {
  return value.toLocaleString("en-US");
}

function isCount(value: number | undefined): value is number {
  return Number.isInteger(value);
}

/** 995416 -> "99.54"; truncated so a near-perfect score never shows as 100.00. */
export function scorePercent(score: number): string {
  return (Math.floor(score / 100) / 100).toFixed(2);
}

function missText(miss: number): string {
  return miss === 0 ? "ALL COMBO" : `${count(miss)} Miss`;
}

export function videoTitle({ chart, score, judgments }: VideoTextInput): string {
  const result = isCount(score) && isCount(judgments.miss)
    ? ` - ${missText(judgments.miss)} (${scorePercent(score)})`
    : "";
  return `${[TITLE_PREFIX, chart].filter(Boolean).join(" ")}${result}`;
}

/** One playlist per chart level, e.g. "PIU Phoenix 2 - Single Lv. 20". */
export function playlistTitle({ song }: VideoTextInput): string {
  return song ? `PIU Phoenix 2 - ${STEP_TYPE_NAMES[song.stepType]} Lv. ${song.level}` : "PIU Phoenix 2";
}

/** Song title, chart level tags, then the game tags. */
export function videoTags({ song }: VideoTextInput): string[] {
  const chartTags = song
    ? [
      song.title,
      `${STEP_TYPE_CODES[song.stepType]}${song.level}`,
      `${STEP_TYPE_NAMES[song.stepType]} ${song.level}`,
      `PIU ${STEP_TYPE_CODES[song.stepType]}${song.level}`,
    ]
    : [];
  return [...chartTags, ...GAME_TAGS];
}

export function videoDescription({ chart, score, grade, judgments, recordDate, cabinet, player }: VideoTextInput): string {
  const hasScore = isCount(score);
  const result = hasScore
    ? [isCount(judgments.miss) ? missText(judgments.miss) : "", `Score ${count(score)}${grade ? ` (${grade})` : ""}`]
      .filter(Boolean).join(" - ")
    : "";
  const counts = hasScore
    ? ([
      ["Perfect", judgments.perfect], ["Great", judgments.great], ["Good", judgments.good],
      ["Bad", judgments.bad], ["Miss", judgments.miss], ["Max Combo", judgments.maxCombo],
    ] satisfies [string, number | undefined][])
      .flatMap(([label, value]) => (isCount(value) ? [`${label} ${count(value)}`] : []))
      .join(" / ")
    : "";
  const record = recordDate
    ? `Record Date : ${recordDate}${cabinet ? ` @ ${cabinet.name} (${cabinet.country})` : ""}`
    : "";
  return [
    [chart, result].filter(Boolean).join(" : "),
    counts,
    record,
    player ? `Player : ${player}` : "",
  ].filter(Boolean).join("\n");
}
