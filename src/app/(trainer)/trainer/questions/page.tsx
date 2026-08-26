import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { QuestionReviewCard, type ReviewQuestion } from "@/app/(trainer)/trainer/questions/question-review-card";

export default async function TrainerQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ assessmentId?: string }>;
}) {
  const session = await requireRole("TRAINER");
  const { assessmentId } = await searchParams;

  const questions = await db.question.findMany({
    where: {
      assessment: { ownerId: session.user.id, type: "STANDARD" },
      ...(assessmentId ? { assessmentId } : {}),
    },
    include: {
      competency: true,
      sourceChunk: { select: { chunkIndex: true, content: true } },
    },
    orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }],
  });

  const reviewQuestions: ReviewQuestion[] = questions.map((q) => ({
    id: q.id,
    stem: q.stem,
    options: q.optionsJson as string[],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: Number(q.difficulty),
    reviewStatus: q.reviewStatus,
    competencyName: q.competency.name,
    sourceChunk: q.sourceChunk,
  }));

  return (
    <AppShell roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing publishes unreviewed. Every question below is shown
            beside the source chunk it was grounded in.
          </p>
        </div>

        {reviewQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No questions to review yet — generate some from{" "}
            <a href="/trainer/assessments" className="underline">
              Assessments
            </a>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {reviewQuestions.map((q) => (
              <QuestionReviewCard key={q.id} question={q} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
