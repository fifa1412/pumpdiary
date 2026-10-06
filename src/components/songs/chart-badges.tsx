import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { levelBadgeUrl } from "@/lib/songs/level-badges";
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
}: {
  charts: SongChart[];
  label: string;
}) {
  const sorted = [...charts].sort(
    (a, b) =>
      STEP_ORDER[a.step_type] - STEP_ORDER[b.step_type] || a.level - b.level,
  );
  // One row per step type; badges shrink rather than wrap so a row stays on one line.
  const rows = (Object.keys(STEP_ORDER) as StepType[])
    .map((stepType) => sorted.filter((chart) => chart.step_type === stepType))
    .filter((row) => row.length > 0);

  return (
    <div aria-label={label} role="group" className="space-y-1">
      {rows.map((row) => (
        <ul key={row[0].step_type} className="flex gap-0.5">
          {row.map((chart) => {
            const badgeUrl = levelBadgeUrl(chart.step_type, chart.level);
            const name = `${STEP_PREFIX[chart.step_type]}${chart.level}`;
            return (
              <li key={chart.id} className={badgeUrl ? "min-w-0 max-w-11 flex-1" : "shrink-0 self-center"}>
                <Link
                  href={`/scores/new?chart=${chart.id}`}
                  aria-label={name}
                  title={name}
                  className="block rounded-[3px] outline-none transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {badgeUrl ? (
                    <Image
                      src={badgeUrl}
                      alt=""
                      width={44}
                      height={44}
                      unoptimized
                      className="aspect-square h-auto w-full"
                    />
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn("font-numeric tabular-nums", STEP_CLASS[chart.step_type])}
                    >
                      {name}
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}
