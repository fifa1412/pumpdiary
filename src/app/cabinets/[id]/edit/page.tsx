import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CabinetForm } from "@/components/cabinets/cabinet-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores.cabinet.manage");
  return { title: t("editTitle") };
}

export default async function EditCabinetPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: rawId }, user, t] = await Promise.all([
    params, getCurrentUser(), getTranslations("scores.cabinet.manage"),
  ]);
  if (!user) redirect("/login");
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) < 1) notFound();

  const supabase = await createClient();
  const { data: cabinet } = await supabase
    .from("cabinets")
    .select("id, serial_number, name, location, country")
    .eq("id", Number(rawId))
    .eq("created_by", user.id)
    .maybeSingle();
  if (!cabinet) notFound();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t("editTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CabinetForm cabinet={cabinet} />
        </CardContent>
      </Card>
    </div>
  );
}
