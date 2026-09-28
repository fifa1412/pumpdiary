import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export async function SearchForm({ query }: { query: string }) {
  const t = await getTranslations("songs");

  return (
    <form
      action="/songs"
      method="get"
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <Label htmlFor="song-search" className="sr-only">
        {t("search.label")}
      </Label>
      <Input
        id="song-search"
        name="q"
        type="search"
        defaultValue={query}
        placeholder={t("search.placeholder")}
        className="sm:max-w-md"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="shrink-0">
          {t("search.submit")}
        </Button>
        {query ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/songs">{t("search.clear")}</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
