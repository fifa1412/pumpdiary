import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CabinetForm } from "@/components/cabinets/cabinet-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores.cabinet");
  return { title: t("newTitle") };
}

export default async function NewCabinetPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; chart?: string | string[] }>;
}) {
  const [user, params, t] = await Promise.all([
    getCurrentUser(), searchParams, getTranslations("scores.cabinet"),
  ]);
  if (!user) redirect("/login");
  const rawReturnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const returnTo = rawReturnTo === "/scores/new" ? rawReturnTo : null;
  const rawChart = Array.isArray(params.chart) ? params.chart[0] : params.chart;
  const chartId = rawChart && /^\d+$/.test(rawChart) ? Number(rawChart) : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t("newTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("newDescription")}</p>
        </CardHeader>
        <CardContent>
          <CabinetForm returnTo={returnTo} chartId={chartId} />
        </CardContent>
      </Card>
    </div>
  );
}
