import Link from "next/link";
import { cn } from "@/lib/utils";
import { PadIcon } from "./pad-icon";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  /** Hide the wordmark visually on very narrow screens (it stays available to screen readers). */
  compact?: boolean;
}) {
  return (
    <Link href="/" className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      <PadIcon className="size-7" />
      <span
        className={cn(
          "font-display text-lg font-bold tracking-tight",
          compact && "max-[399px]:sr-only",
        )}
      >
        <span className="text-foreground">Pump</span>
        <span className="text-primary">Diary</span>
      </span>
    </Link>
  );
}
