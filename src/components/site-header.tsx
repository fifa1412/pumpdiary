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
    <header className="sticky top-0 z-50 border-b border-border bg-surface-deep">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo compact />
        <nav className="flex min-w-0 items-center gap-1 sm:gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              {t("nav.myScores")}
            </Link>
          ) : null}
          {user ? (
            <Link
              href="/overview"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              {t("nav.overview")}
            </Link>
          ) : null}
          <Link
            href="/songs"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            {t("nav.songs")}
          </Link>
          <Link
            href="/leaderboard"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            {t("nav.leaderboard")}
          </Link>
          {user ? (
            <>
              <Link
                href="/cabinets"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
              >
                {t("nav.cabinets")}
              </Link>
              <span className="hidden max-w-28 truncate text-sm font-medium md:inline">
                {user.name}
              </span>
              <Button className="px-2 sm:px-3" variant="ghost" size="sm" onClick={handleLogout}>
                {t("nav.logout")}
              </Button>
            </>
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
