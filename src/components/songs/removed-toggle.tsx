"use client";

import { useRouter } from "next/navigation";

import { songsHref } from "@/lib/songs/search";

export function RemovedToggle({
  query,
  showRemoved,
  label,
}: {
  query: string;
  showRemoved: boolean;
  label: string;
}) {
  const router = useRouter();

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none hover:text-foreground">
      <input
        type="checkbox"
        checked={showRemoved}
        onChange={(event) => router.push(songsHref(query, 1, event.target.checked))}
        className="size-4 cursor-pointer accent-primary"
      />
      {label}
    </label>
  );
}
