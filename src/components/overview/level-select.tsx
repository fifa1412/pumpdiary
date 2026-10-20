"use client";

import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";

/** Level dropdown that opens the chosen level straight away. */
export function LevelSelect({
  level,
  options,
  versionId,
}: {
  level: string;
  options: { stepLabel: string; keys: { key: string; label: string }[] }[];
  /** Kept in the URL when a version other than the default is shown. */
  versionId?: number;
}) {
  const t = useTranslations("overview");
  return (
    <form action="/overview">
      {versionId ? <input type="hidden" name="version" value={versionId} /> : null}
      <Label htmlFor="overview-level" className="sr-only">{t("level")}</Label>
      <select id="overview-level" name="level" defaultValue={level}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {options.map((group) => (
          <optgroup key={group.stepLabel} label={group.stepLabel}>
            {group.keys.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </optgroup>
        ))}
      </select>
      <noscript><button type="submit">{t("show")}</button></noscript>
    </form>
  );
}
