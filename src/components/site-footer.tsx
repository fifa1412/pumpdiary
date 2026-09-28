import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("common");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PumpDiary</p>
        <p>{t("footer.disclaimer")}</p>
      </div>
    </footer>
  );
}
