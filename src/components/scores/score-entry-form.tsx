"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

import { SongChartPicker } from "./song-chart-picker";
import { SCORE_GRADES, SCORE_PLATES, type SongOption } from "./types";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"];
const YOUTUBE_URL =
  /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]+(?:&[^\s]*)?$/i;
const YOUTUBE_SHORT_URL =
  /^https:\/\/youtu\.be\/[A-Za-z0-9_-]+(?:\?[^\s]*)?$/i;
const YOUTUBE_SHORTS_URL =
  /^https:\/\/(?:www\.)?youtube\.com\/shorts\/[A-Za-z0-9_-]+(?:\?[^\s]*)?$/i;

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  const [year, month, day] = value.split("-").map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function resizeScreenshot(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    const initialScale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    let blob: Blob | null = null;

    for (let scale = initialScale; scale >= initialScale * 0.35; scale *= 0.85) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const candidate = await canvasBlob(canvas, quality);
        if (!candidate || candidate.type !== "image/webp") {
          throw new Error("webp-conversion-failed");
        }
        if (candidate.size <= MAX_SCREENSHOT_BYTES) {
          blob = candidate;
          break;
        }
      }
      if (blob) break;
    }
    if (!blob || blob.type !== "image/webp" || blob.size > MAX_SCREENSHOT_BYTES) {
      throw new Error("webp-conversion-failed");
    }

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "screenshot"}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

function ScoreEntryFormContent({
  initialSong,
  initialChartId,
}: {
  initialSong: SongOption | null;
  initialChartId: number;
}) {
  const t = useTranslations("scores");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [today, setToday] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const [screenshotError, setScreenshotError] = useState("");
  const screenshotInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const schema = useMemo(() => {
    const count = z.number({ invalid_type_error: t("validation.numberRequired") })
      .int(t("validation.integer"))
      .min(0, t("validation.nonnegative"));
    const grade = z.enum(SCORE_GRADES, {
      required_error: t("validation.gradeRequired"),
    });

    return z.object({
      stepchartId: z.number({ invalid_type_error: t("validation.chooseChart") })
        .int(t("validation.chooseChart"))
        .positive(t("validation.chooseChart")),
      score: z.number({ invalid_type_error: t("validation.numberRequired") })
        .int(t("validation.integer"))
        .min(0, t("validation.scoreRange"))
        .max(1_000_000, t("validation.scoreRange")),
      grade,
      perfect: count,
      great: count,
      good: count,
      bad: count,
      miss: count,
      maxCombo: count,
      playedAt: z.string()
        .min(1, t("validation.dateRequired"))
        .refine(validCalendarDate, t("validation.dateInvalid"))
        .refine((value) => !validCalendarDate(value) || value <= todayLocalDate(), t("validation.dateFuture")),
      videoUrl: z.string().trim().refine(
        (value) => !value || YOUTUBE_URL.test(value) || YOUTUBE_SHORT_URL.test(value) || YOUTUBE_SHORTS_URL.test(value),
        t("validation.youtubeUrl"),
      ),
      note: z.string().max(500, t("validation.noteLength")),
      plate: z.union([z.enum(SCORE_PLATES), z.literal("")]),
      stagePass: z.boolean(),
    }).superRefine((values, context) => {
      if (!values.stagePass && values.plate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plate"],
          message: t("validation.failedStagePlate"),
        });
      }
    });
  }, [t]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      stepchartId: initialChartId,
      score: undefined,
      grade: "F",
      perfect: 0,
      great: 0,
      good: 0,
      bad: 0,
      miss: 0,
      maxCombo: 0,
      playedAt: "",
      videoUrl: "",
      note: "",
      plate: "",
      stagePass: true,
    },
  });
  const { setValue } = form;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const localToday = todayLocalDate();
      setToday(localToday);
      setValue("playedAt", localToday);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [setValue]);

  const stagePass = useWatch({ control: form.control, name: "stagePass" });
  const selectedChartId = useWatch({ control: form.control, name: "stepchartId" });
  const errors = form.formState.errors;

  function fieldError(name: keyof typeof errors): string | undefined {
    const message = errors[name]?.message;
    return typeof message === "string" ? message : undefined;
  }

  async function onScreenshotChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScreenshotError("");
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setScreenshotError(t("validation.imageType"));
      event.target.value = "";
      return;
    }

    setIsResizing(true);
    try {
      const resized = await resizeScreenshot(file);
      setScreenshot(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch {
      setScreenshotError(t("validation.imageProcessing"));
      setScreenshot(null);
      setPreviewUrl("");
      event.target.value = "";
    } finally {
      setIsResizing(false);
    }
  }

  function removeScreenshot() {
    setScreenshot(null);
    setPreviewUrl("");
    setScreenshotError("");
    if (screenshotInput.current) screenshotInput.current.value = "";
  }

  async function cleanupUploadedScreenshot(path: string): Promise<boolean> {
    try {
      const { error } = await createClient()
        .storage.from("score-screenshots")
        .remove([path]);
      return !error;
    } catch {
      return false;
    }
  }

  async function onSubmit(values: z.infer<typeof schema>) {
    setFormError("");
    setScreenshotError("");
    setIsSubmitting(true);
    const supabase = createClient();
    let screenshotPath: string | null = null;

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setFormError(t("errors.sessionExpired"));
        return;
      }

      if (screenshot) {
        screenshotPath = `${authData.user.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("score-screenshots")
          .upload(screenshotPath, screenshot, {
            contentType: "image/webp",
            upsert: false,
          });
        if (uploadError) {
          const cleaned = await cleanupUploadedScreenshot(screenshotPath);
          setScreenshotError(t(cleaned ? "errors.screenshotUpload" : "errors.orphanCleanup"));
          return;
        }
      }

      const playedAt = new Date(`${values.playedAt}T00:00:00`).toISOString();
      const { error: insertError } = await supabase.from("scores").insert({
        user_id: authData.user.id,
        stepchart_id: values.stepchartId,
        score: values.score,
        grade: values.grade,
        perfect: values.perfect,
        great: values.great,
        good: values.good,
        bad: values.bad,
        miss: values.miss,
        max_combo: values.maxCombo,
        video_url: values.videoUrl.trim() || null,
        played_at: playedAt,
        note: values.note.trim() || null,
        plate: values.stagePass && values.plate ? values.plate : null,
        stage_pass: values.stagePass,
        screenshot_path: screenshotPath,
      });

      if (insertError) {
        if (screenshotPath) {
          const cleaned = await cleanupUploadedScreenshot(screenshotPath);
          if (!cleaned) setScreenshotError(t("errors.orphanCleanup"));
        }
        if (insertError.code === "23514") {
          setFormError(t("errors.validation"));
        } else if (insertError.code === "23503") {
          setFormError(t("errors.invalidChart"));
        } else if (insertError.code === "42501") {
          setFormError(t("errors.permission"));
        } else {
          setFormError(t("errors.generic"));
        }
        return;
      }

      toast.success(t("toasts.saved"));
      router.replace("/dashboard");
    } catch {
      if (screenshotPath) {
        const cleaned = await cleanupUploadedScreenshot(screenshotPath);
        if (!cleaned) setScreenshotError(t("errors.orphanCleanup"));
      }
      setFormError(t("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="font-display text-xl">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <input type="hidden" {...form.register("stepchartId", { valueAsNumber: true })} />
          <SongChartPicker
            initialSong={initialSong}
            selectedChartId={selectedChartId}
            onChartChange={(chartId) => {
              form.setValue("stepchartId", chartId, { shouldDirty: true, shouldValidate: true });
              form.clearErrors("stepchartId");
            }}
            error={fieldError("stepchartId")}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="score">{t("fields.score")}</Label>
              <Input id="score" type="number" min="0" max="1000000" step="1" inputMode="numeric"
                aria-invalid={!!errors.score} aria-describedby={errors.score ? "score-error" : undefined}
                {...form.register("score", { valueAsNumber: true })} />
              <FieldError id="score-error" message={fieldError("score")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">{t("fields.grade")}</Label>
              <select id="grade" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-invalid={!!errors.grade} aria-describedby={errors.grade ? "grade-error" : undefined}
                {...form.register("grade")}>
                {SCORE_GRADES.map((grade) => <option key={grade} value={grade}>{t(`grades.${grade}`)}</option>)}
              </select>
              <FieldError id="grade-error" message={fieldError("grade")} />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t("fields.judgments")}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                ["perfect", "fields.perfect"], ["great", "fields.great"],
                ["good", "fields.good"], ["bad", "fields.bad"],
                ["miss", "fields.miss"], ["maxCombo", "fields.maxCombo"],
              ] as const).map(([name, labelKey]) => {
                const id = `score-${name}`;
                const error = fieldError(name);
                return (
                  <div key={name} className="space-y-2">
                    <Label htmlFor={id}>{t(labelKey)}</Label>
                    <Input id={id} type="number" min="0" step="1" inputMode="numeric"
                      aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
                      {...form.register(name, { valueAsNumber: true })} />
                    <FieldError id={`${id}-error`} message={error} />
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="played-at">{t("fields.playedAt")}</Label>
              <Input id="played-at" type="date" max={today || undefined}
                aria-invalid={!!errors.playedAt} aria-describedby={errors.playedAt ? "played-at-error" : undefined}
                {...form.register("playedAt")} />
              <FieldError id="played-at-error" message={fieldError("playedAt")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-url">{t("fields.videoUrl")}</Label>
              <Input id="video-url" type="url" placeholder="https://youtu.be/…"
                aria-invalid={!!errors.videoUrl} aria-describedby={errors.videoUrl ? "video-url-error" : undefined}
                {...form.register("videoUrl")} />
              <FieldError id="video-url-error" message={fieldError("videoUrl")} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Input id="stage-pass" type="checkbox" className="size-4 accent-primary"
                {...form.register("stagePass", {
                  onChange: (event) => {
                    if (!event.target.checked) {
                      form.setValue("plate", "", { shouldValidate: true });
                    }
                  },
                })} />
              <Label htmlFor="stage-pass">{t("fields.stagePass")}</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate">{t("fields.plate")}</Label>
              <select id="plate" disabled={!stagePass}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-invalid={!!errors.plate} aria-describedby={errors.plate ? "plate-error" : undefined}
                {...form.register("plate")}>
                <option value="">{t("fields.plateNone")}</option>
                {SCORE_PLATES.map((plate) => <option key={plate} value={plate}>{t(`plates.${plate}`)}</option>)}
              </select>
              <FieldError id="plate-error" message={fieldError("plate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">{t("fields.note")}</Label>
            <textarea id="note" maxLength={500} rows={4}
              className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
              aria-invalid={!!errors.note} aria-describedby={errors.note ? "note-error" : undefined}
              {...form.register("note")} />
            <FieldError id="note-error" message={fieldError("note")} />
          </div>

          <div className="space-y-3">
            <Label htmlFor="screenshot">{t("fields.screenshot")}</Label>
            <Input ref={screenshotInput} id="screenshot" type="file" accept="image/webp,image/jpeg,image/png"
              disabled={isResizing || isSubmitting} onChange={onScreenshotChange}
              aria-describedby={screenshotError ? "screenshot-error" : "screenshot-help"}
              aria-invalid={!!screenshotError} />
            <p id="screenshot-help" className="text-sm text-muted-foreground">{t("fields.screenshotHelp")}</p>
            {isResizing ? <p role="status" className="text-sm text-muted-foreground">{t("fields.resizing")}</p> : null}
            {screenshotError ? <p id="screenshot-error" role="alert" className="text-sm text-destructive">{screenshotError}</p> : null}
            {screenshot && previewUrl ? (
              <div className="flex flex-wrap items-start gap-3">
                {/* This local preview is an object URL and is revoked when it changes or unmounts. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={t("fields.screenshotPreview")} className="max-h-48 max-w-full rounded-md border object-contain" />
                <Button type="button" variant="outline" size="sm" onClick={removeScreenshot} aria-label={t("fields.removeScreenshot")}>
                  <X aria-hidden="true" />
                  {t("fields.removeScreenshot")}
                </Button>
              </div>
            ) : null}
          </div>

          {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting || isResizing}>
            {isSubmitting ? <><Loader2 aria-hidden="true" className="animate-spin" />{t("submit.saving")}</> : t("submit.label")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ScoreEntryForm(props: {
  initialSong: SongOption | null;
  initialChartId: number;
}) {
  const locale = useLocale();
  return <ScoreEntryFormContent key={locale} {...props} />;
}
