import { cn } from "@/lib/utils";

type StepType = "SINGLE" | "DOUBLE" | "HALFDOUBLE";

const STEP_COLORS: Record<StepType, { background: string; foreground: string }> = {
  SINGLE: { background: "var(--single-bg)", foreground: "var(--single-foreground)" },
  DOUBLE: { background: "var(--double-bg)", foreground: "var(--double-foreground)" },
  HALFDOUBLE: { background: "var(--secondary)", foreground: "var(--secondary-foreground)" },
};

export function LevelRingBadge({
  stepType,
  level,
  label,
  size = 56,
  className,
}: {
  stepType: StepType;
  level: number;
  label: string;
  size?: number;
  className?: string;
}) {
  const colors = STEP_COLORS[stepType];

  return (
    <span
      role="img"
      aria-label={`${label} ${level}`}
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" viewBox="0 0 60 60" width={size} height={size}>
        <text
          x="30"
          y="9"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--muted-foreground)"
          fontSize="6.5"
          fontWeight="600"
          letterSpacing="0.4"
        >
          {label}
        </text>
        <circle cx="30" cy="38" r="19" fill="none" stroke={colors.background} strokeWidth="2" />
        <circle cx="30" cy="38" r="15" fill={colors.background} />
        <text
          x="30"
          y="38"
          textAnchor="middle"
          dominantBaseline="central"
          fill={colors.foreground}
          fontSize="16"
          fontWeight="700"
          fontFamily="var(--font-barlow), sans-serif"
        >
          {level}
        </text>
      </svg>
    </span>
  );
}
