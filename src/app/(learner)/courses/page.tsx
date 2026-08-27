import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ReasonBreakdown, type ReasonFactor } from "@/components/caliper/reason-breakdown";
import { loadRecommendations } from "@/lib/recommendations/load-recommendations";
import { RECOMMENDATION_WEIGHTS } from "@/lib/engines/recommendation";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";

export default async function CoursesPage() {
  const session = await requireRole("LEARNER");
  const data = await loadRecommendations(session.user.id);

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="mx-auto max-w-[1120px] px-[20px] lg:px-[24px] py-[28px] flex flex-col gap-[20px]">
        <Breadcrumbs>
          <BreadcrumbItem href="/dashboard">Dashboard</BreadcrumbItem>
          <BreadcrumbItem href="/gaps">Gaps</BreadcrumbItem>
          <BreadcrumbItem isCurrent>Courses</BreadcrumbItem>
        </Breadcrumbs>

        <div className="max-w-[720px]">
          <h1 className="text-[32px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05] text-foreground">Recommended courses</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[10px]">Traced from gap to course to evidence. Each gap ranks <span className="font-medium text-foreground">three courses</span> by a <span className="font-medium text-foreground">6-factor</span> formula — monochromatic, nothing hidden.</p>
        </div>

        {data && data.gaps.length > 0 && (
          <div className="flex flex-wrap items-center gap-[8px] border-y border-[color:var(--color-border-resting)] py-[12px]">
            <span className="text-[12px] font-medium text-muted-foreground">Hierarchy</span>
            <span className="text-[12px] font-semibold">Gap</span><span className="text-muted-foreground">→</span><span className="text-[12px] font-semibold">Ranked courses</span><span className="text-muted-foreground">→</span><span className="text-[12px] font-semibold">Why ranked</span>
            <span className="ml-auto flex gap-[8px]">
              <Link href="/path" className="rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] px-[14px] py-[7px] text-[12px] font-semibold">View learning path →</Link>
              <Link href="/gaps" className="hidden sm:inline-flex rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[7px] text-[12px] font-medium">Gaps</Link>
            </span>
          </div>
        )}

        {!data ? (
          <Card className="border-dashed p-[32px] text-center"><CardTitle className="text-[14px]">No role assigned yet</CardTitle><CardDescription className="mt-[4px]">Assign a role to rank courses against its target profile.</CardDescription></Card>
        ) : data.gaps.length === 0 ? (
          <Card className="border-dashed p-[32px] text-center"><CardTitle className="text-[14px]">No gaps — no ranking needed</CardTitle><CardDescription className="mt-[4px]">Take a <Link href="/assessment/new" className="text-[color:var(--color-accent)] underline">diagnostic</Link> to reveal gaps.</CardDescription></Card>
        ) : (
          <>
            {data.embeddedCourseCount === 0 && data.courseCount > 0 ? (
              <div className="rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] dark:bg-[#2A2410] dark:border-[#8A6D00]/30 px-[14px] py-[10px] text-[12px] text-[#92400E] dark:text-[#FDE68A]">Catalog not embedded — semantic factor scores 0. Run <code className="tabular-mono bg-[color:var(--color-surface-1)] border px-[4px] rounded">pnpm db:embed-courses</code>.</div>
            ) : null}

            {/* Hierarchy tree — no nested cards */}
            <div className="relative pl-[18px] sm:pl-[24px] border-l-[2px] border-[color:var(--color-border-resting)] flex flex-col gap-[36px] py-[8px]">
              {data.gaps.map((gap) => (
                <section key={gap.gapId} className="relative">
                  <span className="absolute -left-[27px] sm:-left-[33px] top-[2px] size-[16px] rounded-full bg-[color:var(--color-ink)] border-[3px] border-[color:var(--color-canvas)] shadow-sm flex items-center justify-center"><span className="size-[5px] rounded-full bg-[color:var(--color-canvas)]" /></span>

                  <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px] mb-[12px]">
                    <h2 className="text-[14px] font-[600] tracking-[-0.015em] text-foreground">{gap.competencyName}</h2>
                    <span className="text-[11px] tabular-mono tracking-[0.04em] text-muted-foreground">Lv {gap.currentLevel} → {gap.requiredLevel}</span>
                    <span className="ml-auto text-[10px] tracking-[0.08em] uppercase font-medium text-muted-foreground">{gap.recommendations.length} ranked</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-[12px]">
                    {gap.recommendations.map((rec, index) => {
                      const factors: ReasonFactor[] = [
                        { key: "semantic", label: "Semantic match", value: rec.factors.semanticSimilarity, weight: RECOMMENDATION_WEIGHTS.semanticSimilarity },
                        { key: "severity", label: "Gap priority", value: rec.factors.gapSeverityWeight, weight: RECOMMENDATION_WEIGHTS.gapSeverityWeight },
                        { key: "roleRelevance", label: "Role relevance", value: rec.factors.roleRelevance, weight: RECOMMENDATION_WEIGHTS.roleRelevance },
                        { key: "prereqs", label: "Prerequisite readiness", value: rec.factors.prerequisiteReadiness, weight: RECOMMENDATION_WEIGHTS.prerequisiteReadiness },
                        { key: "difficulty", label: "Difficulty fit", value: rec.factors.difficultyFit, weight: RECOMMENDATION_WEIGHTS.difficultyFit },
                        { key: "deptPriority", label: "Department priority", value: rec.factors.departmentPriority, weight: RECOMMENDATION_WEIGHTS.departmentPriority },
                      ];
                      const isTop = index === 0;
                      return (
                        <div key={rec.courseId} className="group flex flex-col rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                          <div className="p-[16px] pb-[12px] flex flex-col gap-[10px] flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] tabular-mono tracking-[0.06em] text-muted-foreground/70">0{index + 1}</span>
                              {isTop ? <span className="inline-flex items-center gap-[5px] text-[10px] tracking-[0.08em] uppercase font-semibold text-foreground"><span className="size-1 rounded-full bg-foreground" />Top fit</span> : rec.isClosestMatch ? <span className="text-[10px] tracking-[0.07em] uppercase font-medium text-muted-foreground">Closest match</span> : <span className="text-[10px] tracking-[0.07em] uppercase text-muted-foreground/50">—</span>}
                            </div>
                            <h3 className="text-[13.5px] font-[550] leading-[1.45] tracking-[-0.01em] line-clamp-3 min-h-[39px] text-foreground">
                              {rec.externalUrl ? <a href={rec.externalUrl} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4 decoration-zinc-300">{rec.title}</a> : rec.title}
                            </h3>
                            <div className="flex items-center gap-[8px] text-[11px] tabular-mono text-muted-foreground">
                              <span className="font-medium tracking-wide">{rec.source === "IGOT" ? "iGOT" : "NSSTA"}</span>
                              <span className="size-[2px] rounded-full bg-muted-foreground/30" />
                              <span>Lv {rec.level}/5</span>
                              <span className="size-[2px] rounded-full bg-muted-foreground/30" />
                              <span>{rec.durationHours}h</span>
                            </div>
                            {rec.isClosestMatch && <p className="text-[11px] leading-[1.5] text-muted-foreground border border-dashed border-[color:var(--color-border-resting)] rounded-[8px] px-[10px] py-[6px]">Nearest available — catalog coverage still growing.</p>}
                            <ReasonBreakdown factors={factors} score={rec.score} />
                          </div>
                          <div className="flex items-center justify-between border-t border-[color:var(--color-border-resting)] px-[16px] py-[10px] mt-auto">
                            <span className="text-[11px] tabular-mono text-muted-foreground/70">{rec.durationHours}h · Ready to enroll</span>
                            {rec.externalUrl ? (
                              <Link href={rec.externalUrl} target="_blank" className="text-[12px] font-medium tracking-[-0.01em] underline underline-offset-4 decoration-zinc-300 hover:decoration-foreground transition">
                                Open <span aria-hidden>→</span>
                              </Link>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">In catalog</span>
                            )}
                          </div>
                        </div>
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
