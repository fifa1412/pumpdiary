"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function CabinetCreateForm({ returnTo, chartId }: { returnTo: string | null; chartId: number | null }) {
  const t = useTranslations("scores.cabinet");
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const values = {
      serial_number: String(form.get("serialNumber") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(),
      country: String(form.get("country") ?? "").trim(),
    };
    if (Object.values(values).some((value) => !value)) {
      setError(t("errors.required"));
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setError(t("errors.required"));
        return;
      }
      const { data, error: insertError } = await supabase
        .from("cabinets")
        .insert({ ...values, created_by: authData.user.id })
        .select("id")
        .single();
      if (insertError || !data) {
        setError(insertError?.code === "23505" ? t("errors.duplicateSerial") : t("errors.required"));
        return;
      }
      toast.success(t("toasts.created"));
      router.push(returnTo
        ? `/scores/new?cabinet=${data.id}${chartId ? `&chart=${chartId}` : ""}`
        : "/dashboard");
      router.refresh();
    } catch {
      setError(t("errors.required"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {([
        ["serialNumber", "fields.serialNumber"],
        ["name", "fields.name"],
        ["location", "fields.location"],
        ["country", "fields.country"],
      ] as const).map(([name, labelKey]) => (
        <div key={name} className="space-y-2">
          <Label htmlFor={`cabinet-${name}`}>{t(labelKey)}</Label>
          <Input id={`cabinet-${name}`} name={name} required maxLength={160} autoComplete="off" />
        </div>
      ))}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={isSaving}>
        {isSaving ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
