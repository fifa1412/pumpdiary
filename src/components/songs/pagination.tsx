import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

function songsHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/songs?${qs}` : "/songs";
}

export async function SongsPagination({
  query,
  page,
  totalPages,
}: {
  query: string;
  page: number;
  totalPages: number;
}) {
  const t = await getTranslations("songs");

  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={t("pagination.label")}
      className="flex items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={songsHref(query, page - 1)}>
            {t("pagination.previous")}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          {t("pagination.previous")}
        </Button>
      )}
      <span className="text-sm text-muted-foreground">
        {t("pagination.page", { page, total: totalPages })}
      </span>
      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={songsHref(query, page + 1)}>
            {t("pagination.next")}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          {t("pagination.next")}
        </Button>
      )}
    </nav>
  );
}
