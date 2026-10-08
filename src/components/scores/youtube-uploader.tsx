"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTokenClient,
  loadGoogleOAuth,
  uploadToYouTube,
  youtubeVideoUrl,
  YouTubeUploadError,
  YOUTUBE_PRIVACY_STATUSES,
  type AccessToken,
  type YouTubePrivacyStatus,
} from "@/lib/youtube/upload";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Status =
  | { kind: "idle" }
  | { kind: "signingIn" }
  | { kind: "uploading"; percent: number }
  | { kind: "done"; lockedPrivate: boolean }
  | { kind: "error"; key: string };

export function YouTubeUploader({
  title,
  disabled,
  onUploaded,
  onBusyChange,
}: {
  title: string;
  disabled?: boolean;
  onUploaded: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations("scores.youtube");
  const [file, setFile] = useState<File | null>(null);
  const [privacy, setPrivacy] = useState<YouTubePrivacyStatus>("unlisted");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isReady, setIsReady] = useState(false);
  const tokenClient = useRef<{ requestAccessToken: () => void } | null>(null);
  const token = useRef<AccessToken | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const startUpload = useRef<(accessToken: string) => void>(() => {});

  const busy = status.kind === "signingIn" || status.kind === "uploading";

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => () => abortController.current?.abort(), []);

  // Load Google's script up front: the sign-in popup must open directly from
  // the click, with no network wait in between.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let active = true;
    loadGoogleOAuth()
      .then((oauth2) => {
        if (!active) return;
        tokenClient.current = createTokenClient(
          oauth2,
          GOOGLE_CLIENT_ID,
          (accessToken) => {
            token.current = accessToken;
            startUpload.current(accessToken.value);
          },
          () => setStatus({ kind: "error", key: "errors.signIn" }),
        );
        setIsReady(true);
      })
      .catch(() => {
        if (active) setStatus({ kind: "error", key: "errors.unavailable" });
      });
    return () => {
      active = false;
    };
  }, []);

  async function runUpload(accessToken: string) {
    if (!file) return;
    const controller = new AbortController();
    abortController.current = controller;
    setStatus({ kind: "uploading", percent: 0 });
    try {
      const result = await uploadToYouTube({
        token: accessToken,
        file,
        title,
        privacyStatus: privacy,
        signal: controller.signal,
        onProgress: (fraction) => setStatus({ kind: "uploading", percent: Math.floor(fraction * 100) }),
      });
      onUploaded(youtubeVideoUrl(result.id));
      setStatus({ kind: "done", lockedPrivate: result.privacyStatus === "private" && privacy !== "private" });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      const code = error instanceof YouTubeUploadError ? error.code : "generic";
      if (code === "auth") token.current = null;
      setStatus(code === "aborted" ? { kind: "idle" } : { kind: "error", key: `errors.${code}` });
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  }

  useEffect(() => {
    startUpload.current = runUpload;
  });

  if (!GOOGLE_CLIENT_ID) return null;

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (chosen && !chosen.type.startsWith("video/")) {
      setFile(null);
      setStatus({ kind: "error", key: "errors.fileType" });
      event.target.value = "";
      return;
    }
    setFile(chosen);
    setStatus({ kind: "idle" });
  }

  function onUploadClick() {
    if (!file) {
      setStatus({ kind: "error", key: "errors.chooseFile" });
      return;
    }
    if (token.current && token.current.expiresAt > Date.now()) {
      void runUpload(token.current.value);
      return;
    }
    setStatus({ kind: "signingIn" });
    tokenClient.current?.requestAccessToken();
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p id="youtube-upload-help" className="text-sm text-muted-foreground">{t("help")}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="youtube-file">{t("file")}</Label>
          <Input ref={fileInput} id="youtube-file" type="file" accept="video/*"
            disabled={disabled || busy} onChange={onFileChange} aria-describedby="youtube-upload-help" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="youtube-privacy">{t("privacy")}</Label>
          <select id="youtube-privacy" value={privacy} disabled={disabled || busy}
            onChange={(event) => setPrivacy(event.target.value as YouTubePrivacyStatus)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {YOUTUBE_PRIVACY_STATUSES.map((value) => (
              <option key={value} value={value}>{t(`privacyOptions.${value}`)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onUploadClick} disabled={disabled || busy || !isReady || !file}>
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
          {t("upload")}
        </Button>
        {status.kind === "uploading" ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => abortController.current?.abort()}>
            <X aria-hidden="true" />
            {t("cancel")}
          </Button>
        ) : null}
      </div>
      {status.kind === "uploading" ? (
        <div className="space-y-1">
          <div role="progressbar" aria-label={t("progressLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.percent}
            className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${status.percent}%` }} />
          </div>
          <p role="status" className="text-sm text-muted-foreground">{t("uploading", { percent: status.percent })}</p>
        </div>
      ) : null}
      {status.kind === "signingIn" ? <p role="status" className="text-sm text-muted-foreground">{t("signingIn")}</p> : null}
      {status.kind === "done" ? (
        <div role="status" className="space-y-1 text-sm text-muted-foreground">
          <p>{t("done")}</p>
          {status.lockedPrivate ? <p>{t("lockedPrivate")}</p> : null}
        </div>
      ) : null}
      {status.kind === "error" ? <p role="alert" className="text-sm text-destructive">{t(status.key)}</p> : null}
    </div>
  );
}
