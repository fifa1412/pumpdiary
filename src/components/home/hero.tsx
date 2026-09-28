import Link from "next/link";

import { PadIcon } from "@/components/brand/pad-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreCardMock } from "@/components/home/score-card-mock";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid" />
      <div
        aria-hidden
        className="glow-primary pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[820px] -translate-x-1/2"
      />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-10">
        <div className="flex flex-col items-start gap-6">
          <Badge variant="secondary">สำหรับผู้เล่น Pump It Up</Badge>
          <h1 className="font-display text-4xl font-bold leading-tight text-balance sm:text-5xl lg:text-6xl">
            บันทึกทุกสเต็ป
            <br />
            เก็บ
            <span className="text-gradient-brand">ทุกคะแนน</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            PumpDiary คือสมุดบันทึกส่วนตัวของสายปั๊ม เก็บคะแนน เกรด และวิดีโอการเล่นไว้ในที่เดียว แล้วดูพัฒนาการของตัวเองในทุกชาร์ต
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              size="lg"
              asChild
              className="shadow-[0_0_24px_rgba(61,255,139,0.35)]"
            >
              <Link href="/register">เริ่มบันทึกฟรี</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">ดูฟีเจอร์</Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
          <div aria-hidden className="absolute -inset-10 overflow-hidden rounded-3xl">
            <div className="glow-primary absolute inset-0" />
            <PadIcon className="absolute -right-8 -top-8 size-56 opacity-10 sm:size-64" />
          </div>
          <ScoreCardMock />
        </div>
      </div>
    </section>
  );
}
