import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { CurrentUser } from "@/lib/auth";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies; src/proxy.ts refreshes them.
          }
        },
      },
    },
  );
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  let profileName: string | null = null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("player_name")
      .eq("id", user.id)
      .maybeSingle();
    profileName = profile?.player_name ?? null;
  } catch {
    // The profile table may not be available until the migration is applied.
  }
  const metadataName = user.user_metadata?.player_name;

  return {
    id: user.id,
    name:
      profileName ??
      (typeof metadataName === "string" ? metadataName : ""),
    email: user.email ?? "",
  };
}
