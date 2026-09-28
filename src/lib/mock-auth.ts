// MOCK: client-side mock auth — will be replaced by real auth.

const USERS_KEY = "pumpdiary:users";
const SESSION_KEY = "pumpdiary:session";

export const AUTH_CHANGE_EVENT = "pumpdiary:auth-change";

export type AuthErrorCode =
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "STORAGE_UNAVAILABLE";

export class MockAuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "MockAuthError";
    this.code = code;
  }
}

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.email === "string" &&
    typeof v.passwordHash === "string" &&
    typeof v.createdAt === "string"
  );
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredUser) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): boolean {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  } catch {
    return false;
  }
}

function readSession(): { userId: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: unknown };
    return typeof parsed.userId === "string" ? { userId: parsed.userId } : null;
  } catch {
    return null;
  }
}

function writeSession(userId: string): boolean {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId }));
    return true;
  } catch {
    return false;
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable — treat as no data
  }
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function notifyAuthChange(): void {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function toCurrentUser(user: StoredUser): CurrentUser {
  return { id: user.id, name: user.name, email: user.email };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<CurrentUser> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await sha256Hex(input.password);
  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    throw new MockAuthError("EMAIL_TAKEN", "EMAIL_TAKEN");
  }
  const user: StoredUser = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  if (!writeUsers([...users, user]) || !writeSession(user.id)) {
    throw new MockAuthError("STORAGE_UNAVAILABLE", "STORAGE_UNAVAILABLE");
  }
  notifyAuthChange();
  return toCurrentUser(user);
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<CurrentUser> {
  const email = input.email.trim().toLowerCase();
  const hash = await sha256Hex(input.password);
  const user = readUsers().find((u) => u.email === email);
  if (!user || user.passwordHash !== hash) {
    throw new MockAuthError("INVALID_CREDENTIALS", "INVALID_CREDENTIALS");
  }
  if (!writeSession(user.id)) {
    throw new MockAuthError("STORAGE_UNAVAILABLE", "STORAGE_UNAVAILABLE");
  }
  notifyAuthChange();
  return toCurrentUser(user);
}

export function logoutUser(): void {
  clearSession();
  notifyAuthChange();
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let currentUserCache: { raw: string; user: CurrentUser | null } | null = null;

// useSyncExternalStore requires a stable reference while the data is
// unchanged, so cache the result keyed on the raw storage strings.
export function getCurrentUser(): CurrentUser | null {
  const raw = `${readRaw(USERS_KEY)}\u0000${readRaw(SESSION_KEY)}`;
  if (currentUserCache && currentUserCache.raw === raw) {
    return currentUserCache.user;
  }
  const session = readSession();
  const user = session
    ? readUsers().find((u) => u.id === session.userId)
    : undefined;
  const result = user ? toCurrentUser(user) : null;
  currentUserCache = { raw, user: result };
  return result;
}
