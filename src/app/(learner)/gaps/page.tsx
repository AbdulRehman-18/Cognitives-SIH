import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { GapDashboard } from "@/components/caliper/gap-dashboard";
import { loadGapAnalysis } from "@/lib/gap-reasoning/load-gap-analysis";

/**
 * Server component: computes the gap analysis directly (Skill Gap Engine +
 * LLM reasoning + persistence, all server-side, RBAC-checked via
 * requireRole) rather than round-tripping through /api/gaps from the
 * client — this mirrors the AssessmentPage convention elsewhere in the app.
 * A missing job role isn't an error state; it's an honest "nothing to
 * compare against yet" message, same non-judgmental tone as everywhere else.
 */
export default async function GapsPage() {
  const session = await requireRole("LEARNER");
  const data = await loadGapAnalysis(session.user.id);

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        {data ? (
          <GapDashboard
            gaps={data.gaps.map((g) => ({ ...g, reason: data.reasons[g.competencyId] }))}
            unknown={data.unknown}
          />
        ) : (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
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
