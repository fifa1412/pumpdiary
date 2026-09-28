import { createClient } from "@/lib/supabase/client";

export type AuthErrorCode =
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "UNKNOWN";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

function mapAuthError(error: unknown): AuthError {
  const details =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown; message?: unknown })
      : {};
  const code = typeof details.code === "string" ? details.code.toLowerCase() : "";
  const message =
    typeof details.message === "string" ? details.message.toLowerCase() : "";

  if (code === "user_already_exists" || message.includes("already registered")) {
    return new AuthError("EMAIL_TAKEN", "EMAIL_TAKEN");
  }
  if (code === "invalid_credentials") {
    return new AuthError("INVALID_CREDENTIALS", "INVALID_CREDENTIALS");
  }
  return new AuthError("UNKNOWN", "UNKNOWN");
}

function currentUserFromAuthUser(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  profileName?: string | null,
): CurrentUser {
  const metadataName = user.user_metadata?.player_name;
  return {
    id: user.id,
    name:
      profileName ?? (typeof metadataName === "string" ? metadataName : ""),
    email: user.email ?? "",
  };
}

async function getCurrentUserFromAuthUser(
  user: Parameters<typeof currentUserFromAuthUser>[0],
): Promise<CurrentUser> {
  const supabase = createClient();
  try {
    const { data } = await supabase
      .from("profiles")
      .select("player_name")
      .eq("id", user.id)
      .maybeSingle();

    return currentUserFromAuthUser(user, data?.player_name);
  } catch {
    return currentUserFromAuthUser(user);
  }
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<CurrentUser> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { data: { player_name: input.name.trim() } },
  });

  if (error) throw mapAuthError(error);
  if (data.user?.identities?.length === 0) {
    throw new AuthError("EMAIL_TAKEN", "EMAIL_TAKEN");
  }
  if (!data.user || !data.session) {
    throw new AuthError("UNKNOWN", "UNKNOWN");
  }

  return getCurrentUserFromAuthUser(data.user);
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<CurrentUser> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) throw mapAuthError(error);
  if (!data.user || !data.session) {
    throw new AuthError("UNKNOWN", "UNKNOWN");
  }

  return getCurrentUserFromAuthUser(data.user);
}

export async function logoutUser(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw mapAuthError(error);
}
