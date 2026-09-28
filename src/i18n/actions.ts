"use server";

import { cookies } from "next/headers";

import { isLocale } from "@/i18n/config";

export async function setLocale(locale: unknown) {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}
