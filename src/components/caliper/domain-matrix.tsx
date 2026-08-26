import { cn } from "@/lib/utils";
import { ScoreReadout } from "@/components/caliper/score-readout";

export interface DomainMatrixEntry {
  domainCode: string;
  domainName: string;
  level: number | null;
  competencyCount: number;
  assessedCount: number;
}

export interface DomainMatrixProps {
  domains: DomainMatrixEntry[];
  className?: string;
}

export function DomainMatrix({ domains, className }: DomainMatrixProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {domains.map((d, i) => (
        <div
          key={d.domainCode}
          className="token-entrance-stagger flex flex-col gap-[16px] rounded-[20px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px] shadow-[var(--shadow-card)] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white hover:border-[color:var(--color-border-hover)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-[1px] focus-within:ring-[1px] focus-within:ring-[color:var(--color-accent)]"
          style={{ ["--stagger" as string]: i } as React.CSSProperties}
        >
          <div className="flex items-center justify-between">
            <span className="text-eyebrow text-muted-foreground">
              {d.domainName}
            </span>
            <span className="num text-small text-muted-foreground tabular-mono">
              {d.assessedCount}/{d.competencyCount}
            </span>
          </div>
          <ScoreReadout level={d.level} />
          <div className="h-[4px] w-full overflow-hidden rounded-full bg-[color:var(--color-border-resting)]">
            <div
              className="h-full rounded-full"
              style={{
                width:
                  d.competencyCount > 0
                    ? `${Math.round((d.assessedCount / d.competencyCount) * 100)}%`
                    : "0%",
                backgroundColor:
                  d.level === null ? "var(--color-unassessed)" : "var(--color-accent)",
                transition: "width var(--duration-gauge) var(--ease-entrance)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
