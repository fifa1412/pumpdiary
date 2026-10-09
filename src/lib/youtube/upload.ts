// Uploads a video from the browser straight to the signed-in player's own
// YouTube channel. Google Identity Services hands out a short-lived access
// token for the youtube.upload scope; nothing is stored on our server. The
// file goes over YouTube's resumable upload protocol so a dropped connection
// picks up where it stopped instead of starting over.

export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const GAMING_CATEGORY_ID = "20";
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_BYTES = 5000;
export const MAX_TAGS_LENGTH = 500;
const MAX_RETRIES = 5;

export const YOUTUBE_PRIVACY_STATUSES = ["public", "unlisted", "private"] as const;
export type YouTubePrivacyStatus = (typeof YOUTUBE_PRIVACY_STATUSES)[number];

export type YouTubeUploadErrorCode = "auth" | "noChannel" | "quota" | "network" | "aborted" | "generic";

export class YouTubeUploadError extends Error {
  constructor(readonly code: YouTubeUploadErrorCode) {
    super(code);
  }
}

export type YouTubeUploadResult = {
  id: string;
  privacyStatus: YouTubePrivacyStatus;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

type TokenClient = {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
};

type GoogleOAuth = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
  }) => TokenClient;
  hasGrantedAllScopes: (response: TokenResponse, ...scopes: string[]) => boolean;
};

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

let gisScript: Promise<GoogleOAuth> | null = null;

export function loadGoogleOAuth(): Promise<GoogleOAuth> {
  gisScript ??= new Promise<GoogleOAuth>((resolve, reject) => {
    const ready = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error("gis-unavailable"));
    };
    if (window.google?.accounts?.oauth2) {
      ready();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error("gis-load-failed"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    gisScript = null;
    throw error;
  });
  return gisScript;
}

export type AccessToken = { value: string; expiresAt: number };

// The callback runs once per requestAccessToken() call. requestAccessToken()
// opens a popup, so it has to run straight from a click handler.
export function createTokenClient(
  oauth2: GoogleOAuth,
  clientId: string,
  onToken: (token: AccessToken) => void,
  onError: () => void,
): TokenClient {
  return oauth2.initTokenClient({
    client_id: clientId,
    scope: YOUTUBE_UPLOAD_SCOPE,
    callback: (response) => {
      if (response.error || !response.access_token
        || !oauth2.hasGrantedAllScopes(response, YOUTUBE_UPLOAD_SCOPE)) {
        onError();
        return;
      }
      // Treat the token as expired a minute early so an upload never starts on a dying token.
      const lifetime = Math.max(0, (response.expires_in ?? 0) - 60) * 1000;
      onToken({ value: response.access_token, expiresAt: Date.now() + lifetime });
    },
    error_callback: onError,
  });
}

export function youtubeVideoUrl(id: string): string {
  return `https://youtu.be/${id}`;
}

export function youtubeTitle(title: string): string {
  // YouTube rejects angle brackets in titles and caps them at 100 characters.
  const cleaned = title.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return Array.from(cleaned).slice(0, MAX_TITLE_LENGTH).join("") || "PumpDiary";
}

export function youtubeDescription(description: string): string {
  // Angle brackets are rejected here too, and the limit is 5000 UTF-8 bytes.
  const encoder = new TextEncoder();
  let bytes = 0;
  let result = "";
  for (const char of description.replace(/[<>]/g, "").trim()) {
    bytes += encoder.encode(char).length;
    if (bytes > MAX_DESCRIPTION_BYTES) break;
    result += char;
  }
  return result;
}

/** A tag as YouTube accepts it: no angle brackets or commas, single spaces. */
export function cleanTag(raw: string): string {
  return raw.replace(/[<>,]/g, "").replace(/\s+/g, " ").trim();
}

function tagCost(tag: string, index: number): number {
  return Array.from(tag).length + (tag.includes(" ") ? 2 : 0) + (index > 0 ? 1 : 0);
}

/**
 * Length YouTube counts against its 500-character tag limit: a comma between
 * tags and quotes around any tag that contains a space.
 */
export function tagsLength(tags: string[]): number {
  return tags.reduce((sum, tag, index) => sum + tagCost(tag, index), 0);
}

/** Cleaned, de-duplicated tags cut to YouTube's total length limit. */
export function youtubeTags(tags: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  let length = 0;
  for (const raw of tags) {
    const tag = cleanTag(raw);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    const cost = tagCost(tag, result.length);
    if (length + cost > MAX_TAGS_LENGTH) break;
    seen.add(key);
    result.push(tag);
    length += cost;
  }
  return result;
}

async function errorCode(status: number, body: string): Promise<YouTubeUploadErrorCode> {
  let reason = "";
  try {
    reason = JSON.parse(body)?.error?.errors?.[0]?.reason ?? "";
  } catch {
    // Not JSON; fall back to the status code.
  }
  if (reason === "youtubeSignupRequired") return "noChannel";
  if (reason === "quotaExceeded" || reason === "uploadLimitExceeded" || reason === "rateLimitExceeded") return "quota";
  if (status === 401 || status === 403) return "auth";
  return "generic";
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new YouTubeUploadError("aborted"));
    }, { once: true });
  });
}

type PutOutcome =
  | { kind: "done"; body: string }
  | { kind: "incomplete"; nextByte: number }
  | { kind: "retry" }
  | { kind: "failed"; status: number; body: string };

// One PUT to the session URI. With a body it sends the file from `start`;
// without one it only asks how many bytes YouTube already has.
function put(
  sessionUrl: string,
  token: string,
  file: File,
  start: number | null,
  signal: AbortSignal,
  onProgress?: (sent: number) => void,
): Promise<PutOutcome> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sessionUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (start === null) {
      xhr.setRequestHeader("Content-Range", `bytes */${file.size}`);
    } else {
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      if (start > 0) xhr.setRequestHeader("Content-Range", `bytes ${start}-${file.size - 1}/${file.size}`);
      xhr.upload.onprogress = (event) => onProgress?.(start + event.loaded);
    }
    const onAbort = () => xhr.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    xhr.onloadend = () => signal.removeEventListener("abort", onAbort);
    xhr.onabort = () => reject(new YouTubeUploadError("aborted"));
    xhr.onerror = () => resolve({ kind: "retry" });
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        resolve({ kind: "done", body: xhr.responseText });
      } else if (xhr.status === 308) {
        const range = xhr.getResponseHeader("Range")?.match(/bytes=0-(\d+)/);
        resolve({ kind: "incomplete", nextByte: range ? Number(range[1]) + 1 : 0 });
      } else if (xhr.status >= 500 || xhr.status === 429) {
        resolve({ kind: "retry" });
      } else {
        resolve({ kind: "failed", status: xhr.status, body: xhr.responseText });
      }
    };
    xhr.send(start === null ? null : file.slice(start));
  });
}

export async function uploadToYouTube({
  token,
  file,
  title,
  description,
  tags,
  privacyStatus,
  signal,
  onProgress,
}: {
  token: string;
  file: File;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: YouTubePrivacyStatus;
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
}): Promise<YouTubeUploadResult> {
  let session: Response;
  try {
    session = await fetch(UPLOAD_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(file.size),
        "X-Upload-Content-Type": file.type || "application/octet-stream",
      },
      body: JSON.stringify({
        snippet: {
          title: youtubeTitle(title),
          description: youtubeDescription(description),
          tags: youtubeTags(tags),
          categoryId: GAMING_CATEGORY_ID,
        },
        status: { privacyStatus, selfDeclaredMadeForKids: false },
      }),
    });
  } catch {
    throw new YouTubeUploadError(signal.aborted ? "aborted" : "network");
  }
  const sessionUrl = session.headers.get("Location");
  if (!session.ok || !sessionUrl) {
    throw new YouTubeUploadError(session.ok ? "generic" : await errorCode(session.status, await session.text()));
  }

  const report = (sent: number) => onProgress(file.size ? Math.min(1, sent / file.size) : 1);
  let start = 0;
  let retries = 0;
  for (;;) {
    let outcome = await put(sessionUrl, token, file, start, signal, report);
    while (outcome.kind === "retry") {
      if (retries >= MAX_RETRIES) throw new YouTubeUploadError("network");
      await wait(2 ** retries * 1000, signal);
      retries += 1;
      outcome = await put(sessionUrl, token, file, null, signal);
    }
    if (outcome.kind === "failed") throw new YouTubeUploadError(await errorCode(outcome.status, outcome.body));
    if (outcome.kind === "incomplete") {
      start = outcome.nextByte;
      report(start);
      continue;
    }
    try {
      const video = JSON.parse(outcome.body) as { id?: string; status?: { privacyStatus?: YouTubePrivacyStatus } };
      if (!video.id) throw new Error("missing-id");
      report(file.size);
      return { id: video.id, privacyStatus: video.status?.privacyStatus ?? privacyStatus };
    } catch {
      throw new YouTubeUploadError("generic");
    }
  }
}
