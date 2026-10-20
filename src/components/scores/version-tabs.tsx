import Link from "next/link";

import { DEFAULT_GAME_VERSION, gameVersionLabel, gameVersionTone, type GameVersion } from "@/lib/scores/game-versions";
import { cn } from "@/lib/utils";

/** `path` with ?version= for the version, left off for the default version. */
export function versionHref(path: string, version: GameVersion): string {
  return version.name === DEFAULT_GAME_VERSION ? path : `${path}${path.includes("?") ? "&" : "?"}version=${version.id}`;
}

/** One link per game version; leaderboards show one version at a time. */
export function VersionTabs({
  versions,
  current,
  path,
  label,
}: {
  versions: GameVersion[];
  current: GameVersion;
  path: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {versions.map((version) => {
        const tone = gameVersionTone(version.name);
        const active = version.id === current.id;
        return (
          <Link
            key={version.id}
            href={versionHref(path, version)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-[3px] border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active ? `${tone.fill} text-version-foreground` : `bg-card ${tone.text} hover:bg-muted`,
            )}
          >
            {gameVersionLabel(version.name)}
          </Link>
        );
      })}
    </nav>
  );
}
