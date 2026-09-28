import Link from "next/link";
import { cn } from "@/lib/utils";
import { PadIcon } from "./pad-icon";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)}>
      <PadIcon className="size-7" />
      <span className="font-display text-lg font-bold tracking-tight">
        <span className="text-foreground">Pump</span>
        <span className="text-primary">Diary</span>
      </span>
    </Link>
  );
}
