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

  if (!assessment || assessment.ownerId !== session.user.id) {
    notFound();
  }

  // Never send correctAnswer to the client — scoring happens server-side in
  // the submit route, against the engine, not by comparing on the client.
  const questions: RunnerQuestion[] = assessment.questions.map((q) => ({
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
