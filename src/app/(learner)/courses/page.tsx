import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { ReasonBreakdown, type ReasonFactor } from "@/components/caliper/reason-breakdown";
import { loadRecommendations } from "@/lib/recommendations/load-recommendations";
import { RECOMMENDATION_WEIGHTS } from "@/lib/engines/recommendation";

/**
 * Learner recommendations — server component calling the orchestrator
 * directly (mirrors /gaps). Every recommendation renders its computed
 * per-factor breakdown (PRD §4.5): no course appears without a visible
 * reason and rank. Weak matches carry an explicit "closest match" caveat.
 */
export default async function CoursesPage() {
  const session = await requireRole("LEARNER");
  const data = await loadRecommendations(session.user.id);

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Recommended courses
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked per gap by a six-factor formula — every factor&rsquo;s
              contribution is shown, nothing is hidden.
            </p>
          </div>
          {data && data.gaps.length > 0 ? (
            <Link
              href="/path"
              className="text-sm font-medium text-[color:var(--color-measure)] underline decoration-border underline-offset-4 hover:decoration-[color:var(--color-measure)]"
            >
              View your learning path →
            </Link>
          ) : null}
        </div>

        {!data ? (
          <div className="mt-8 rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No job role assigned yet — recommendations rank courses against your
              role&rsquo;s target profile, so they need a role to compare against first.
            </p>
          </div>
        ) : data.gaps.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No gaps identified yet. Take a{" "}
              <Link href="/assessment/new" className="underline underline-offset-4">
                diagnostic assessment
              </Link>{" "}
              first — recommendations are driven by what the measurements show,
              not by guesswork.
            </p>
          </div>
        ) : (
          <>
            {data.embeddedCourseCount === 0 && data.courseCount > 0 ? (
              <p className="mt-6 rounded-md border border-border bg-[color-mix(in_oklch,var(--color-unmeasured),transparent_90%)] px-4 py-3 text-xs text-muted-foreground">
                The course catalog hasn&rsquo;t been embedded yet
                ({data.embeddedCourseCount}/{data.courseCount} courses), so the semantic-similarity
                factor is scoring 0 across the board and ranking runs on the rule-based factors alone.
                Run <code className="tabular-mono">pnpm db:embed-courses</code> to enable it fully.
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-10">
              {data.gaps.map((gap) => (
                <section key={gap.gapId} aria-label={`Recommendations for ${gap.competencyName}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-medium text-foreground">{gap.competencyName}</h2>
                    <span className="tabular-mono text-xs text-muted-foreground">
                      level {gap.currentLevel} → {gap.requiredLevel}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {gap.recommendations.map((rec, index) => {
                      const factors: ReasonFactor[] = [
                        { key: "semantic", label: "Semantic match", value: rec.factors.semanticSimilarity, weight: RECOMMENDATION_WEIGHTS.semanticSimilarity },
                        { key: "severity", label: "Gap priority", value: rec.factors.gapSeverityWeight, weight: RECOMMENDATION_WEIGHTS.gapSeverityWeight },
                        { key: "roleRelevance", label: "Role relevance", value: rec.factors.roleRelevance, weight: RECOMMENDATION_WEIGHTS.roleRelevance },
                        { key: "prereqs", label: "Prerequisite readiness", value: rec.factors.prerequisiteReadiness, weight: RECOMMENDATION_WEIGHTS.prerequisiteReadiness },
                        { key: "difficulty", label: "Difficulty fit", value: rec.factors.difficultyFit, weight: RECOMMENDATION_WEIGHTS.difficultyFit },
                        { key: "deptPriority", label: "Department priority", value: rec.factors.departmentPriority, weight: RECOMMENDATION_WEIGHTS.departmentPriority },
                      ];
                      return (
                        <article
                          key={rec.courseId}
                          className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="tabular-mono text-xs text-muted-foreground">#{index + 1}</span>
                            {rec.isClosestMatch ? (
                              <span className="rounded-sm bg-[color-mix(in_oklch,var(--color-unmeasured),transparent_85%)] px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                Closest available match
                              </span>
                            ) : null}
                          </div>
                          <h3 className="text-sm font-medium leading-snug text-foreground">
                            {rec.externalUrl ? (
                              <a
                                href={rec.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline decoration-border underline-offset-4 hover:decoration-[color:var(--color-measure)]"
                              >
                                {rec.title}
                              </a>
                            ) : (
                              rec.title
                            )}
                          </h3>
                          <p className="tabular-mono text-xs text-muted-foreground">
                            {rec.source === "IGOT" ? "iGOT Karmayogi" : "NSSTA"} · level {rec.level}/5 ·{" "}
                            {rec.durationHours}h
                          </p>
                          {rec.isClosestMatch ? (
                            <p className="text-xs italic text-muted-foreground">
                              The catalog doesn&rsquo;t cover this competency strongly yet — this is
                              the nearest available option, offered with that caveat.
                            </p>
                          ) : null}
                          <ReasonBreakdown factors={factors} score={rec.score} />
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
