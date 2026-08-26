import { cn } from "@/lib/utils";
import { CaliperGauge } from "@/components/caliper/caliper-gauge";
import { Button } from "@/components/ui/button";

export type GapSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface GapCardProps {
  competencyName: string;
  domainName: string;
  currentLevel: number | null;
  requiredLevel: number;
  severity: GapSeverity;
  /** LLM-written, plain-language reason — generated only after severity is fixed. */
  reason?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  className?: string;
}

const SEVERITY_META: Record<
  GapSeverity,
  { label: string; gaugeSeverity: "critical" | "high" | "medium" | "low"; chipClass: string }
> = {
  CRITICAL: {
    label: "Critical",
    gaugeSeverity: "critical",
    chipClass:
      "bg-[color-mix(in_oklch,var(--color-critical),transparent_85%)] text-[color:var(--color-critical)]",
  },
  HIGH: {
    label: "High",
    gaugeSeverity: "high",
    chipClass:
      "bg-[color-mix(in_oklch,var(--color-gap),transparent_85%)] text-[color:var(--color-gap)]",
  },
  MEDIUM: {
    label: "Medium",
    gaugeSeverity: "medium",
    chipClass:
      "bg-[color-mix(in_oklch,var(--color-gap),transparent_90%)] text-[color:var(--color-gap)]",
  },
  LOW: {
    label: "Room to grow",
    gaugeSeverity: "low",
    chipClass:
      "bg-[color-mix(in_oklch,var(--color-target),transparent_88%)] text-[color:var(--color-target)]",
  },
};

/**
 * A single flagged gap: severity chip, the CaliperGauge showing current vs.
 * target level, the LLM-authored plain-language reason, and one clear
 * primary action. Language stays non-judgmental — severity labels describe
 * priority, not a deficiency score.
 */
export function GapCard({
  competencyName,
  domainName,
  currentLevel,
  requiredLevel,
  severity,
  reason,
  primaryActionLabel = "View recommended course",
  onPrimaryAction,
  className,
}: GapCardProps) {
  const meta = SEVERITY_META[severity];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-md border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {domainName}
          </span>
          <h3 className="text-base font-medium text-foreground">{competencyName}</h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium",
            meta.chipClass,
          )}
        >
          {meta.label}
        </span>
      </div>

      <CaliperGauge
        value={currentLevel}
        target={requiredLevel}
        min={0}
        max={5}
        severity={meta.gaugeSeverity}
        srLabel={competencyName}
        unitLabel="/ 5"
        size="compact"
      />

      {reason ? (
        <p className="text-sm text-muted-foreground">{reason}</p>
      ) : null}

      {onPrimaryAction ? (
        <Button size="sm" onClick={onPrimaryAction} className="w-fit">
          {primaryActionLabel}
        </Button>
      ) : null}
    </div>
  );
}
