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
  reason?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  className?: string;
  loading?: boolean;
}
const META: Record<GapSeverity, { label: string; gauge: "critical" | "high" | "medium" | "low"; bar: string; bg: string; border: string; chip: string }> = {
  CRITICAL: { label: "Critical", gauge: "critical", bar: "#F04438", bg: "rgba(240,68,56,0.06)", border: "rgba(240,68,56,0.22)", chip: "bg-[rgba(240,68,56,0.10)] text-[#C9190B] border-[rgba(240,68,56,0.18)]" },
  HIGH: { label: "High", gauge: "high", bar: "#F79009", bg: "rgba(247,144,9,0.06)", border: "rgba(247,144,9,0.24)", chip: "bg-[rgba(247,144,9,0.12)] text-[#8A4D00] border-[rgba(247,144,9,0.18)]" },
  MEDIUM: { label: "Medium", gauge: "medium", bar: "#F79009", bg: "rgba(247,144,9,0.06)", border: "rgba(247,144,9,0.22)", chip: "bg-[rgba(247,144,9,0.10)] text-[#8A4D00] border-[rgba(247,144,9,0.18)]" },
  LOW: { label: "Room to Grow", gauge: "low", bar: "#12B76A", bg: "rgba(18,183,106,0.06)", border: "rgba(18,183,106,0.24)", chip: "bg-[rgba(18,183,106,0.10)] text-[#0E7A4B] border-[rgba(18,183,106,0.18)]" },
};

export function GapCard({ competencyName, domainName, currentLevel, requiredLevel, severity, reason, primaryActionLabel = "View recommended course", onPrimaryAction, className, loading = false }: GapCardProps) {
  const m = META[severity];
  return (
    <div className={cn("relative flex flex-col gap-[14px] overflow-hidden rounded-[20px] border bg-[color:var(--color-surface-1)] p-[20px] shadow-[var(--shadow-card)] transition-all duration-[200ms] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-[1px]", className)} style={{ backgroundColor: `color-mix(in srgb, ${m.bg} 100%, var(--color-surface-1))`, borderColor: m.border } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">{domainName}</p>
          <h3 className="text-[16px] font-semibold tracking-[-0.01em] leading-tight mt-[2px]">{competencyName}</h3>
          <p className="num text-[11px] tabular-mono text-muted-foreground mt-[4px]">Lv {currentLevel ?? "—"} → Lv {requiredLevel} required</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-[10px] py-[4px] text-[11px] font-semibold tracking-wide border", m.chip)}>{m.label}</span>
      </div>
      <div>
        <CaliperGauge value={currentLevel} target={requiredLevel} min={0} max={5} severity={m.gauge} srLabel={competencyName} unitLabel="/ 5" size="compact" loading={loading} />
      </div>
      {reason ? <p className="text-small leading-relaxed text-muted-foreground border-l-2 pl-[10px]" style={{ borderColor: m.bar }}>{reason}</p> : null}
      {onPrimaryAction ? <div><Button size="sm" onClick={onPrimaryAction} className="rounded-full">{primaryActionLabel}</Button></div> : null}
    </div>
  );
}
