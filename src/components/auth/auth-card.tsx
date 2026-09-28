import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      <Card className="w-full max-w-[420px]">
        <CardHeader>
          <h1 className="font-display text-xl font-semibold leading-none">
            {title}
          </h1>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
