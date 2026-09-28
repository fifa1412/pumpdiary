import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreCardMock } from "@/components/home/score-card-mock";

export async function Hero() {
  const t = await getTranslations("home");

  return (
    <section className="overflow-hidden">
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-10">
        <div className="flex flex-col items-start gap-6">
          <Badge variant="secondary">{t("hero.badge")}</Badge>
          <h1 className="font-display text-4xl font-bold leading-tight text-balance sm:text-5xl lg:text-6xl">
            {t("hero.headlineLine1")}
            <br />
            {t("hero.headlineLine2Lead")}
            <span className="text-accent">
              {t("hero.headlineLine2Highlight")}
            </span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("hero.subcopy")}
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">{t("hero.ctaPrimary")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">{t("hero.ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
          <ScoreCardMock />
        </div>
      </div>
    </section>
  );
}
