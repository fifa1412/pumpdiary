import { ClipboardList, Target, TrendingUp, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Sparkline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 96 32"
      className="h-8 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points="2,26 18,22 34,24 50,15 66,13 82,7 94,4"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary"
      />
    </svg>
  );
}

const CARDS = [
  {
    icon: ClipboardList,
    titleKey: "features.scores.title",
    descriptionKey: "features.scores.description",
    sparkline: false,
  },
  {
    icon: Video,
    titleKey: "features.videos.title",
    descriptionKey: "features.videos.description",
    sparkline: false,
  },
  {
    icon: TrendingUp,
    titleKey: "features.progress.title",
    descriptionKey: "features.progress.description",
    sparkline: true,
  },
  {
    icon: Target,
    titleKey: "features.goals.title",
    descriptionKey: "features.goals.description",
    sparkline: false,
  },
] as const;

export async function Features() {
  const t = await getTranslations("home");

  return (
    <section id="features" className="scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="font-display text-3xl font-bold text-balance sm:text-4xl">
          {t("features.title")}
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map(({ icon: Icon, titleKey, descriptionKey, sparkline }) => (
            <Card key={titleKey}>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary/60">
                  <Icon aria-hidden className="size-5 text-primary" />
                </div>
                <CardTitle className="font-display text-lg">{t(titleKey)}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {t(descriptionKey)}
                </CardDescription>
              </CardHeader>
              {sparkline ? <CardContent><Sparkline /></CardContent> : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
