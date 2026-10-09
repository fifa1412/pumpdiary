import Link from "next/link";
import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("common");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground">
        {/* The header hides these links on narrow screens, so the footer keeps them reachable. */}
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            {t("nav.myScores")}
          </Link>
          <Link href="/songs" className="transition-colors hover:text-foreground">
            {t("nav.songs")}
          </Link>
          <Link href="/cabinets" className="transition-colors hover:text-foreground">
            {t("nav.cabinets")}
          </Link>
        </nav>
        <div className="flex flex-col gap-1">
          <p>© {new Date().getFullYear()} PumpDiary</p>
          <p>{t("footer.disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
