import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PadIcon } from "@/components/brand/pad-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreCardMock } from "@/components/home/score-card-mock";

export async function Hero() {
  const t = await getTranslations("home");

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid" />
      <div
        aria-hidden
        className="glow-primary pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[820px] -translate-x-1/2"
      />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-10">
        <div className="flex flex-col items-start gap-6">
          <Badge variant="secondary">{t("hero.badge")}</Badge>
          <h1 className="font-display text-4xl font-bold leading-tight text-balance sm:text-5xl lg:text-6xl">
            {t("hero.headlineLine1")}
            <br />
            {t("hero.headlineLine2Lead")}
            <span className="text-gradient-brand">
              {t("hero.headlineLine2Highlight")}
            </span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("hero.subcopy")}
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              size="lg"
              asChild
              className="shadow-[0_0_24px_rgba(61,255,139,0.35)]"
            >
              <Link href="/register">{t("hero.ctaPrimary")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">{t("hero.ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
          <div aria-hidden className="absolute -inset-10 overflow-hidden rounded-3xl">
            <div className="glow-primary absolute inset-0" />
            <PadIcon className="absolute -right-8 -top-8 size-56 opacity-10 sm:size-64" />
          </div>
          <ScoreCardMock />
        </div>
      </div>
    </section>
  );
}
