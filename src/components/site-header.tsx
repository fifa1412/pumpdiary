"use client";

import {
  ChevronDown, ClipboardList, Gamepad2, LayoutGrid, LogOut, Menu, Music, Plus, Trophy, Video, X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logoutUser, type CurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: "myScores" | "overview" | "videos" | "songs" | "leaderboard" | "cabinets";
  icon: LucideIcon;
  /** Also active on these path prefixes. */
  also?: string[];
  signedIn?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "myScores", icon: ClipboardList, signedIn: true },
  { href: "/overview", label: "overview", icon: LayoutGrid, signedIn: true },
  { href: "/dashboard/videos", label: "videos", icon: Video, signedIn: true },
  { href: "/songs", label: "songs", icon: Music },
  { href: "/leaderboard", label: "leaderboard", icon: Trophy, also: ["/charts/"] },
];
const CABINETS: NavItem = { href: "/cabinets", label: "cabinets", icon: Gamepad2, signedIn: true };

function isActive(pathname: string, item: NavItem): boolean {
  // "My scores" is /dashboard itself; the video dashboard below it has its own tab.
  if (item.href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/scores/");
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
    || (item.also ?? []).some((prefix) => pathname.startsWith(prefix));
}

/** Closes a popup on a click outside it or on Escape. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

export function SiteHeader({
  initialUser,
}: {
  initialUser: CurrentUser | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");
  const { user } = useCurrentUser(initialUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const closeAccount = () => setAccountOpen(false);
  const closeMenu = () => setMenuOpen(false);
  useDismiss(accountOpen, closeAccount, accountRef);
  useDismiss(menuOpen, closeMenu, mobileRef);

  // A new page closes whatever was open.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setMenuOpen(false);
    setAccountOpen(false);
  }

  async function handleLogout() {
    setAccountOpen(false);
    try {
      await logoutUser();
      router.push("/");
    } catch {
      toast.error(t("errors.generic"));
    }
  }

  const items = NAV.filter((item) => !item.signedIn || user);
  const initial = user?.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <header ref={mobileRef} className="sticky top-0 z-50 border-b border-border/70 bg-surface-deep/90 backdrop-blur-md">
      {/* Arcade marquee stripe. */}
      <div aria-hidden="true" className="h-0.5 bg-gradient-to-r from-primary via-primary/80 to-accent" />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo compact />

        <nav aria-label={t("nav.menu")} className="ml-4 hidden h-full items-stretch xl:flex">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center px-3 text-sm font-medium transition-colors",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
                  active
                    ? "text-foreground after:bg-primary after:shadow-[0_0_12px_var(--primary)]"
                    : "text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border",
                )}
              >
                {t(`nav.${item.label}`)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Button size="sm" asChild className="hidden font-semibold shadow-[0_0_16px_-4px_var(--primary)] sm:inline-flex">
                <Link href="/scores/new"><Plus aria-hidden="true" />{t("nav.addScore")}</Link>
              </Button>
              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label={`${t("nav.account")}: ${user.name}`}
                  onClick={() => setAccountOpen((open) => !open)}
                  className="flex items-center gap-1.5 rounded-[3px] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="grid size-8 place-items-center rounded-[3px] border border-primary/50 bg-primary/15 font-display text-base font-bold text-primary">
                    {initial}
                  </span>
                  <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", accountOpen && "rotate-180")} />
                </button>
                {accountOpen ? (
                  <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-[3px] border bg-card shadow-xl shadow-black/40">
                    <div className="border-b px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">{t("nav.signedInAs")}</p>
                      <p className="truncate font-semibold">{user.name}</p>
                    </div>
                    <Link role="menuitem" href={CABINETS.href} onClick={closeAccount}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                      <Gamepad2 aria-hidden="true" className="size-4 text-muted-foreground" />{t("nav.cabinets")}
                    </Link>
                    <button role="menuitem" type="button" onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-destructive hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                      <LogOut aria-hidden="true" className="size-4" />{t("nav.logout")}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="hidden hover:bg-muted hover:text-foreground sm:inline-flex dark:hover:bg-muted">
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">{t("nav.register")}</Link>
              </Button>
            </div>
          )}
          <LanguageToggle />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={t("nav.menu")}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-9 place-items-center rounded-[3px] border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:hidden"
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="site-menu" aria-label={t("nav.menu")} className="border-t border-border/70 bg-surface-deep xl:hidden">
          <div className="mx-auto grid max-w-6xl gap-1 px-4 py-3 sm:grid-cols-2">
            {[...items, ...(user ? [CABINETS] : [])].map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[3px] border-l-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className={cn("size-4", active && "text-primary")} />
                  {t(`nav.${item.label}`)}
                </Link>
              );
            })}
            {user ? (
              <Button asChild className="mt-2 sm:col-span-2 sm:hidden">
                <Link href="/scores/new"><Plus aria-hidden="true" />{t("nav.addScore")}</Link>
              </Button>
            ) : (
              <Button variant="outline" asChild className="mt-2 sm:hidden">
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
