export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PumpDiary</p>
        <p>PumpDiary เป็นโปรเจกต์แฟนเมด ไม่มีส่วนเกี่ยวข้องกับ Andamiro หรือ Pump It Up อย่างเป็นทางการ</p>
      </div>
    </footer>
  );
}
