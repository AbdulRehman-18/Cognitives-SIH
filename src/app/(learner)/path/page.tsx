import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { PathTimeline, type PathTimelineItem } from "@/components/caliper/path-timeline";
import { loadLearningPath } from "@/lib/recommendations/load-learning-path";
import { Breadcrumbs, BreadcrumbItem } from "@astryxdesign/core/Breadcrumbs";

export default async function PathPage() {
  const session = await requireRole("LEARNER");
  const data = await loadLearningPath(session.user.id);
  const weeks = data?.weeks ?? [];
  const totalH = weeks.reduce((s: number, w: { hours: number }) => s + w.hours, 0);

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="mx-auto max-w-[880px] px-[20px] lg:px-[24px] py-[24px] flex flex-col gap-[16px]">
        <Breadcrumbs>
          <BreadcrumbItem href="/dashboard">Overview</BreadcrumbItem>
          <BreadcrumbItem href="/courses">Courses</BreadcrumbItem>
          <BreadcrumbItem isCurrent>Learning Path</BreadcrumbItem>
        </Breadcrumbs>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-[12px] mt-[4px]">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-[650] tracking-[-0.03em] leading-[1.05]">Your learning path</h1>
              <p className="text-body text-muted-foreground mt-[6px] max-w-[62ch]">Ordered by prerequisites first, then gap priority — packed into a {data?.maxWeeklyHours ?? 5}h weekly study budget. Professional pace, not Duolingo. Track, check off, and move forward.</p>
            </div>
          </div>
          {weeks.length ? (
            <div className="mt-[14px] flex flex-wrap gap-[8px] text-[11px] tabular-mono">
              <span className="rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[10px] py-[5px]">{weeks.length} weeks</span>
              <span className="rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[10px] py-[5px]">{totalH}h total</span>
              <span className="rounded-full bg-[color:var(--color-accent)] text-white px-[10px] py-[5px]">Next: Week 1 → start now</span>
            </div>
          ) : null}
        </div>

        {!data || weeks.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[color:var(--color-border-resting)] p-[32px] text-center bg-[color:var(--color-surface-1)]">
            <p className="text-body font-medium">No learning path yet</p>
            <p className="text-small text-muted-foreground mt-[6px]">It’s built from your top recommendation per identified gap. Take a diagnostic and review your <Link href="/courses" className="text-[color:var(--color-accent)] underline">recommended courses</Link> first.</p>
          </div>
        ) : (
          <PathTimeline
            weeks={weeks.map((week: { weekNumber: number; hours: number; items: { recommendationId: string; courseTitle: string; source: string; hours: number; rationale: string; externalUrl: string | null; severity: string }[] }) => ({
              weekNumber: week.weekNumber,
              hours: week.hours,
              items: week.items.map(
                (item): PathTimelineItem => ({
                  id: item.recommendationId,
                  title: item.courseTitle,
                  meta: `${item.source === "IGOT" ? "iGOT Karmayogi" : "NSSTA"} · ${item.hours}h`,
                  rationale: item.rationale,
                  href: item.externalUrl ?? undefined,
                  severityLabel: item.severity.charAt(0) + item.severity.slice(1).toLowerCase(),
                  severityClass:
                    item.severity === "CRITICAL"
                      ? "bg-[rgba(240,68,56,0.10)] text-[#C9190B] border-[rgba(240,68,56,0.18)]"
                      : item.severity === "LOW"
                        ? "bg-[rgba(18,183,106,0.10)] text-[#0E7A4B] border-[rgba(18,183,106,0.18)]"
                        : "bg-[rgba(247,144,9,0.12)] text-[#8A4D00] border-[rgba(247,144,9,0.18)]",
                }),
              ),
            }))}
            maxWeeklyHours={data.maxWeeklyHours}
          />
        )}
      </div>
    </AppShell>
  );
}
