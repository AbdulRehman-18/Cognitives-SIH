import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { PathTimeline, type PathTimelineItem } from "@/components/caliper/path-timeline";
import { loadLearningPath } from "@/lib/recommendations/load-learning-path";

/**
 * Learner learning path — server component. The week sequence is exactly
 * what the Learning Path Engine computed (Kahn's order + bin-packing); the
 * UI renders it, never re-orders it.
 */
export default async function PathPage() {
  const session = await requireRole("LEARNER");
  const data = await loadLearningPath(session.user.id);

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Your learning path
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ordered by prerequisites first, then gap priority — packed into a{" "}
              {data?.maxWeeklyHours ?? 5}-hour weekly study budget.
            </p>
          </div>
          <Link
            href="/courses"
            className="text-sm font-medium text-[color:var(--color-measure)] underline decoration-border underline-offset-4 hover:decoration-[color:var(--color-measure)]"
          >
            ← All recommendations
          </Link>
        </div>

        {!data || data.weeks.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No learning path yet — it&rsquo;s built from your top recommendation per
              identified gap. Take a diagnostic assessment and review your{" "}
              <Link href="/courses" className="underline underline-offset-4">
                recommended courses
              </Link>{" "}
              first.
            </p>
          </div>
        ) : (
          <PathTimeline
            className="mt-8"
            weeks={data.weeks.map((week) => ({
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
                      ? "bg-[color-mix(in_oklch,var(--color-critical),transparent_85%)] text-[color:var(--color-critical)]"
                      : item.severity === "LOW"
                        ? "bg-[color-mix(in_oklch,var(--color-target),transparent_88%)] text-[color:var(--color-target)]"
                        : "bg-[color-mix(in_oklch,var(--color-gap),transparent_90%)] text-[color:var(--color-gap)]",
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
