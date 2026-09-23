import Link from "next/link";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/rbac";
import { loadLearningPath } from "@/lib/recommendations/load-learning-path";
import { DEFAULT_MAX_WEEKLY_HOURS } from "@/lib/engines/learning-path";
import { LearningPathView, type PathViewItem } from "@/components/learner/learning-path-view";
import { IgotCourseAction } from "@/components/igot/igot-course-action";
import { igotMode } from "@/lib/igot";
import { loadCourseIgotState } from "@/lib/igot/progress";
import { BudgetControl } from "./budget-control";
import { PATH_BUDGET_COOKIE, parseBudget } from "./budget";

export default async function PathPage() {
  const session = await requireRole("LEARNER");
  const budget = parseBudget((await cookies()).get(PATH_BUDGET_COOKIE)?.value, DEFAULT_MAX_WEEKLY_HOURS);
  const data = await loadLearningPath(session.user.id, budget);
  const pathItems = data?.weeks.flatMap((w) => w.items) ?? [];
  const igotState = await loadCourseIgotState(session.user.id, pathItems.map((i) => i.courseId));
  const mockMode = igotMode() === "mock";

  const items: PathViewItem[] = pathItems.map((item) => {
    const state = igotState.get(item.courseId);
    const progress = state?.progress ?? null;
    const status: PathViewItem["status"] =
      item.source === "NSSTA" ? "untracked" : progress?.status === "COMPLETED" ? "done" : progress ? "active" : "todo";
    return {
      id: item.recommendationId,
      title: item.courseTitle,
      source: item.source,
      hours: item.hours,
      weekNumber: item.weekNumber,
      order: item.order,
      href: item.externalUrl,
      competencyName: item.competencyName,
      severity: item.severity,
      currentLevel: item.currentLevel,
      requiredLevel: item.requiredLevel,
      after: item.after,
      status,
      pct: progress?.progressPct ?? 0,
      action: (
        <IgotCourseAction
          courseId={item.courseId}
          source={item.source}
          synced={state?.synced ?? false}
          progress={progress}
          mockMode={mockMode}
        />
      ),
    };
  });

  return (
    <div className="page-shell flex max-w-[1080px] flex-col gap-[32px] py-[28px] md:py-[36px]">
      <header className="flex flex-wrap items-end justify-between gap-x-[24px] gap-y-[16px]">
        <div className="flex flex-col gap-[6px]">
          <h1 className="text-[28px] font-[650] leading-[1.1] tracking-[-0.025em]">Learning path</h1>
          <p className="max-w-[60ch] text-[14px] leading-[1.55] text-muted-foreground">
            One course per measured gap, ordered so prerequisites come first and paced to the time you have each week.
          </p>
        </div>
        {items.length > 0 && <BudgetControl value={budget} />}
      </header>

      {items.length ? (
        <LearningPathView items={items} budget={budget} />
      ) : (
        <section className="flex flex-col items-start gap-[12px] rounded-[16px] border border-dashed border-[color:var(--color-border-hover)] p-[28px]">
          <h2 className="text-[18px] font-semibold">No path yet</h2>
          <p className="max-w-[58ch] text-[14px] leading-[1.55] text-muted-foreground">
            Your path is built from the courses recommended for each gap. Take a diagnostic to measure your gaps, and the path appears here, ordered and scheduled.
          </p>
          <div className="mt-[4px] flex flex-wrap gap-[10px]">
            <Link href="/assessment/new" className="rounded-[10px] bg-[color:var(--color-accent)] px-[16px] py-[9px] text-[14px] font-medium text-white shadow-[var(--shadow-cta)] transition hover:brightness-110">
              Take a diagnostic
            </Link>
            <Link href="/courses" className="rounded-[10px] border border-[color:var(--color-border-hover)] px-[16px] py-[9px] text-[14px] font-medium transition-colors hover:bg-[color:var(--color-surface-1)]">
              See recommended courses
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
