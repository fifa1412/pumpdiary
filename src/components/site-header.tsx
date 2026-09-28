"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logoutUser, type CurrentUser } from "@/lib/auth";

export function SiteHeader({
  initialUser,
}: {
  initialUser: CurrentUser | null;
}) {
  const router = useRouter();
  const t = useTranslations("common");
  const { user } = useCurrentUser(initialUser);

  async function handleLogout() {
    try {
      await logoutUser();
      router.push("/");
    } catch {
      toast.error(t("errors.generic"));
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo compact />
        <nav className="flex min-w-0 items-center gap-1 sm:gap-3">
          <Link
            href="/#features"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            {t("nav.features")}
          </Link>
          <Link
            href="/#how-it-works"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            {t("nav.howItWorks")}
          </Link>
          {user ? (
            <div className="flex items-center gap-1">
              <span className="hidden max-w-28 truncate text-sm font-medium md:inline">
                {user.name}
              </span>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("nav.dashboard")}
              </Link>
              <Button className="px-2 sm:px-3" variant="ghost" size="sm" onClick={handleLogout}>
                {t("nav.logout")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button className="px-2" variant="ghost" size="sm" asChild>
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              <Button className="px-2" size="sm" asChild>
                <Link href="/register">{t("nav.register")}</Link>
              </Button>
            </div>
          )}
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
