"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type AiBudget = { budgetUsd: number; spentUsd: number; remainingUsd: number; remainingReads: number };

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Site-wide AI reading budget; hidden when AI reading is off. Refetches when `refreshKey` changes. */
export function AiBudgetBar({ refreshKey }: { refreshKey: number }) {
  const t = useTranslations("scores.aiBudget");
  const [budget, setBudget] = useState<AiBudget | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/scores/read-screenshot", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { budget: null }))
      .then((data: { budget: AiBudget | null }) => setBudget(data.budget))
      .catch(() => {
        if (!controller.signal.aborted) setBudget(null);
      });
    return () => controller.abort();
  }, [refreshKey]);

  if (!budget) return null;
  const percent = Math.round((budget.remainingUsd / budget.budgetUsd) * 100);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
        <span className="font-medium">{t("label")}</span>
        <span>
          {budget.remainingReads > 0
            ? t("remaining", {
              count: budget.remainingReads.toLocaleString("en-US"),
              remaining: usd(budget.remainingUsd),
              budget: usd(budget.budgetUsd),
            })
            : t("exhausted")}
        </span>
      </div>
      <div role="progressbar" aria-label={t("label")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
