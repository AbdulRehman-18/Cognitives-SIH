import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { DomainMatrix } from "@/components/caliper/domain-matrix";
import { CaliperGauge } from "@/components/caliper/caliper-gauge";
import { ScoreReadout } from "@/components/caliper/score-readout";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadGapAnalysis } from "@/lib/gap-reasoning/load-gap-analysis";

// PRD §5.4 steps 3-4 — the FIRST screen an officer sees after their one
// onboarding diagnostic. Never the full dashboard: this page shows exactly
// the one measured domain plus an honest "not yet assessed" state for the
// other three, then routes to a single next action (Product Principle #3 —
// "One Clear Action per Screen"). It reuses the same DomainMatrix component
// and gap-analysis pipeline the real dashboard and /gaps page use — no
// parallel scoring logic.
export default async function OnboardingReportPage() {
  const session = await requireRole("LEARNER");

  const [domains, userCompetencies, gapData] = await Promise.all([
    db.domain.findMany({ include: { _count: { select: { competencies: true } } } }),
    db.userCompetency.findMany({
      where: { userId: session.user.id },
      include: { competency: { select: { domainId: true, name: true } } },
    }),
    loadGapAnalysis(session.user.id),
  ]);

  const ucByDomain = new Map<string, { scores: number[]; assessed: number }>();
  for (const d of domains) ucByDomain.set(d.id, { scores: [], assessed: 0 });
  for (const uc of userCompetencies) {
    if (uc.currentScore == null) continue;
    const entry = ucByDomain.get(uc.competency.domainId);
    if (!entry) continue;
    entry.scores.push(Number(uc.currentScore));
    entry.assessed += 1;
  }

  const domainEntries = domains.map((d) => {
    const entry = ucByDomain.get(d.id)!;
    const avg = entry.scores.length ? entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length : null;
    const level = avg == null ? null : Math.max(1, Math.min(5, Math.ceil(avg / 20)));
    return { domainCode: d.code, domainName: d.name, level, competencyCount: d._count.competencies, assessedCount: entry.assessed, avg };
  });

  const measuredDomain = domainEntries.find((d) => d.assessedCount > 0);
  const justMeasured = userCompetencies.find((uc) => uc.currentScore != null);

  // Single next action: the most significant flagged gap if one exists,
  // otherwise "assess your next domain" — never a bare link to the full
  // dashboard as the first thing an officer sees.
  const topGap = gapData?.gaps[0];
  const nextAction = topGap
    ? { label: `Close your ${topGap.severity.toLowerCase()} gap: ${topGap.competencyName}`, href: "/gaps" }
    : { label: "Assess your next domain", href: "/assessment/new" };

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="page-shell section-stack py-[48px] max-w-[800px] token-entrance">
        <div className="flex flex-col gap-[8px]">
          <h1 className="text-h1 text-foreground">Your first measurement</h1>
          <p className="text-body text-muted-foreground">
            One domain measured, three still to go. This is a partial
            picture on purpose — the rest fills in as you keep assessing.
          </p>
        </div>

        {justMeasured && measuredDomain ? (
          <Card>
            <CardContent className="flex flex-col gap-[24px] sm:flex-row sm:items-center">
              <CaliperGauge
                value={justMeasured.currentScore != null ? Number(justMeasured.currentScore) : null}
                min={0}
                max={100}
                srLabel={justMeasured.competency.name}
                unitLabel="of 100"
              />
              <div className="flex flex-col gap-[4px]">
                <span className="text-eyebrow text-muted-foreground">
                  {measuredDomain.domainName}
                </span>
                <h2 className="text-h3 text-foreground">{justMeasured.competency.name}</h2>
                <ScoreReadout level={measuredDomain.level} label="Measured level" />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col gap-[16px]">
          <h2 className="text-eyebrow text-muted-foreground">
            All four domains
          </h2>
          <DomainMatrix
            domains={domainEntries.map(({ domainCode, domainName, level, competencyCount, assessedCount }) => ({
              domainCode,
              domainName,
              level,
              competencyCount,
              assessedCount,
            }))}
          />
        </div>

        <div>
          <Link href={nextAction.href} className={buttonVariants({ variant: "default", size: "lg" })}>
            {nextAction.label} →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
