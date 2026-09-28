"use client";

import { useSyncExternalStore } from "react";
import { AUTH_CHANGE_EVENT, getCurrentUser, type CurrentUser } from "@/lib/mock-auth";

export interface CurrentUserState {
  user: CurrentUser | null;
  ready: boolean;
}

function subscribeAuthChanges(onStoreChange: () => void) {
  window.addEventListener(AUTH_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

const subscribeNoop = () => () => {};

export function useCurrentUser(): CurrentUserState {
  const user = useSyncExternalStore(
    subscribeAuthChanges,
    () => getCurrentUser(),
    () => null
  );
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return { user, ready };
}
