"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { setLocale } from "@/i18n/actions";
import { isLocale } from "@/i18n/config";

export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeLocale(nextLocale: string) {
    if (!isLocale(nextLocale) || nextLocale === locale) return;

    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language.switchLabel")}
      className="inline-flex shrink-0 items-center rounded-md border border-border p-0.5"
    >
      {(["en", "th"] as const).map((option) => {
        const active = locale === option;

        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={active}
            disabled={isPending}
            onClick={() => changeLocale(option)}
            className={`min-w-8 rounded px-1.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {option.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
