import { ClipboardList, Target, TrendingUp, Video } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Sparkline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 96 32"
      className="h-8 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points="2,26 18,22 34,24 50,15 66,13 82,7 94,4"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary"
      />
    </svg>
  );
}

const CARDS = [
  {
    icon: ClipboardList,
    title: "บันทึกคะแนน",
    description: "เก็บคะแนน เกรด ผล judgement และเลเวลของทุกการเล่น",
    sparkline: false,
  },
  { icon: Video, title: "คลังวิดีโอ", description: "เก็บวิดีโอการเล่นไว้ในที่เดียว จัดเรียงตามเพลงและเลเวล", sparkline: false },
  { icon: TrendingUp, title: "ติดตามพัฒนาการ", description: "เห็นคะแนนของตัวเองดีขึ้นในแต่ละช่วงเวลา", sparkline: true },
  { icon: Target, title: "ตั้งเป้าหมาย", description: "ตั้งเกรดเป้าหมาย และติดตามชาร์ตที่เคลียร์แล้ว", sparkline: false },
] as const;

export function Features() {
  return (
    <section id="features" className="scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="font-display text-3xl font-bold text-balance sm:text-4xl">
          ทุกอย่างที่สายปั๊มต้องใช้
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map(({ icon: Icon, title, description, sparkline }) => (
            <Card key={title}>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary/60">
                  <Icon aria-hidden className="size-5 text-primary" />
                </div>
                <CardTitle className="font-display text-lg">{title}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {description}
                </CardDescription>
              </CardHeader>
              {sparkline ? <CardContent><Sparkline /></CardContent> : null}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
