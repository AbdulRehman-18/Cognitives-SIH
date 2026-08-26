"use client";

import Link from "next/link";
import * as React from "react";
import { GapCard, type GapSeverity } from "@/components/caliper/gap-card";
import { SeverityFormulaDisclosure } from "@/components/caliper/severity-formula-disclosure";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashboardGap {
  competencyId: string;
  competencyName: string;
  domainName: string;
  currentLevel: number;
  requiredLevel: number;
  gapSize: number;
  weighted: number;
  severity: GapSeverity;
  criticalOverride: boolean;
  reason?: string;
}
export interface DashboardUnknown {
  competencyId: string;
  competencyName: string;
  domainName: string;
  requiredLevel: number;
}

const ORDER: GapSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const LABEL: Record<GapSeverity, { title: string; blurb: string; dot: string }> = {
  CRITICAL: { title: "Critical", blurb: "Highest priority — blocks role readiness. Close these first.", dot: "bg-[#F04438]" },
  HIGH: { title: "High", blurb: "Meaningful gaps worth closing soon.", dot: "bg-[#F79009]" },
  MEDIUM: { title: "Medium", blurb: "Moderate room to grow.", dot: "bg-[#F79009]" },
  LOW: { title: "Room to grow", blurb: "Small gaps — you're close to target here.", dot: "bg-[#12B76A]" },
};
const TINT: Record<GapSeverity, string> = { CRITICAL: "var(--color-critical)", HIGH: "var(--color-moderate)", MEDIUM: "var(--color-moderate)", LOW: "var(--color-grow)" };

export function GapDashboard({ gaps, unknown }: { gaps: DashboardGap[]; unknown: DashboardUnknown[] }) {
  const [filter, setFilter] = React.useState<GapSeverity | "ALL">("ALL");
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: gaps.length };
    for (const s of ORDER) c[s] = gaps.filter((g) => g.severity === s).length;
    return c;
  }, [gaps]);

  const filtered = filter === "ALL" ? gaps : gaps.filter((g) => g.severity === filter);
  const grouped = ORDER.map((s) => ({ severity: s, items: filtered.filter((g) => g.severity === s) })).filter((g) => g.items.length > 0);
  const isEmpty = gaps.length === 0 && unknown.length === 0;
  const totalGapLevels = gaps.reduce((s, g) => s + g.gapSize, 0);
  const avgGap = gaps.length ? (totalGapLevels / gaps.length).toFixed(1) : "—";

  return (
    <div className="flex flex-col gap-[20px] token-entrance">
      {/* Title + calculator */}
      <div className="flex flex-wrap items-start justify-between gap-[16px]">
        <div>
          <p className="text-eyebrow text-[11px] tracking-[0.14em] text-[color:var(--color-accent)]">Gap Report</p>
          <h1 className="text-[28px] md:text-[32px] font-[650] tracking-[-0.03em] leading-[1.05] mt-[6px]">Your skill gaps</h1>
          <p className="max-w-[62ch] text-body text-muted-foreground mt-[8px]">Prioritized against your role’s target profile. Every gap here is room to grow, not a deficiency — the order is set by a fixed formula, never a guess.</p>
        </div>
        <SeverityFormulaDisclosure />
      </div>

      {/* Summary strip */}
      <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[16px] md:p-[20px] shadow-[var(--shadow-card)] flex flex-col md:flex-row gap-[16px] items-stretch">
        <div className="flex-1 grid grid-cols-3 divide-x divide-[color:var(--color-border-resting)]">
          <div className="px-[12px] first:pl-0">
            <p className="num text-[22px] font-semibold leading-none">{gaps.length}</p>
            <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground mt-[4px]">Total gaps</p>
            <p className="text-[11px] tabular-mono text-muted-foreground">avg {avgGap} levels</p>
          </div>
          <div className="px-[12px]">
            <p className="num text-[22px] font-semibold leading-none text-[#C9190B]">{counts.CRITICAL ?? 0}</p>
            <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground mt-[4px]">Critical</p>
            <p className="text-[11px] tabular-mono text-muted-foreground">fix first</p>
          </div>
          <div className="px-[12px]">
            <p className="num text-[22px] font-semibold leading-none">{unknown.length}</p>
            <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground mt-[4px]">Not yet assessed</p>
            <p className="text-[11px] tabular-mono text-muted-foreground">needs diagnostic</p>
          </div>
        </div>
        <div className="md:w-[260px] shrink-0 flex flex-col gap-[8px] justify-center">
          <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Severity mix</p>
          <div className="h-[10px] w-full flex rounded-full overflow-hidden border border-[color:var(--color-border-resting)]">
            {ORDER.map((s) => {
              const n = counts[s] ?? 0;
              const pct = gaps.length ? (n / gaps.length) * 100 : 0;
              const bg = s === "CRITICAL" ? "#F04438" : s === "LOW" ? "#12B76A" : "#F79009";
              return n ? <div key={s} style={{ width: `${pct}%`, background: bg }} /> : null;
            })}
          </div>
          <div className="flex gap-[10px] text-[11px] tabular-mono text-muted-foreground">
            <span className="flex items-center gap-[6px]"><span className="size-2 rounded-full bg-[#F04438]" />Critical {counts.CRITICAL ?? 0}</span>
            <span className="flex items-center gap-[6px]"><span className="size-2 rounded-full bg-[#12B76A]" />Grow {counts.LOW ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-[8px] border-y border-[color:var(--color-border-resting)] py-[12px]">
        <span className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground mr-[4px]">Filter:</span>
        {(["ALL", ...ORDER] as const).map((f) => {
          const active = filter === f;
          const label = f === "ALL" ? `All (${counts.ALL})` : `${LABEL[f as GapSeverity].title} (${counts[f as string] ?? 0})`;
          return (
            <button key={f} onClick={() => setFilter(f as GapSeverity | "ALL")} className={cn("rounded-full px-[14px] py-[7px] text-small font-medium border transition", active ? "bg-[color:var(--color-accent)] text-white border-transparent shadow-[var(--shadow-cta)]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)] text-foreground hover:bg-white")}>{label}</button>
          );
        })}
        <span className="ml-auto text-[11px] tabular-mono text-muted-foreground hidden md:inline">Sorted by priority · fixed formula</span>
      </div>

      {isEmpty ? (
        <div className="rounded-[20px] border border-dashed border-[color:var(--color-border-resting)] p-[32px] text-center bg-[color:var(--color-surface-1)]">
          <p className="text-body text-muted-foreground">No gap data yet. Complete a diagnostic to measure your competencies.</p>
          <Link href="/assessment/new" className={buttonVariants({ variant: "default" })} style={{ marginTop: 16 } as React.CSSProperties}>Take diagnostic</Link>
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-[20px] border border-[color:var(--color-border-resting)] p-[24px] text-center bg-[color:var(--color-surface-1)]">
          <p className="text-small text-muted-foreground">No gaps in this severity.</p>
          <button onClick={() => setFilter("ALL")} className="text-small font-medium text-[color:var(--color-accent)] underline mt-[8px]">Show all</button>
        </div>
      ) : (
        grouped.map(({ severity, items }, si) => (
          <section key={severity} className="flex flex-col gap-[12px]">
            <div className="flex items-baseline gap-[12px] px-[2px]">
              <span className={cn("size-2 rounded-full shrink-0", LABEL[severity].dot)} aria-hidden />
              <h2 className="text-small font-semibold uppercase tracking-wide" style={{ color: TINT[severity] }}>{LABEL[severity].title}</h2>
              <span className="text-small text-muted-foreground hidden md:inline">{LABEL[severity].blurb}</span>
              <span className="ml-auto num text-small tabular-mono text-muted-foreground">{items.length}</span>
            </div>
            <div className="card-grid">
              {items.map((gap, i) => (
                <div key={gap.competencyId} className="token-entrance-stagger" style={{ ["--stagger" as string]: i } as React.CSSProperties}>
                  <GapCard competencyName={gap.competencyName} domainName={gap.domainName} currentLevel={gap.currentLevel} requiredLevel={gap.requiredLevel} severity={gap.severity} reason={gap.reason} />
                  <div className="mt-[8px] flex items-center gap-[8px] px-[4px]">
                    <span className="num text-[11px] tabular-mono text-muted-foreground">{gap.gapSize}-level gap · weighted {gap.weighted.toFixed(2)}</span>
                    <Link href="/courses" className="ml-auto text-[12px] font-medium text-[color:var(--color-accent)] hover:underline">View course →</Link>
                  </div>
                </div>
              ))}
            </div>
            {si < grouped.length - 1 ? <div className="h-px bg-[color:var(--color-border-resting)] mt-[8px]" /> : null}
          </section>
        ))
      )}

      {unknown.length > 0 ? (
        <section className="flex flex-col gap-[12px] border-t border-[color:var(--color-border-resting)] pt-[24px]">
          <div>
            <h2 className="text-small font-semibold uppercase tracking-wide text-[color:var(--color-unassessed)]">Not yet assessed</h2>
            <p className="text-small text-muted-foreground">These matter to your role but haven’t been measured — not a gap, just unknown until you take a diagnostic.</p>
          </div>
          <div className="card-grid">
            {unknown.map((u) => (
              <div key={u.competencyId} className="flex items-center justify-between gap-[12px] rounded-[20px] border border-dashed border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px]">
                <div>
                  <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">{u.domainName}</p>
                  <p className="text-small font-semibold mt-[2px]">{u.competencyName}</p>
                  <p className="text-[11px] tabular-mono text-[color:var(--color-unassessed)] mt-[4px]">Requires Lv {u.requiredLevel} · not measured</p>
                </div>
                <Link href="/assessment/new" className={buttonVariants({ variant: "outline", size: "sm" })}>Assess this</Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
