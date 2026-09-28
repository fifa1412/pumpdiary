import Link from "next/link";

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
  SINGLE: "border-primary/40 bg-primary/10 text-primary",
  DOUBLE: "border-accent/40 bg-accent/10 text-accent",
  HALFDOUBLE: "border-border bg-secondary text-secondary-foreground",
};

export function ChartBadges({
  charts,
  label,
}: {
  charts: SongChart[];
  label: string;
}) {
  const sorted = [...charts].sort(
    (a, b) =>
      STEP_ORDER[a.step_type] - STEP_ORDER[b.step_type] || a.level - b.level,
  );

  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {sorted.map((chart) => (
        <li key={`${chart.step_type}-${chart.level}`}>
          <Link
            href={`/scores/new?chart=${chart.id}`}
            aria-label={`${STEP_PREFIX[chart.step_type]}${chart.level}`}
            className="inline-flex rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Badge
              variant="outline"
              className={cn("font-display tabular-nums", STEP_CLASS[chart.step_type])}
            >
              {STEP_PREFIX[chart.step_type]}
              {chart.level}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
