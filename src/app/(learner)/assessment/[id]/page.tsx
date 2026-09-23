import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AssessmentRunner, type RunnerQuestion } from "@/app/(learner)/assessment/[id]/assessment-runner";
import { maxAdaptiveItems } from "@/lib/engines/adaptive";

export default async function AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ context?: string; mode?: string }>;
}) {
  const session = await requireRole("LEARNER");
  const { id } = await params;
  const { context, mode } = await searchParams;

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      questions: {
        include: { competency: { include: { domain: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Self-evaluation quizzes run on /tutor/quiz, never through the official runner.
  if (!assessment || assessment.type === "SELF_EVAL") {
    notFound();
  }

  // DIAGNOSTIC assessments are generated per-learner and never shared — only
  // their owner may take them. STANDARD (trainer-authored, RAG-generated)
  // assessments are shared: any learner may take a PUBLISHED one, tracked
  // per-attempt via QuizAttempt.userId rather than Assessment.ownerId.
  const isOwner = assessment.ownerId === session.user.id;
  const isSharedAndPublished = assessment.type === "STANDARD" && assessment.status === "PUBLISHED";
  if (!isOwner && !isSharedAndPublished) {
    notFound();
  }

  // Never send correctAnswer to the client — scoring happens server-side in
  // the submit route, against the engine, not by comparing on the client.
  // Nothing unreviewed is ever shown to a learner (PRD §4.7/Phase 5): a
  // STANDARD assessment only ever surfaces its APPROVED questions.
  const visibleQuestions =
    assessment.type === "STANDARD"
      ? assessment.questions.filter((q) => q.reviewStatus === "APPROVED")
      : assessment.questions;

  // Adaptive mode only for the learner's own diagnostic (its pool is sized for it).
  const adaptive =
    mode === "adaptive" && assessment.type === "DIAGNOSTIC" && isOwner
      ? { maxItems: maxAdaptiveItems(visibleQuestions.map((q) => ({ id: q.id, competencyId: q.competencyId, difficulty: Number(q.difficulty) }))) }
      : undefined;

  const questions: RunnerQuestion[] = visibleQuestions.map((q) => ({
    id: q.id,
    stem: q.stem,
    options: q.optionsJson as string[],
    competencyId: q.competencyId,
    competencyName: q.competency.name,
    domainName: q.competency.domain.name,
  }));

  return (
    <>
      <AssessmentRunner
        assessmentId={assessment.id}
        questions={questions}
        adaptive={adaptive}
        // PRD §5.4: the onboarding diagnostic never lands on the generic
        // results screen with a "go to dashboard" exit — it routes straight
        // to the partial gap report, which itself picks the one next action.
        resultsHref={context === "onboarding" ? "/onboarding/report" : undefined}
      />
    </>
  );
}
