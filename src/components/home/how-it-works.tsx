const STEPS = ["สมัครสมาชิก", "บันทึกคะแนนและแนบวิดีโอหลังเล่น", "ดูพัฒนาการและตั้งเป้าหมายถัดไป"] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-14 border-t border-border bg-card/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="font-display text-3xl font-bold text-balance sm:text-4xl">
          เริ่มต้นใน 3 ขั้นตอน
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <li key={step} className="rounded-xl border border-border bg-card p-6">
              <span className="font-display text-4xl font-bold leading-none text-primary/90">
                {i + 1}
              </span>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
