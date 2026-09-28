import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const JUDGEMENTS = [
  { label: "Perfect", count: "1284", width: "100%" },
  { label: "Great", count: "96", width: "74%" },
  { label: "Good", count: "12", width: "38%" },
  { label: "Bad", count: "3", width: "14%" },
  { label: "Miss", count: "1", width: "7%" },
] as const;

export function ScoreCardMock() {
  return (
    <Card className="relative w-full">
      <CardHeader>
        <CardTitle className="font-display text-xl">Neon Phoenix</CardTitle>
        <CardDescription>PumpDiary Demo</CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-display">
            D21
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <span className="font-display text-5xl font-bold leading-none text-primary">
            SS+
          </span>
          <span className="font-display text-2xl font-semibold leading-none tabular-nums">
            987,654
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {JUDGEMENTS.map((j) => (
            <div key={j.label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                {j.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{ width: j.width }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {j.count}
              </span>
            </div>
          ))}
        </div>
        <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg border border-border bg-gradient-to-br from-secondary to-background">
          <svg
            aria-hidden
            viewBox="0 0 48 48"
            className="size-14 drop-shadow-[0_0_14px_rgba(61,255,139,0.45)]"
          >
            <circle
              cx="24"
              cy="24"
              r="21"
              strokeWidth="2"
              className="fill-primary/10 stroke-primary/70"
            />
            <path d="M20 16.5v15l12.5-7.5z" className="fill-primary" />
          </svg>
          <p className="text-xs text-muted-foreground">วิดีโอการเล่น</p>
        </div>
      </CardContent>
      <CardFooter className="justify-end text-xs tabular-nums text-muted-foreground">
        24/09/2026
      </CardFooter>
    </Card>
  );
}
