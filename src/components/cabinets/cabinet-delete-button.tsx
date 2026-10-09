"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function CabinetDeleteButton({ id, name }: { id: number; name: string }) {
  const t = useTranslations("scores.cabinet.manage");
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove() {
    if (!window.confirm(t("deleteConfirm", { name }))) return;
    setIsDeleting(true);
    try {
      const { data, error } = await createClient().from("cabinets").delete().eq("id", id).select("id").maybeSingle();
      if (error || !data) {
        toast.error(t("deleteError"));
        return;
      }
      toast.success(t("deleted"));
      router.refresh();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={remove} disabled={isDeleting}>
      <Trash2 aria-hidden="true" />
      {t("delete")}
    </Button>
  );
}
