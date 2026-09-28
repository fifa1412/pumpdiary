"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutUser, type CurrentUser } from "@/lib/auth";

export function DashboardView({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");

  async function handleLogout() {
    try {
      await logoutUser();
      router.replace("/");
    } catch {
      toast.error(tc("errors.generic"));
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-4 py-12">
      <h1 className="font-display text-3xl font-bold">
        {t("greeting", { name: user.name })}
      </h1>
      <Card className="w-full max-w-[420px]">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            {t("emptyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button className="w-full" asChild>
            <Link href="/scores/new">{t("addScore")}</Link>
          </Button>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            {tc("nav.logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
