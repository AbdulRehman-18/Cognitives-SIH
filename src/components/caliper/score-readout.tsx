import { cn } from "@/lib/utils";

export interface ScoreReadoutProps {
  /** Competency level, 1-5, or null for "Not yet assessed". */
  level: number | null;
  maxLevel?: number;
  /** Confidence range shown alongside the level, e.g. "±0.4" or a band label. */
  confidenceLabel?: string;
  label?: string;
  className?: string;
  size?: "default" | "large";
}

/**
 * Renders a measured range, never a bare percentage as the headline figure.
 * The level is the load-bearing number (tabular-mono, no jitter); the
 * confidence range is secondary, smaller text — exactly the inverse of a
 * typical dashboard "big percent" pattern.
 */
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
    <div className={cn("flex flex-col gap-0.5", className)}>
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : null}
      <div className="flex items-baseline gap-1.5">
        {isUnmeasured ? (
          <span
            className={cn(
              "tabular-mono font-medium text-[color:var(--color-unmeasured)]",
              size === "large" ? "text-xl" : "text-base",
            )}
          >
            Not yet assessed
          </span>
        ) : (
          <>
            <span
              className={cn(
                "tabular-mono font-semibold text-foreground",
                size === "large" ? "text-4xl leading-none" : "text-2xl leading-none",
              )}
            >
              {level.toFixed(1)}
            </span>
            <span className="tabular-mono text-sm text-muted-foreground">
              / {maxLevel.toFixed(0)}
            </span>
          </>
        )}
      </div>
      {!isUnmeasured && confidenceLabel ? (
        <span className="tabular-mono text-xs text-muted-foreground">
          {confidenceLabel}
        </span>
      ) : null}
    </div>
  );
}
