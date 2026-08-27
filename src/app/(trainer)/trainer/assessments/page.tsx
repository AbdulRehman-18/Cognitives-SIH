import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { TrainerNav } from "@/components/trainer-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GenerateMcqForm } from "@/app/(trainer)/trainer/assessments/generate-form";
import { AssessmentsList, type AssessmentSummary } from "@/app/(trainer)/trainer/assessments/assessments-list";

export default async function TrainerAssessmentsPage() {
  const session = await requireRole("TRAINER");

  const [readyDocuments, competencies, assessments] = await Promise.all([
    db.document.findMany({
      where: { ownerId: session.user.id, processingStatus: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, chunkCount: true, createdAt: true },
    }),
    db.competency.findMany({
      include: { domain: true },
      orderBy: [{ domain: { name: "asc" } }, { name: "asc" }],
    }),
    db.assessment.findMany({
      where: { ownerId: session.user.id, type: "STANDARD" },
      orderBy: { createdAt: "desc" },
      include: { questions: true },
    }),
  ]);

  const competencyById = new Map(competencies.map((c) => [c.id, c]));

  const assessmentSummaries: AssessmentSummary[] = assessments.map((a) => {
    const competency = competencyById.get(a.competencies[0]);
    return {
      id: a.id,
      status: a.status,
      competencyName: competency?.name ?? "Unknown competency",
      createdAt: a.createdAt.toISOString(),
      draftCount: a.questions.filter((q) => q.reviewStatus === "DRAFT").length,
      approvedCount: a.questions.filter((q) => q.reviewStatus === "APPROVED").length,
      rejectedCount: a.questions.filter((q) => q.reviewStatus === "REJECTED").length,
    };
  });

  return (
     <AppShell nav={<TrainerNav />} roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Assessments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate RAG-grounded questions from a processed document, review
            them, then publish for learners to take.
          </p>
        </div>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Generate questions</CardTitle>
            <CardDescription>
              Retrieval runs first, over the chosen document&rsquo;s own
              indexed chunks — the model never writes from general
              knowledge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateMcqForm
              documents={readyDocuments.map((d) => ({
                id: d.id,
                label: `${d.type.includes("pdf") ? "PDF" : d.type.includes("word") ? "DOCX" : "PPTX"} · ${d.chunkCount} chunks · ${new Date(d.createdAt).toLocaleDateString()}`,
              }))}
              competencies={competencies.map((c) => ({ id: c.id, label: `${c.domain.name} — ${c.name}` }))}
            />
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Your generated assessments
          </h2>
          <AssessmentsList assessments={assessmentSummaries} />
        </div>
      </div>
    </AppShell>
  );
}
