"use client";

import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  createTokenClient,
  deleteYouTubeVideo,
  loadGoogleOAuth,
  YOUTUBE_PLAYLIST_SCOPE,
  youtubeVideoUrl,
  type AccessToken,
} from "@/lib/youtube/upload";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
// youtube.force-ssl, the manage-account scope, is what videos.delete accepts.
const DELETE_SCOPE = YOUTUBE_PLAYLIST_SCOPE;

type Phase = "idle" | "signingIn" | "deleting";

/**
 * The score's YouTube video, with a button that deletes only the video. A score
 * holds one video, so a new one can be uploaded once this one is gone.
 */
export function YouTubeVideoPanel({
  videoId,
  uploaded,
  scoreId,
  disabled,
  onDeleted,
}: {
  videoId: string;
  /** PumpDiary uploaded the video, so it is on the player's channel. */
  uploaded: boolean;
  /** Set when editing a saved score: its link is cleared as soon as the video is gone. */
  scoreId?: number;
  disabled?: boolean;
  onDeleted: () => void;
}) {
  const t = useTranslations("scores.youtube");
  const td = useTranslations("scores.detail");
  const dialog = useRef<HTMLDialogElement>(null);
  const tokenClient = useRef<{ requestAccessToken: () => void } | null>(null);
  const onToken = useRef<(token: AccessToken) => void>(() => {});
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const busy = phase !== "idle";

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  // The Google popup has to open straight from the click, so the script is loaded when the dialog opens.
  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID || tokenClient.current) return;
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
            setError(t("errors.signIn"));
          },
          DELETE_SCOPE,
        );
      })
      .catch(() => {
        if (active) setError(t("errors.unavailable"));
      });
    return () => {
      active = false;
    };
  }, [open, t]);

  async function removeVideo(token: AccessToken) {
    setPhase("deleting");
    try {
      await deleteYouTubeVideo(token.value, videoId);
    } catch {
      setPhase("idle");
      setError(t("videoDeleteFailed"));
      return;
    }
    let linkCleared = true;
    if (scoreId !== undefined) {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const { error: updateError } = authData.user
        ? await supabase
          .from("scores")
          .update({ video_url: null, youtube_video_id: null })
          .eq("id", scoreId)
          .eq("user_id", authData.user.id)
        : { error: new Error("signed-out") };
      linkCleared = !updateError;
    }
    if (linkCleared) toast.success(t("videoDeleted"));
    else toast.error(t("videoDeletedNotSaved"));
    setPhase("idle");
    setOpen(false);
    onDeleted();
  }

  useEffect(() => {
    onToken.current = (token) => void removeVideo(token);
  });

  function confirm() {
    setError("");
    if (!tokenClient.current) {
      setError(t("errors.unavailable"));
      return;
    }
    setPhase("signingIn");
    tokenClient.current.requestAccessToken();
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setError("");
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{t("currentVideo")}</p>
      <div className="relative aspect-video overflow-hidden rounded-md border bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={t("currentVideo")}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {td("videoHint")}{" "}
        <a href={youtubeVideoUrl(videoId)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          {td("openOnYouTube")}<ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {GOOGLE_CLIENT_ID ? (
          <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}
            className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 aria-hidden="true" />
            {t("deleteVideo")}
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("replaceHint")}</p>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="delete-video-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        className="pointer-events-auto fixed inset-0 m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/60"
      >
        <div className="space-y-4">
          <h2 id="delete-video-title" className="text-lg font-semibold">{t("deleteVideoTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("deleteVideoBody")}</p>
          <p className="text-xs text-muted-foreground">{td(uploaded ? "deleteVideoHelp" : "deleteLinkedVideoHelp")}</p>
          {phase === "signingIn" ? <p role="status" className="text-sm text-muted-foreground">{t("signingIn")}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={busy}>{td("cancel")}</Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? <><Loader2 aria-hidden="true" className="animate-spin" />{t("deletingVideo")}</> : t("confirmDeleteVideo")}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
