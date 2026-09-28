"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logoutUser, type CurrentUser } from "@/lib/auth";

const GENERIC_ERROR = 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';

export function SiteHeader({
  initialUser,
}: {
  initialUser: CurrentUser | null;
}) {
  const router = useRouter();
  const { user } = useCurrentUser(initialUser);

  async function handleLogout() {
    try {
      await logoutUser();
      router.push("/");
    } catch {
      toast.error(GENERIC_ERROR);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-4">
          <Link
            href="/#features"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            ฟีเจอร์
          </Link>
          <Link
            href="/#how-it-works"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            วิธีใช้งาน
          </Link>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-medium sm:inline">
                {user.name}
              </span>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                แดชบอร์ด
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                ออกจากระบบ
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">เข้าสู่ระบบ</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">สมัครสมาชิก</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
