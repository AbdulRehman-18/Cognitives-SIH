import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { generateMcqRequestSchema } from "@/lib/validation/questions";
import { retrieveFromDocument } from "@/lib/rag/retrieve";
import { generateMcqQuestions } from "@/lib/questions/generate-mcq";
import { classifyAiError } from "@/lib/ai/errors";

// RAG-grounded MCQ generation: retrieve first, then generate (RestPlan.md
// Phase 5). Every persisted Question carries a non-null sourceChunkId —
// PRD §4.7's traceability acceptance criterion — and starts DRAFT, so
// nothing publishes unreviewed (see the trainer review queue). Target <=30s
// (PRD §4.11); the LLM call dominates the budget.
export const maxDuration = 30;

const RETRIEVAL_K = 8;

export async function POST(request: NextRequest) {
  try {
    const session = await requireRoleApi("TRAINER");

    const body = await request.json().catch(() => ({}));
    const parsed = generateMcqRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { documentId, competencyId, count, difficulty, topic } = parsed.data;

    const document = await db.document.findUnique({ where: { id: documentId } });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (document.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Not your document" }, { status: 403 });
    }
    if (document.processingStatus !== "READY") {
      return NextResponse.json(
        { error: `Document is not ready for question generation yet (status: ${document.processingStatus}).` },
        { status: 422 },
      );
    }

    const competency = await db.competency.findUnique({
      where: { id: competencyId },
      include: { domain: true },
    });
    if (!competency) {
      return NextResponse.json({ error: "Competency not found" }, { status: 404 });
    }

    const retrievalQuery = topic ?? `${competency.name} — ${competency.description ?? competency.domain.name}`;
    const chunks = await retrieveFromDocument(documentId, retrievalQuery, RETRIEVAL_K);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No indexed chunks were found for this document yet." },
        { status: 422 },
      );
    }

    let generated;
    try {
      generated = await generateMcqQuestions({
        competencyName: competency.name,
        domainName: competency.domain.name,
        count,
        topic,
        difficultyHint: difficulty,
        chunks,
      });
    } catch (error) {
      const aiError = classifyAiError(error);
      return NextResponse.json({ error: aiError.message, kind: aiError.kind }, { status: 502 });
    }

    const assessment = await db.assessment.create({
      data: {
        ownerId: session.user.id,
        type: "STANDARD",
        competencies: [competencyId],
        // DRAFT until the trainer explicitly publishes it — nothing
        // publishes unreviewed (RestPlan.md Phase 5).
        status: "DRAFT",
        questions: {
          create: generated.questions.map((q) => ({
            competencyId,
            stem: q.stem,
            optionsJson: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty,
            // Always resolved from a real retrieved chunk — never null for
            // RAG-generated questions (PRD §4.7).
            sourceChunkId: chunks[q.sourceChunkIndex].id,
            reviewStatus: "DRAFT",
          })),
        },
      },
      include: { questions: true },
    });

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "QUESTIONS_GENERATED",
        resourceType: "Assessment",
        resourceId: assessment.id,
        metadataJson: {
          documentId,
          competencyId,
          questionCount: assessment.questions.length,
          discardedCount: count - assessment.questions.length,
        },
      },
    });

    return NextResponse.json({
      assessmentId: assessment.id,
      questionCount: assessment.questions.length,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
