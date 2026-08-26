import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/**
 * Published, trainer-authored assessments any learner may take — the entry
 * point for Golden Demo Flow step 9 ("Officer completes the quiz"). Only
 * PUBLISHED STANDARD assessments are listed; DRAFT ones (still in review)
 * never appear here (PRD §4.7 / Phase 5 "nothing publishes unreviewed").
 */
export default async function AvailableAssessmentsPage() {
  const session = await requireRole("LEARNER");

  const assessments = await db.assessment.findMany({
    where: { type: "STANDARD", status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    include: {
      questions: { where: { reviewStatus: "APPROVED" }, include: { competency: { include: { domain: true } } } },
    },
  });

  const withApprovedQuestions = assessments.filter((a) => a.questions.length > 0);

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Available assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trainer-published quizzes grounded in official source material.
            Completing one updates your measured competency immediately.
          </p>
        </div>

        {withApprovedQuestions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No published assessments yet — check back once a trainer has
              published one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {withApprovedQuestions.map((a) => {
              const competency = a.questions[0]?.competency;
              return (
                <Card key={a.id} className="rounded-md">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {competency?.domain.name ?? "General"}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {competency?.name ?? "Assessment"}
                      </span>
                      <span className="tabular-mono text-xs text-muted-foreground">
                        {a.questions.length} question{a.questions.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Link href={`/assessment/${a.id}`} className={buttonVariants({ variant: "default" })}>
                      Start
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
