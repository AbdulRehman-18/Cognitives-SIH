import { cn } from "@/lib/utils";
import { ScoreReadout } from "@/components/caliper/score-readout";

export interface DomainMatrixEntry {
  domainCode: string;
  domainName: string;
  /** Average measured level across competencies in this domain, 1-5, or null. */
  level: number | null;
  competencyCount: number;
  assessedCount: number;
}

export interface DomainMatrixProps {
  domains: DomainMatrixEntry[];
  className?: string;
}

/**
 * The 4-domain grid (Statistical, Technical, Digital Governance,
 * Behavioural). Tint-encoded on the same measure→gap ramp as the rest of
 * the system — no separate colour language (PRD §5.5).
 */
export function DomainMatrix({ domains, className }: DomainMatrixProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {domains.map((d) => (
        <div
          key={d.domainCode}
          className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {d.domainName}
            </span>
            <span className="tabular-mono text-[11px] text-muted-foreground">
              {d.assessedCount}/{d.competencyCount}
            </span>
          </div>
          <ScoreReadout level={d.level} />
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-200 ease-out"
              style={{
                width:
                  d.competencyCount > 0
                    ? `${Math.round((d.assessedCount / d.competencyCount) * 100)}%`
                    : "0%",
                backgroundColor:
                  d.level === null ? "var(--color-unmeasured)" : "var(--color-measure)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
