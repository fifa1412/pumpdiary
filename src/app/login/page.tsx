import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("login.title") };
}

export default function LoginPage() {
  return (
    <AuthCard title="เข้าสู่ระบบ">
      <LoginForm />
    </AuthCard>
  );
}
