import { BarChart3, Link2, Music2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

const ITEMS = [
  { icon: Music2, key: "highlights.singleDouble" },
  { icon: Link2, key: "highlights.youtube" },
  { icon: BarChart3, key: "highlights.history" },
] as const;

export async function Highlights() {
  const t = await getTranslations("home");

  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:grid-cols-3 sm:gap-8">
        {ITEMS.map(({ icon: Icon, key }) => (
          <div key={key} className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60">
              <Icon aria-hidden className="size-5 text-primary" />
            </div>
            <p className="text-sm font-medium leading-snug">{t(key)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
