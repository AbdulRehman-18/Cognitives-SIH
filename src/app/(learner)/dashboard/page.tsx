import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { DomainMatrix } from "@/components/caliper/domain-matrix";
import { buttonVariants } from "@/components/ui/button";

export default async function LearnerDashboardPage() {
  const session = await requireRole("LEARNER");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { roleId: true, jobRole: true },
  });
  if (!user?.roleId || !user.jobRole) redirect("/onboarding");

  const [domains, userCompetencies, gaps, recommendations, learningPath] = await Promise.all([
    db.domain.findMany({ include: { _count: { select: { competencies: true } } } }),
    db.userCompetency.findMany({ where: { userId: session.user.id }, include: { competency: { select: { domainId: true } } } }),
    db.skillGap.findMany({ where: { userId: session.user.id }, orderBy: [{ severity: "asc" }, { priorityScore: "desc" }], take: 3, include: { competency: { select: { name: true } } } }),
    db.recommendation.findMany({ where: { userId: session.user.id }, take: 1, orderBy: { score: "desc" }, include: { course: { select: { title: true } }, gap: { select: { competency: { select: { name: true } } } } } }),
    db.learningPath.findFirst({ where: { userId: session.user.id }, include: { items: { take: 1, orderBy: { order: "asc" }, include: { course: { select: { title: true } } } } } }),
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

  const nextAction = gaps[0]
    ? { label: `Close your ${gaps[0].severity.toLowerCase()} gap: ${gaps[0].competency.name}`, href: "/gaps" }
    : recommendations[0]
      ? { label: `Start: ${recommendations[0].course.title}`, href: "/courses" }
      : learningPath?.items[0]
        ? { label: `Continue: ${learningPath.items[0].course.title}`, href: "/path" }
        : { label: "Take a diagnostic assessment", href: "/assessment/new" };

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Your competency snapshot</h1>
            <p className="mt-1 text-sm text-muted-foreground">Measured ranges across the four-domain framework.</p>
          </div>
          <Link href={nextAction.href} className={buttonVariants({ variant: "default" })}>{nextAction.label} →</Link>
        </div>

        <DomainMatrix
          domains={domains.map((d) => {
            const entry = ucByDomain.get(d.id)!;
            const avg = entry.scores.length ? entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length : null;
            const level = avg == null ? null : Math.max(1, Math.min(5, Math.ceil(avg / 20)));
            return { domainCode: d.code, domainName: d.name, level, competencyCount: d._count.competencies, assessedCount: entry.assessed };
          })}
        />

        {gaps.length > 0 && (
          <div className="rounded-md border border-border p-4">
            <h2 className="text-sm font-medium">Top gaps</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {gaps.map((g) => (
                <li key={g.id} className="flex justify-between text-sm">
                  <span>{g.competency.name}</span>
                  <span className="tabular-mono text-muted-foreground">{g.severity}</span>
                </li>
              ))}
            </ul>
            <Link href="/gaps" className="mt-3 inline-block text-sm font-medium text-[color:var(--color-measure)] underline">View all gaps →</Link>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href="/courses" className={buttonVariants({ variant: "outline" })}>Recommended courses</Link>
          <Link href="/path" className={buttonVariants({ variant: "outline" })}>Learning path</Link>
          <Link href="/tutor" className={buttonVariants({ variant: "outline" })}>AI Tutor</Link>
        </div>
      </div>
    </AppShell>
  );
}
