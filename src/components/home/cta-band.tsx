import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-4 sm:pb-20">
      <div className="relative h-full overflow-hidden rounded-3xl border border-primary/30 bg-card px-6 py-14 text-center shadow-[0_0_60px_-20px_rgba(61,255,139,0.4)] sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid" />
        <div
          aria-hidden
          className="glow-primary pointer-events-none absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2"
        />
        <h2 className="relative font-display text-3xl font-bold text-balance sm:text-4xl">
          พร้อมจะเก็บทุกสเต็ปหรือยัง?
        </h2>
        <div className="relative mt-8 flex justify-center">
          <Button
            size="lg"
            asChild
            className="shadow-[0_0_24px_rgba(61,255,139,0.35)]"
          >
            <Link href="/register">สมัครสมาชิกฟรี</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
