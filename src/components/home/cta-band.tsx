import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export async function CtaBand() {
  const t = await getTranslations("home");

  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:pb-20">
      <div className="h-full rounded-[3px] border border-border border-t-[3px] border-t-primary bg-card px-6 py-14 text-center sm:py-16">
        <h2 className="font-display text-3xl font-bold text-balance sm:text-4xl">
          {t("cta.title")}
        </h2>
        <div className="mt-8 flex justify-center">
          <Button size="lg" asChild>
            <Link href="/register">{t("cta.button")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
