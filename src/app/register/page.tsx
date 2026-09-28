import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("register.title") };
}

export default async function RegisterPage() {
  const [t, locale] = await Promise.all([getTranslations("auth"), getLocale()]);

  return (
    <AuthCard title={t("register.title")}>
      {/* Remount on language change so existing validation errors are re-rendered in the new locale. */}
      <RegisterForm key={locale} />
    </AuthCard>
  );
}
