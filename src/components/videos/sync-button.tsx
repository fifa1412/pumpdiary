"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { syncVideoStats } from "@/app/dashboard/videos/actions";
import { Button } from "@/components/ui/button";

/** Fetches every clip's numbers from YouTube, then reloads the table. */
export function SyncButton() {
  const t = useTranslations("videos");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function sync() {
    startTransition(async () => {
      const result = await syncVideoStats().catch(() => ({ ok: false, error: "failed" }) as const);
      if (!result.ok) {
        if (result.error === "signedOut") router.push("/login");
        else toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("synced", { count: result.synced }));
      if (result.missing > 0) toast.warning(t("missing", { count: result.missing }));
      router.refresh();
    });
  }

  return (
    <Button type="button" onClick={sync} disabled={pending}>
      <RefreshCw aria-hidden="true" className={pending ? "animate-spin" : undefined} />
      {pending ? t("syncing") : t("sync")}
    </Button>
  );
}
