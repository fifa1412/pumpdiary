"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CabinetOption } from "./types";

export function CabinetPicker({
  cabinets,
  initialCabinetId,
  chartId,
  onChange,
  detected = false,
  screenMachineName = "",
}: {
  cabinets: CabinetOption[];
  initialCabinetId: number | null;
  chartId: number;
  onChange: (id: number | null) => void;
  /** The selection was matched from the screenshot. */
  detected?: boolean;
  /** Machine name read from the screenshot that matched no cabinet. */
  screenMachineName?: string;
}) {
  const t = useTranslations("scores.cabinet");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return cabinets.filter((cabinet) =>
      [cabinet.serial_number ?? "", cabinet.name, cabinet.location, cabinet.country, cabinet.model ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(search)),
    );
  }, [cabinets, query]);

  return (
    <div className="space-y-2">
      <Label htmlFor="cabinet-search">{t("select")}</Label>
      <Input
        id="cabinet-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("search")}
      />
      <select
        id="cabinet"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={initialCabinetId ?? ""}
        onChange={(event) => onChange(event.currentTarget.value ? Number(event.currentTarget.value) : null)}
      >
        <option value="">{t("none")}</option>
        {filtered.map((cabinet) => (
          <option key={cabinet.id} value={cabinet.id}>
            {[cabinet.name, cabinet.model, cabinet.location, cabinet.serial_number].filter(Boolean).join(" · ")}
          </option>
        ))}
      </select>
      {query && filtered.length === 0 ? <p className="text-sm text-muted-foreground">{t("noResults")}</p> : null}
      {detected ? <p className="text-xs text-muted-foreground">{t("detected")}</p> : null}
      {screenMachineName ? <p className="text-xs text-muted-foreground">{t("screenName", { name: screenMachineName })}</p> : null}
      <Link
        href={`/cabinets/new?returnTo=%2Fscores%2Fnew${chartId ? `&chart=${chartId}` : ""}${screenMachineName ? `&name=${encodeURIComponent(screenMachineName)}` : ""}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("addLink")}
      </Link>
    </div>
  );
}
