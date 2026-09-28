"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logoutUser } from "@/lib/mock-auth";

export function DashboardView() {
  const router = useRouter();
  const { user, ready } = useCurrentUser();
  // undefined = never observed a user (fresh load); true = was logged in.
  // Distinguishes "no session on load" (→ /login) from "just logged out"
  // (→ /, matching the header logout and the spec's logout target).
  const wasLoggedInRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    if (user !== null) {
      wasLoggedInRef.current = true;
      return;
    }
    if (wasLoggedInRef.current === undefined) {
      router.replace("/login");
    } else {
      router.replace("/");
    }
  }, [ready, user, router]);

  if (!ready || user === null) {
    return null;
  }

  function handleLogout() {
    logoutUser();
    router.replace("/");
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-4 py-12">
      <h1 className="font-display text-3xl font-bold">
        สวัสดี {user.name}
      </h1>
      <Card className="w-full max-w-[420px]">
        <CardHeader>
          <CardTitle className="font-display text-xl">
            ยังไม่มีคะแนนที่บันทึก
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button className="w-full" disabled>
            เพิ่มคะแนน (เร็ว ๆ นี้)
          </Button>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            ออกจากระบบ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
