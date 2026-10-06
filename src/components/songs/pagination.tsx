import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { songsHref } from "@/lib/songs/search";

export async function SongsPagination({
  query,
  page,
  totalPages,
  showRemoved,
}: {
  query: string;
  page: number;
  totalPages: number;
  showRemoved: boolean;
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
          <Link href={songsHref(query, page - 1, showRemoved)}>
            {t("pagination.previous")}
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          {t("pagination.previous")}
        </Button>
      )}
      <span className="font-numeric text-sm text-muted-foreground">
        {t("pagination.page", { page, total: totalPages })}
      </span>
      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={songsHref(query, page + 1, showRemoved)}>
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
