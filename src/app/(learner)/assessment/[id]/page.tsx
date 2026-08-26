import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AssessmentRunner, type RunnerQuestion } from "@/app/(learner)/assessment/[id]/assessment-runner";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("LEARNER");
  const { id } = await params;

  const assessment = await db.assessment.findUnique({
    where: { id },
    include: {
      questions: {
        include: { competency: { include: { domain: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!assessment) {
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

  const questions: RunnerQuestion[] = visibleQuestions.map((q) => ({
    id: q.id,
    stem: q.stem,
    options: q.optionsJson as string[],
    competencyId: q.competencyId,
    competencyName: q.competency.name,
    domainName: q.competency.domain.name,
  }));

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <AssessmentRunner assessmentId={assessment.id} questions={questions} />
    </AppShell>
  );
}
