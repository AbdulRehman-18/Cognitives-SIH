import { cn } from "@/lib/utils";

export interface ScoreReadoutProps {
  level: number | null;
  maxLevel?: number;
  confidenceLabel?: string;
  label?: string;
  className?: string;
  size?: "default" | "large";
}

export function ScoreReadout({
  level,
  maxLevel = 5,
  confidenceLabel,
  label,
  className,
  size = "default",
}: ScoreReadoutProps) {
  const isUnmeasured = level === null;

  return (
    <div className={cn("flex flex-col gap-[4px]", className)}>
      {label ? (
        <span className="text-eyebrow text-muted-foreground">{label}</span>
      ) : null}
      <div className="flex items-baseline gap-[8px]">
        {isUnmeasured ? (
          <span
            className={cn(
              "num font-medium text-[color:var(--color-unassessed)]",
              size === "large" ? "text-display" : "text-h2",
            )}
          >
            —
          </span>
        ) : (
          <>
            <span
              className={cn(
                "num font-bold text-foreground tabular-mono",
                size === "large" ? "text-display" : "text-h2",
              )}
              style={size === "large" ? { color: "var(--color-accent)" } : undefined}
            >
              {level.toFixed(1)}
            </span>
            <span className="num text-small text-muted-foreground tabular-mono">
              / {maxLevel.toFixed(0)}
            </span>
          </>
        )}
        {isUnmeasured ? (
          <span className="text-small text-[color:var(--color-unassessed)]">Not yet assessed</span>
        ) : null}
      </div>
      {!isUnmeasured && confidenceLabel ? (
        <span className="num text-small text-muted-foreground tabular-mono">
          {confidenceLabel}
        </span>
      ) : null}
    </div>
  );
}
