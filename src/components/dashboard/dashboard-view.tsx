"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutUser, type CurrentUser } from "@/lib/auth";

const GENERIC_ERROR = 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';

export function DashboardView({ user }: { user: CurrentUser }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await logoutUser();
      router.replace("/");
    } catch {
      toast.error(GENERIC_ERROR);
    }
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
