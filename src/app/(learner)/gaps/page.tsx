import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { GapDashboard } from "@/components/caliper/gap-dashboard";
import { loadGapAnalysis } from "@/lib/gap-reasoning/load-gap-analysis";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";

export default async function GapsPage() {
  const session = await requireRole("LEARNER");
  const data = await loadGapAnalysis(session.user.id);

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="page-shell py-[24px]">
        <div className="mb-[16px]">
          <Breadcrumbs>
            <BreadcrumbItem href="/dashboard">Overview</BreadcrumbItem>
            <BreadcrumbItem isCurrent>Gap Report</BreadcrumbItem>
          </Breadcrumbs>
        </div>
        {data ? (
          <GapDashboard
            gaps={data.gaps.map((g) => ({ ...g, reason: data.reasons[g.competencyId] }))}
            unknown={data.unknown}
          />
        ) : (
          <div className="rounded-[6px] border border-dashed border-[color:var(--color-border-resting)] p-[32px] text-center">
            <p className="text-body text-muted-foreground">
              No job role assigned yet — gap analysis compares your measured
              competencies against a role&rsquo;s target profile, so it needs a
              role to compare against first.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
