"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

import { CABINET_MODELS, type CabinetOption } from "./types";

const COLUMNS = {
  serialNumber: "serial_number",
  name: "name",
  location: "location",
  country: "country",
} as const;

// Adds a cabinet, or edits one when `cabinet` is given.
export function CabinetForm({ cabinet, returnTo = null, chartId = null, initialName = "" }: {
  cabinet?: CabinetOption;
  /** Prefills the name when adding, e.g. the machine name read from a screenshot. */
  initialName?: string;
  returnTo?: string | null;
  chartId?: number | null;
}) {
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
      model: String(form.get("model") ?? ""),
    };
    if (Object.values(values).some((value) => !value) || !(CABINET_MODELS as readonly string[]).includes(values.model)) {
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
      if (cabinet) {
        const { data, error: updateError } = await supabase
          .from("cabinets")
          .update(values)
          .eq("id", cabinet.id)
          .select("id")
          .maybeSingle();
        if (updateError || !data) {
          setError(updateError?.code === "23505" ? t("errors.duplicateSerial") : t("manage.saveError"));
          return;
        }
        toast.success(t("manage.updated"));
        router.push("/cabinets");
        router.refresh();
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
      router.push(returnTo === "/scores/new"
        ? `/scores/new?cabinet=${data.id}${chartId ? `&chart=${chartId}` : ""}`
        : "/cabinets");
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
          <Input id={`cabinet-${name}`} name={name} required maxLength={160} autoComplete="off"
            defaultValue={cabinet ? cabinet[COLUMNS[name]] : name === "name" && initialName ? initialName : undefined} />
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor="cabinet-model">{t("fields.model")}</Label>
        <select id="cabinet-model" name="model" required defaultValue={cabinet?.model ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <option value="" disabled>{t("fields.modelPlaceholder")}</option>
          {CABINET_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={isSaving}>
        {isSaving ? t("saving") : cabinet ? t("manage.save") : t("submit")}
      </Button>
    </form>
  );
}
