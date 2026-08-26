import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const UNDERPERFORMING_THRESHOLD = 0.5;

export default async function TrainerLearnersPage() {
  const session = await requireRole("TRAINER");

  const assessments = await db.assessment.findMany({
    where: { ownerId: session.user.id, type: "STANDARD", status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        include: {
          competency: { select: { id: true, name: true } },
          answers: { select: { isCorrect: true } },
        },
      },
      attempts: {
        where: { submittedAt: { not: null } },
        select: { id: true, score: true, userId: true },
      },
    },
  });

  const assessmentSummaries = assessments.map((a) => {
    const attemptCount = a.attempts.length;
    const avgScore =
      attemptCount > 0
        ? a.attempts.reduce((sum, at) => sum + Number(at.score ?? 0), 0) / attemptCount
        : null;

    const competencyNames = [...new Set(a.questions.map((q) => q.competency.name))];

    const questionBreakdown = a.questions.map((q) => {
      const total = q.answers.length;
      const correct = q.answers.filter((ans) => ans.isCorrect).length;
      const rate = total > 0 ? correct / total : null;
      return {
        id: q.id,
        stem: q.stem,
        competencyName: q.competency.name,
        total,
        correct,
        rate,
        underperforming: rate !== null && rate < UNDERPERFORMING_THRESHOLD,
      };
    });

    return {
      id: a.id,
      competencyLabel: competencyNames.length > 0 ? competencyNames.join(", ") : "Unknown competency",
      attemptCount,
      avgScore,
      questionBreakdown,
    };
  });

  const totalAttempts = assessmentSummaries.reduce((sum, a) => sum + a.attemptCount, 0);

  // Aggregate correctness by competency across all published assessments,
  // then flag competencies covered by more than one assessment that are
  // underperforming in aggregate — a single weak assessment doesn't tell you
  // much, but a weak competency across multiple assessments does.
  const competencyAgg = new Map<
    string,
    { name: string; total: number; correct: number; assessmentIds: Set<string> }
  >();
  for (const a of assessments) {
    for (const q of a.questions) {
      const entry = competencyAgg.get(q.competency.id) ?? {
        name: q.competency.name,
        total: 0,
        correct: 0,
        assessmentIds: new Set<string>(),
      };
      entry.total += q.answers.length;
      entry.correct += q.answers.filter((ans) => ans.isCorrect).length;
      entry.assessmentIds.add(a.id);
      competencyAgg.set(q.competency.id, entry);
    }
  }
  const weakCompetencies = [...competencyAgg.values()]
    .filter((c) => c.assessmentIds.size > 1 && c.total > 0)
    .map((c) => ({ name: c.name, rate: c.correct / c.total, assessmentCount: c.assessmentIds.size }))
    .filter((c) => c.rate < UNDERPERFORMING_THRESHOLD)
    .sort((a, b) => a.rate - b.rate);

  return (
    <AppShell roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Learner performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregate results across your published assessments — attempt
            counts, average scores, and which questions or competencies are
            underperforming and worth revisiting.
          </p>
        </div>

        {assessments.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No published assessments yet — publish one from{" "}
              <a href="/trainer/assessments" className="underline">
                Assessments
              </a>{" "}
              to start seeing learner performance here.
            </p>
          </div>
        ) : totalAttempts === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No attempts recorded yet — check back once learners have taken
              one of your published assessments.
            </p>
          </div>
        ) : (
          <>
            {weakCompetencies.length > 0 ? (
              <Card className="rounded-md">
                <CardHeader>
                  <CardTitle>Competencies needing attention</CardTitle>
                  <CardDescription>
                    Aggregate correctness below {(UNDERPERFORMING_THRESHOLD * 100).toFixed(0)}%
                    across two or more assessments covering the same competency.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {weakCompetencies.map((c) => (
                      <li key={c.name} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{c.name}</span>
                        <span className="tabular-mono text-[color:var(--color-critical)]">
                          {(c.rate * 100).toFixed(0)}% correct · {c.assessmentCount} assessments
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <div className="flex flex-col gap-4">
              {assessmentSummaries.map((a) => (
                <Card key={a.id} className="rounded-md">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          {a.competencyLabel}
                        </span>
                        <CardTitle>
                          {a.attemptCount} attempt{a.attemptCount === 1 ? "" : "s"}
                        </CardTitle>
                      </div>
                      {a.avgScore !== null ? (
                        <span
                          className={cn(
                            "tabular-mono text-lg font-semibold",
                            a.avgScore < UNDERPERFORMING_THRESHOLD * 100
                              ? "text-[color:var(--color-critical)]"
                              : "text-[color:var(--color-target)]",
                          )}
                        >
                          {a.avgScore.toFixed(1)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">avg score</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No attempts yet</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {a.questionBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No questions on this assessment.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {a.questionBreakdown.map((q) => (
                          <li
                            key={q.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                          >
                            <span className="line-clamp-1 text-sm text-foreground">{q.stem}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              {q.rate === null ? (
                                <span className="text-xs text-muted-foreground">No answers yet</span>
                              ) : (
                                <>
                                  <span
                                    className={cn(
                                      "tabular-mono text-xs",
                                      q.underperforming
                                        ? "text-[color:var(--color-critical)]"
                                        : "text-[color:var(--color-target)]",
                                    )}
                                  >
                                    {(q.rate * 100).toFixed(0)}% correct ({q.correct}/{q.total})
                                  </span>
                                  {q.underperforming ? (
                                    <Badge
                                      variant="outline"
                                      className="border-[color:var(--color-critical)]/40 text-[color:var(--color-critical)]"
                                    >
                                      Underperforming
                                    </Badge>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
