import { BarChart3, Link2, Music2 } from "lucide-react";

const ITEMS = [
  { icon: Music2, text: "รองรับ Single และ Double" },
  { icon: Link2, text: "แนบลิงก์วิดีโอ YouTube" },
  { icon: BarChart3, text: "ดูสถิติย้อนหลังได้ทุกเมื่อ" },
] as const;

export function Highlights() {
  return (
    <section className="border-y border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:grid-cols-3 sm:gap-8">
        {ITEMS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60">
              <Icon aria-hidden className="size-5 text-primary" />
            </div>
            <p className="text-sm font-medium leading-snug">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
