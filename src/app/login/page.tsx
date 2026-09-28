import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
};

export default function LoginPage() {
  return (
    <AuthCard title="เข้าสู่ระบบ">
      <LoginForm />
    </AuthCard>
  );
}
