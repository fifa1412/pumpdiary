import type { Metadata } from "next";
import { Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CabinetDeleteButton } from "@/components/cabinets/cabinet-delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sanitizeSongSearchQuery } from "@/lib/songs/search";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

const CABINET_LIMIT = 500;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scores.cabinet.manage");
  return { title: t("title") };
}

export default async function CabinetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [user, params, t, tp, tc] = await Promise.all([
    getCurrentUser(), searchParams, getTranslations("scores.cabinet"), getTranslations("scores.picker"), getTranslations("common"),
  ]);
  if (!user) redirect("/login");
  const query = sanitizeSongSearchQuery(params.q);

  const supabase = await createClient();
  let request = supabase
    .from("cabinets")
    .select("id, serial_number, name, location, country, model, created_by", { count: "exact" })
    .order("name", { ascending: true })
    .limit(CABINET_LIMIT);
  if (query) {
    request = request.or(["serial_number", "name", "location", "country"].map((column) => `${column}.ilike.%${query}%`).join(","));
  }
  const { data: cabinets, count, error } = await request;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{t("manage.title")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("manage.description")}</p>
        </div>
        <Button asChild>
          <Link href="/cabinets/new"><Plus aria-hidden="true" />{t("newTitle")}</Link>
        </Button>
      </div>

      <form role="search" action="/cabinets" className="mt-6 flex gap-2 lg:max-w-xl">
        <label htmlFor="cabinet-search" className="sr-only">{t("search")}</label>
        <Input id="cabinet-search" type="search" name="q" defaultValue={query} placeholder={t("searchPlaceholder")} autoComplete="off" />
        <Button type="submit" variant="outline" className="shrink-0">{tp("search")}</Button>
      </form>

      {error ? (
        <p role="alert" className="mt-8 text-destructive">{tc("errors.generic")}</p>
      ) : (
        <>
          <p role="status" className="mt-6 text-sm text-muted-foreground">{t("manage.count", { count: count ?? 0 })}</p>
          {!cabinets?.length ? (
            <p className="mt-8 text-muted-foreground">{query ? t("noResults") : t("manage.empty")}</p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cabinets.map((cabinet) => {
                const isOwn = cabinet.created_by === user.id;
                return (
                  <li key={cabinet.id}>
                    <Card className="h-full gap-3">
                      <CardHeader>
                        <CardTitle className="font-display text-lg leading-tight">{cabinet.name}</CardTitle>
                        {cabinet.serial_number ? <p className="font-numeric text-sm text-muted-foreground">{cabinet.serial_number}</p> : null}
                      </CardHeader>
                      <CardContent className="flex h-full flex-col gap-3">
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                          <dt className="text-muted-foreground">{t("fields.model")}</dt>
                          <dd>{cabinet.model ?? "—"}</dd>
                          <dt className="text-muted-foreground">{t("fields.location")}</dt>
                          <dd className="break-words">{cabinet.location}</dd>
                          <dt className="text-muted-foreground">{t("fields.country")}</dt>
                          <dd className="break-words">{cabinet.country}</dd>
                        </dl>
                        {isOwn ? (
                          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                            <span className="mr-auto text-xs text-muted-foreground">{t("manage.addedByYou")}</span>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/cabinets/${cabinet.id}/edit`}><Wrench aria-hidden="true" />{t("manage.edit")}</Link>
                            </Button>
                            <CabinetDeleteButton id={cabinet.id} name={cabinet.name} />
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
