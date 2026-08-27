import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { TrainerNav } from "@/components/trainer-nav";
import HierarchyTree from "./hierarchy-tree";

export default async function TrainerLearnersPage() {
  const session = await requireRole("TRAINER");

  const assessments = await db.assessment.findMany({
    where: { ownerId: session.user.id, type: "STANDARD", status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    include: {
      questions: { include: { competency: { select: { id: true, name: true, domain: { select: { name: true } } } }, answers: { select: { isCorrect: true } } } },
      attempts: { where: { submittedAt: { not: null } }, select: { id: true, score: true, userId: true, user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } } } },
    },
  });

  // Build hierarchy: Department -> Learner -> Attempts
  const deptMap = new Map<string, { name: string; learners: Map<string, { name: string; email: string; attempts: typeof assessments[number]["attempts"] }> }>();

  for (const a of assessments) {
    for (const at of a.attempts) {
      const deptName = at.user.department?.name ?? "Unassigned Division";
      if (!deptMap.has(deptName)) deptMap.set(deptName, { name: deptName, learners: new Map() });
      const dept = deptMap.get(deptName)!;
      const key = at.user.id;
      if (!dept.learners.has(key)) dept.learners.set(key, { name: at.user.name ?? at.user.email, email: at.user.email, attempts: [] });
      dept.learners.get(key)!.attempts.push(at as any);
    }
  }

  // Weak competencies aggregate
  const compAgg = new Map<string, { name: string; domain: string; total: number; correct: number; assessments: Set<string> }>();
  for (const a of assessments) {
    for (const q of a.questions) {
      const e = compAgg.get(q.competency.id) ?? { name: q.competency.name, domain: q.competency.domain.name, total: 0, correct: 0, assessments: new Set<string>() };
      e.total += q.answers.length;
      e.correct += q.answers.filter((x) => x.isCorrect).length;
      e.assessments.add(a.id);
      compAgg.set(q.competency.id, e);
    }
  }
  const weak = [...compAgg.values()]
    .filter((c) => c.assessments.size > 1 && c.total > 0 && c.correct / c.total < 0.5)
    .map((c) => ({ name: c.name, domain: c.domain, rate: c.correct / c.total }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 4);

  const hierarchy = Array.from(deptMap.values()).map((d) => ({
    name: d.name,
    learnerCount: d.learners.size,
    learners: Array.from(d.learners.values()).map((l) => ({
      name: l.name,
      email: l.email,
      score: l.attempts.length ? l.attempts.reduce((s, a) => s + Number(a.score ?? 0), 0) / l.attempts.length : null,
      attempts: l.attempts.length,
    })),
  }));

  const totalAttempts = assessments.reduce((s, a) => s + a.attempts.length, 0);

  return (
     <AppShell nav={<TrainerNav />} roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"}>
      <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[20px]">
        <div className="max-w-[720px]">
          <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Learners</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[8px]">Hierarchy of your learners — organization → division → officer → performance. No walls of cards, just a tree you can follow.</p>
          <p className="text-[12px] tabular-mono text-muted-foreground mt-[6px]">{hierarchy.reduce((s, d) => s + d.learnerCount, 0)} learners · {totalAttempts} attempts · {assessments.length} published assessments</p>
        </div>

        {assessments.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[32px] text-center">
            <p className="text-[14px] font-medium">No published assessments yet</p>
            <p className="text-[13px] text-muted-foreground mt-[4px]">Publish from Assessments to grow this tree.</p>
          </div>
        ) : hierarchy.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[32px] text-center">
            <p className="text-[14px] text-muted-foreground">No attempts yet. The tree will populate as officers take your assessments.</p>
          </div>
        ) : (
          <HierarchyTree hierarchy={hierarchy} weak={weak} />
        )}
      </div>
    </AppShell>
  );
}
