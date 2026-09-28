"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { CurrentUser } from "@/lib/auth";

export interface CurrentUserState {
  user: CurrentUser | null;
  ready: boolean;
}

export function useCurrentUser(initialUser: CurrentUser | null): CurrentUserState {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return { user: initialUser, ready: true };
}
