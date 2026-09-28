import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "แดชบอร์ด",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <DashboardView user={user} />;
}
