import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("login.title") };
}

export default async function LoginPage() {
  const [t, locale] = await Promise.all([getTranslations("auth"), getLocale()]);

  return (
    <AuthCard title={t("login.title")}>
      {/* Remount on language change so existing validation errors are re-rendered in the new locale. */}
      <LoginForm key={locale} />
    </AuthCard>
  );
}
