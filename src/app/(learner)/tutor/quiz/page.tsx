import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import QuizRunner from "./quiz-runner";

export default async function TutorQuizPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const session = await requireRole("LEARNER");
  const { topic } = await searchParams;

  const [user, gaps, personalDocs, sharedCount] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { jobRole: { select: { roleCompetencies: { select: { competency: { select: { id: true, name: true } } } } } } },
    }),
    db.skillGap.findMany({
      where: { userId: session.user.id },
      orderBy: [{ severity: "asc" }, { priorityScore: "desc" }],
      select: { severity: true, competency: { select: { id: true, name: true } } },
    }),
    db.document.findMany({
      where: { ownerId: session.user.id, scope: "PERSONAL", processingStatus: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true },
    }),
    db.document.count({ where: { scope: "SHARED", processingStatus: "READY" } }),
  ]);

  // Gap competencies first (most urgent first), then the rest of the role's competencies.
  const seen = new Set<string>();
  const competencies = [
    ...gaps.map((g) => ({ id: g.competency.id, name: g.competency.name, note: `${g.severity.toLowerCase()} gap` })),
    ...(user?.jobRole?.roleCompetencies ?? []).map((rc) => ({ id: rc.competency.id, name: rc.competency.name, note: null })),
  ].filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  return (
    <div className="page-shell py-6 max-w-[760px]">
      <QuizRunner
        initialTopic={topic ?? ""}
        competencies={competencies}
        documents={personalDocs.map((d) => ({ id: d.id, label: d.fileName ?? "Untitled document" }))}
        sharedDocumentCount={sharedCount}
      />
    </div>
  );
}
