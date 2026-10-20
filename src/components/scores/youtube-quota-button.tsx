"use client";

import { Gauge, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DAILY_UNIT_LIMIT, DAILY_UPLOAD_LIMIT, fetchYouTubeQuota, type YouTubeQuota } from "@/lib/youtube/quota";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; quota: YouTubeQuota };

/** A button that opens a popup with an estimate of today's YouTube uploads left. */
export function YouTubeQuotaButton({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("scores.youtube.quota");
  const format = useFormatter();
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  async function check() {
    const current = ++request.current;
    setState({ kind: "loading" });
    setOpen(true);
    try {
      const quota = await fetchYouTubeQuota();
      if (current === request.current) setState({ kind: "ready", quota });
    } catch {
      if (current === request.current) setState({ kind: "error" });
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void check()}>
        <Gauge aria-hidden="true" />
        {t("button")}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="youtube-quota-title"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        className="pointer-events-auto fixed inset-0 m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/60"
      >
        <div className="space-y-4">
          <h2 id="youtube-quota-title" className="text-lg font-semibold">{t("title")}</h2>
          {state.kind === "loading" ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {t("loading")}
            </p>
          ) : state.kind === "error" ? (
            <p role="alert" className="text-sm text-destructive">{t("error")}</p>
          ) : (
            <div role="status" className="space-y-3">
              <p className={`font-display text-2xl font-bold ${state.quota.clipsLeft > 0 ? "text-success" : "text-destructive"}`}>
                {t("clipsLeft", { count: state.quota.clipsLeft })}
              </p>
              <ul className="space-y-1 text-sm">
                <li>{t("uploads", { used: format.number(state.quota.uploads), limit: format.number(DAILY_UPLOAD_LIMIT) })}</li>
                <li>{t("units", { used: format.number(state.quota.units), limit: format.number(DAILY_UNIT_LIMIT) })}</li>
                <li>{t("resets", { time: format.dateTime(state.quota.resetsAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}</li>
              </ul>
              <p className="text-xs text-muted-foreground">{t("note")}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("close")}</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
