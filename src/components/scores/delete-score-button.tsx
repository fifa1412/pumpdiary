"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  createTokenClient,
  deleteYouTubeVideo,
  loadGoogleOAuth,
  YOUTUBE_PLAYLIST_SCOPE,
  type AccessToken,
} from "@/lib/youtube/upload";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
// youtube.force-ssl, the manage-account scope, is what videos.delete accepts.
const DELETE_SCOPE = YOUTUBE_PLAYLIST_SCOPE;
const TRIGGER_CLASS = "border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive";

type Phase = "idle" | "signingIn" | "deletingVideo" | "deletingScore" | "videoFailed";

export function DeleteScoreButton({
  scoreId,
  screenshotPath,
  youtubeVideoId,
  label,
  compact = false,
  className,
}: {
  scoreId: number;
  screenshotPath: string | null;
  /** Set only for a video PumpDiary uploaded; other links are never deleted. */
  youtubeVideoId: string | null;
  /** Which play is being deleted, e.g. "Odin S20 - Score 995,416". */
  label: string;
  /** Icon-only trigger for tight spots such as dashboard cards. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("scores.detail");
  const ty = useTranslations("scores.youtube");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const tokenClient = useRef<{ requestAccessToken: () => void } | null>(null);
  const onToken = useRef<(token: AccessToken) => void>(() => {});
  const [open, setOpen] = useState(false);
  const [alsoDeleteVideo, setAlsoDeleteVideo] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const canDeleteVideo = Boolean(youtubeVideoId && GOOGLE_CLIENT_ID);
  const busy = phase === "signingIn" || phase === "deletingVideo" || phase === "deletingScore";

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  // The Google popup has to open straight from the click, so the script is loaded when the dialog opens.
  useEffect(() => {
    if (!open || !canDeleteVideo || tokenClient.current) return;
    let active = true;
    loadGoogleOAuth()
      .then((oauth2) => {
        if (!active) return;
        tokenClient.current = createTokenClient(
          oauth2,
          GOOGLE_CLIENT_ID,
          (token) => onToken.current(token),
          () => {
            setPhase("idle");
            setError(ty("errors.signIn"));
          },
          DELETE_SCOPE,
        );
      })
      .catch(() => {
        if (active) setError(ty("errors.unavailable"));
      });
    return () => {
      active = false;
    };
  }, [open, canDeleteVideo, ty]);

  async function removeScore(videoDeleted: boolean) {
    setPhase("deletingScore");
    setError("");
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("signed-out");
      const { data, error: deleteError } = await supabase
        .from("scores")
        .delete()
        .eq("id", scoreId)
        .eq("user_id", authData.user.id)
        .select("id")
        .maybeSingle();
      if (deleteError || !data) throw new Error("delete-failed");
      // A leftover screenshot is only wasted storage; the score is already gone.
      if (screenshotPath) await supabase.storage.from("score-screenshots").remove([screenshotPath]).catch(() => undefined);
      toast.success(t(videoDeleted ? "deletedWithVideo" : "deleted"));
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setPhase("idle");
      setError(t("deleteError"));
    }
  }

  async function removeVideo(token: AccessToken) {
    if (!youtubeVideoId) return;
    setPhase("deletingVideo");
    try {
      await deleteYouTubeVideo(token.value, youtubeVideoId);
    } catch {
      setPhase("videoFailed");
      return;
    }
    await removeScore(true);
  }

  useEffect(() => {
    onToken.current = (token) => void removeVideo(token);
  });

  function confirm() {
    setError("");
    if (alsoDeleteVideo && canDeleteVideo) {
      if (!tokenClient.current) {
        setError(ty("errors.unavailable"));
        return;
      }
      setPhase("signingIn");
      tokenClient.current.requestAccessToken();
      return;
    }
    void removeScore(false);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setPhase("idle");
    setError("");
  }

  return (
    <>
      {compact ? (
        <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)}
          aria-label={t("delete")} title={t("delete")} className={cn(TRIGGER_CLASS, className)}>
          <Trash2 aria-hidden="true" />
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className={cn(TRIGGER_CLASS, className)}>
          <Trash2 aria-hidden="true" />
          {t("delete")}
        </Button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="delete-score-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        className="pointer-events-auto fixed inset-0 m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/60"
      >
        <div className="space-y-4">
          <h2 id="delete-score-title" className="text-lg font-semibold">{t("deleteTitle")}</h2>
          <p className="rounded-md border bg-surface-deep px-3 py-2 font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">{t("deleteBody")}</p>
          {canDeleteVideo ? (
            <div className="space-y-1 rounded-md border p-3">
              <div className="flex items-center gap-3">
                <Input id="delete-video" type="checkbox" className="size-4 accent-primary" checked={alsoDeleteVideo}
                  disabled={busy} onChange={(event) => setAlsoDeleteVideo(event.target.checked)} />
                <Label htmlFor="delete-video">{t("deleteVideo")}</Label>
              </div>
              <p className="text-xs text-muted-foreground">{t("deleteVideoHelp")}</p>
            </div>
          ) : null}
          {phase === "signingIn" ? <p role="status" className="text-sm text-muted-foreground">{ty("signingIn")}</p> : null}
          {phase === "videoFailed" ? <p role="alert" className="text-sm text-destructive">{t("videoDeleteFailed")}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>{t("cancel")}</Button>
            {phase === "videoFailed" ? (
              <Button type="button" variant="destructive" onClick={() => void removeScore(false)}>{t("deleteScoreOnly")}</Button>
            ) : (
              <Button type="button" variant="destructive" onClick={confirm} disabled={busy}>
                {busy ? <><Loader2 aria-hidden="true" className="animate-spin" />{t("deleting")}</> : t("confirmDelete")}
              </Button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
