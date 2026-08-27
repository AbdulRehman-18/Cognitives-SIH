import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { TrainerNav } from "@/components/trainer-nav";

export default async function TrainerDashboardPage() {
  const session = await requireRole("TRAINER");
  const [docCount, pendingQuestions, publishedAssessments, attemptCount, recentAttempts] = await Promise.all([
    db.document.count({ where: { ownerId: session.user.id } }),
    db.question.count({ where: { reviewStatus: "DRAFT", assessment: { ownerId: session.user.id } } }),
    db.assessment.count({ where: { ownerId: session.user.id, status: "PUBLISHED" } }),
    db.quizAttempt.count({ where: { assessment: { ownerId: session.user.id }, submittedAt: { not: null } } }),
    db.quizAttempt.findMany({ where: { assessment: { ownerId: session.user.id } }, orderBy: { submittedAt: "desc" }, take: 5, include: { assessment: { select: { id: true } } } }),
  ]);

  // Poorly performing topics: avg correctness by competency
  const answers = await db.quizAnswer.findMany({
    where: { quizAttempt: { assessment: { ownerId: session.user.id } } },
    include: { question: { select: { competency: { select: { name: true } } } } },
    take: 500,
  });
  const byComp = new Map<string, { total: number; correct: number }>();
  for (const a of answers) {
    const name = a.question.competency.name;
    const e = byComp.get(name) ?? { total: 0, correct: 0 };
    e.total += 1;
    if (a.isCorrect) e.correct += 1;
    byComp.set(name, e);
  }
  const weakTopics = [...byComp.entries()]
    .map(([name, v]) => ({ name, rate: v.correct / v.total }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  return (
     <AppShell nav={<TrainerNav />} roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-xl font-semibold">Trainer overview</h1>
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="rounded-md border border-border p-4"><p className="tabular-mono text-2xl font-semibold">{docCount}</p><p className="text-xs text-muted-foreground">Documents</p><Link href="/trainer/documents" className="text-xs underline">Manage →</Link></div>
          <div className="rounded-md border border-border p-4"><p className="tabular-mono text-2xl font-semibold">{pendingQuestions}</p><p className="text-xs text-muted-foreground">Questions to review</p><Link href="/trainer/questions" className="text-xs underline">Review →</Link></div>
          <div className="rounded-md border border-border p-4"><p className="tabular-mono text-2xl font-semibold">{publishedAssessments}</p><p className="text-xs text-muted-foreground">Published assessments</p><Link href="/trainer/assessments" className="text-xs underline">View →</Link></div>
          <div className="rounded-md border border-border p-4"><p className="tabular-mono text-2xl font-semibold">{attemptCount}</p><p className="text-xs text-muted-foreground">Learner performance</p><Link href="/trainer/learners" className="text-xs underline">View →</Link></div>
        </div>
        {weakTopics.length > 0 && (
          <div className="mt-6 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium">Topics needing attention (lowest correctness)</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {weakTopics.map((t) => (
                <li key={t.name} className="flex justify-between text-sm"><span>{t.name}</span><span className="tabular-mono text-muted-foreground">{(t.rate * 100).toFixed(0)}%</span></li>
              ))}
            </ul>
          </div>
        )}
        {recentAttempts.length > 0 && (
          <div className="mt-6 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium">Recent attempts</h2>
            <ul className="mt-2 text-sm text-muted-foreground">
              {recentAttempts.map((a) => (
                <li key={a.id}>{a.score != null ? `Score ${Number(a.score).toFixed(1)}` : "In progress"} — {a.submittedAt?.toLocaleDateString() ?? ""}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
