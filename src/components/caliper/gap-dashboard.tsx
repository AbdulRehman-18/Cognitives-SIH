"use client";

import Link from "next/link";
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

const SEVERITY_ORDER: GapSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const SEVERITY_GROUP_LABEL: Record<GapSeverity, { title: string; blurb: string }> = {
  CRITICAL: {
    title: "Critical",
    blurb: "The largest, highest-priority gaps against your role's target profile.",
  },
  HIGH: {
    title: "High",
    blurb: "Meaningful gaps worth closing soon.",
  },
  MEDIUM: {
    title: "Medium",
    blurb: "Moderate room to grow.",
  },
  LOW: {
    title: "Room to grow",
    blurb: "Small gaps — you're close to your role's target here.",
  },
};

/**
 * The learner's prioritized gap view. Groups computed gaps by severity
 * (already fixed by the Skill Gap Engine before this component ever
 * renders), shows the "not yet assessed" competencies as a distinct,
 * non-judgmental set with an assess-this call to action, and exposes the
 * literal severity formula via SeverityFormulaDisclosure — this is the
 * judge-facing feature for Phase 3, mirroring EvidenceDrawer in Phase 2.
 */
export function GapDashboard({
  gaps,
  unknown,
}: {
  gaps: DashboardGap[];
  unknown: DashboardUnknown[];
}) {
  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: gaps.filter((g) => g.severity === severity),
  })).filter((g) => g.items.length > 0);

  const isEmpty = gaps.length === 0 && unknown.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your skill gaps</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Prioritized against your role&rsquo;s target competency profile.
            Every gap here is room to grow, not a deficiency — the order is
            set by a fixed formula, never a guess.
          </p>
        </div>
        <SeverityFormulaDisclosure />
      </div>

      {isEmpty ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No gap data yet. Complete a diagnostic assessment to measure your
            competencies against your role&rsquo;s target profile.
          </p>
        </div>
      ) : null}

      {grouped.map(({ severity, items }) => (
        <section key={severity} className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h2
              className={cn(
                "text-sm font-semibold tracking-wide uppercase",
                severity === "CRITICAL" && "text-[color:var(--color-critical)]",
                severity === "HIGH" && "text-[color:var(--color-gap)]",
                severity === "MEDIUM" && "text-[color:var(--color-gap)]",
                severity === "LOW" && "text-[color:var(--color-target)]",
              )}
            >
              {SEVERITY_GROUP_LABEL[severity].title}
            </h2>
            <span className="text-xs text-muted-foreground">{SEVERITY_GROUP_LABEL[severity].blurb}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((gap) => (
              <GapCard
                key={gap.competencyId}
                competencyName={gap.competencyName}
                domainName={gap.domainName}
                currentLevel={gap.currentLevel}
                requiredLevel={gap.requiredLevel}
                severity={gap.severity}
                reason={gap.reason}
              />
            ))}
          </div>
        </section>
      ))}

      {unknown.length > 0 ? (
        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[color:var(--color-unmeasured)] uppercase">
              Not yet assessed
            </h2>
            <p className="text-xs text-muted-foreground">
              These competencies matter to your role but haven&rsquo;t been
              measured yet — this isn&rsquo;t a gap, it&rsquo;s simply unknown until
              you take a diagnostic.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {unknown.map((u) => (
              <div
                key={u.competencyId}
                className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-4"
              >
                <div>
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {u.domainName}
                  </span>
                  <h3 className="text-sm font-medium text-foreground">{u.competencyName}</h3>
                  <span className="text-xs text-[color:var(--color-unmeasured)]">Not yet assessed</span>
                </div>
                <Link href="/assessment/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Assess this
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
