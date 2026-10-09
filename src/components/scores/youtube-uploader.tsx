"use client";

import { Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addToPlaylist,
  createTokenClient,
  loadGoogleOAuth,
  uploadToYouTube,
  youtubeTags,
  youtubeVideoUrl,
  YouTubeUploadError,
  YOUTUBE_PLAYLIST_SCOPE,
  YOUTUBE_PRIVACY_STATUSES,
  YOUTUBE_UPLOAD_SCOPE,
  type AccessToken,
  type YouTubePrivacyStatus,
} from "@/lib/youtube/upload";

import { TagInput } from "./tag-input";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Status =
  | { kind: "idle" }
  | { kind: "signingIn" }
  | { kind: "uploading"; percent: number }
  | { kind: "addingToPlaylist" }
  | { kind: "done"; lockedPrivate: boolean; playlist?: { outcome: "added" | "created" | "failed" | "notAllowed"; title: string } }
  | { kind: "error"; key: string };

export function YouTubeUploader({
  suggestedTitle,
  suggestedDescription,
  suggestedTags,
  suggestedPlaylist,
  disabled,
  onUploaded,
  onBusyChange,
}: {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedTags: string[];
  suggestedPlaylist: string;
  disabled?: boolean;
  onUploaded: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations("scores.youtube");
  const [file, setFile] = useState<File | null>(null);
  const [privacy, setPrivacy] = useState<YouTubePrivacyStatus>("public");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isReady, setIsReady] = useState(false);
  // The title and description follow the score form until the player edits them.
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [descriptionOverride, setDescriptionOverride] = useState<string | null>(null);
  const title = titleOverride ?? suggestedTitle;
  const description = descriptionOverride ?? suggestedDescription;
  const [tagsOverride, setTagsOverride] = useState<string[] | null>(null);
  const tags = tagsOverride ?? youtubeTags(suggestedTags);
  const [usePlaylist, setUsePlaylist] = useState(true);
  const [playlistOverride, setPlaylistOverride] = useState<string | null>(null);
  const playlist = playlistOverride ?? suggestedPlaylist;
  const tokenClient = useRef<{ requestAccessToken: (overrides?: { scope?: string }) => void } | null>(null);
  const token = useRef<AccessToken | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const startUpload = useRef<(accessToken: AccessToken) => void>(() => {});

  const busy = status.kind === "signingIn" || status.kind === "uploading" || status.kind === "addingToPlaylist";

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
            startUpload.current(accessToken);
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

  async function runUpload(accessToken: AccessToken) {
    if (!file) return;
    const controller = new AbortController();
    abortController.current = controller;
    setStatus({ kind: "uploading", percent: 0 });
    try {
      const result = await uploadToYouTube({
        token: accessToken.value,
        file,
        title,
        description,
        tags,
        privacyStatus: privacy,
        signal: controller.signal,
        onProgress: (fraction) => setStatus({ kind: "uploading", percent: Math.floor(fraction * 100) }),
      });
      onUploaded(youtubeVideoUrl(result.id));
      const lockedPrivate = result.privacyStatus === "private" && privacy !== "private";
      let playlistResult: Extract<Status, { kind: "done" }>["playlist"];
      const playlistTitle = playlist.trim();
      if (usePlaylist && playlistTitle) {
        if (accessToken.scopes.includes(YOUTUBE_PLAYLIST_SCOPE)) {
          setStatus({ kind: "addingToPlaylist" });
          try {
            const { created } = await addToPlaylist({
              token: accessToken.value, videoId: result.id, playlistTitle, privacyStatus: privacy,
            });
            playlistResult = { outcome: created ? "created" : "added", title: playlistTitle };
          } catch {
            playlistResult = { outcome: "failed", title: playlistTitle };
          }
        } else {
          playlistResult = { outcome: "notAllowed", title: playlistTitle };
        }
      }
      setStatus({ kind: "done", lockedPrivate, playlist: playlistResult });
      setFile(null);
      setTitleOverride(null);
      setDescriptionOverride(null);
      setTagsOverride(null);
      setPlaylistOverride(null);
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
    const scopes = usePlaylist && playlist.trim() ? [YOUTUBE_UPLOAD_SCOPE, YOUTUBE_PLAYLIST_SCOPE] : [YOUTUBE_UPLOAD_SCOPE];
    const current = token.current;
    if (current && current.expiresAt > Date.now() && scopes.every((scope) => current.scopes.includes(scope))) {
      void runUpload(current);
      return;
    }
    setStatus({ kind: "signingIn" });
    tokenClient.current?.requestAccessToken({ scope: scopes.join(" ") });
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
      {file ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="youtube-title">{t("videoTitle")}</Label>
            <Input id="youtube-title" value={title} maxLength={100} disabled={disabled || busy}
              onChange={(event) => setTitleOverride(event.target.value)} aria-describedby="youtube-text-help" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube-description">{t("videoDescription")}</Label>
            <textarea id="youtube-description" value={description} rows={5} maxLength={5000} disabled={disabled || busy}
              onChange={(event) => setDescriptionOverride(event.target.value)} aria-describedby="youtube-text-help"
              className="w-full min-w-0 rounded-md border border-input bg-surface-deep px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube-tags">{t("videoTags")}</Label>
            <TagInput id="youtube-tags" tags={tags} onChange={setTagsOverride} disabled={disabled || busy}
              placeholder={t("addTag")} removeLabel={(tag) => t("removeTag", { tag })}
              describedBy="youtube-tags-help" />
            <p id="youtube-tags-help" className="text-xs text-muted-foreground">{t("tagsHelp")}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Input id="youtube-use-playlist" type="checkbox" className="size-4 accent-primary" checked={usePlaylist}
                disabled={disabled || busy} onChange={(event) => setUsePlaylist(event.target.checked)} />
              <Label htmlFor="youtube-use-playlist">{t("addToPlaylist")}</Label>
            </div>
            {usePlaylist ? (
              <div className="space-y-2">
                <Label htmlFor="youtube-playlist" className="sr-only">{t("playlistName")}</Label>
                <Input id="youtube-playlist" value={playlist} maxLength={150} disabled={disabled || busy}
                  onChange={(event) => setPlaylistOverride(event.target.value)} aria-describedby="youtube-playlist-help" />
                <p id="youtube-playlist-help" className="text-xs text-muted-foreground">{t("playlistHelp")}</p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p id="youtube-text-help" className="text-sm text-muted-foreground">{t("textHelp")}</p>
            {titleOverride !== null || descriptionOverride !== null || tagsOverride !== null || playlistOverride !== null ? (
              <Button type="button" variant="ghost" size="sm" disabled={disabled || busy}
                onClick={() => {
                  setTitleOverride(null);
                  setDescriptionOverride(null);
                  setTagsOverride(null);
                  setPlaylistOverride(null);
                }}>
                {t("resetText")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
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
      {status.kind === "addingToPlaylist" ? <p role="status" className="text-sm text-muted-foreground">{t("addingToPlaylist")}</p> : null}
      {status.kind === "done" ? (
        <div role="status" className="space-y-1 text-sm text-muted-foreground">
          <p>{t("done")}</p>
          {status.lockedPrivate ? <p>{t("lockedPrivate")}</p> : null}
          {status.playlist ? (
            <p className={status.playlist.outcome === "failed" || status.playlist.outcome === "notAllowed" ? "text-destructive" : undefined}>
              {t(`playlist.${status.playlist.outcome}`, { title: status.playlist.title })}
            </p>
          ) : null}
        </div>
      ) : null}
      {status.kind === "error" ? <p role="alert" className="text-sm text-destructive">{t(status.key)}</p> : null}
    </div>
  );
}
