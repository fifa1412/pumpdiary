import Link from "next/link";
import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { SongChart, StepType } from "./types";

const STEP_ORDER: Record<StepType, number> = {
  SINGLE: 0,
  DOUBLE: 1,
  HALFDOUBLE: 2,
};

const STEP_PREFIX: Record<StepType, string> = {
  SINGLE: "S",
  DOUBLE: "D",
  HALFDOUBLE: "HD",
};

const STEP_CLASS: Record<StepType, string> = {
  SINGLE: "border-0 rounded-[3px] bg-single-bg text-single-foreground",
  DOUBLE: "border-0 rounded-[3px] bg-double-bg text-double-foreground",
  HALFDOUBLE: "border-border bg-secondary text-secondary-foreground",
};

export function ChartBadges({
  charts,
  label,
  leaderboardLabel,
}: {
  charts: SongChart[];
  label: string;
  leaderboardLabel: string;
}) {
  const sorted = [...charts].sort(
    (a, b) =>
      STEP_ORDER[a.step_type] - STEP_ORDER[b.step_type] || a.level - b.level,
  );

  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {sorted.map((chart) => (
        <li key={`${chart.step_type}-${chart.level}`} className="inline-flex items-center gap-0.5">
          <Link
            href={`/scores/new?chart=${chart.id}`}
            aria-label={`${STEP_PREFIX[chart.step_type]}${chart.level}`}
            className="inline-flex rounded-[3px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Badge
              variant="outline"
              className={cn("font-numeric tabular-nums", STEP_CLASS[chart.step_type])}
            >
              {STEP_PREFIX[chart.step_type]}
              {chart.level}
            </Badge>
          </Link>
          <Link
            href={`/charts/${chart.id}/leaderboard`}
            aria-label={`${leaderboardLabel} ${STEP_PREFIX[chart.step_type]}${chart.level}`}
            title={`${leaderboardLabel} ${STEP_PREFIX[chart.step_type]}${chart.level}`}
            className="inline-flex size-6 items-center justify-center rounded-[3px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Trophy aria-hidden="true" className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
