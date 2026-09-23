import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { classifyAiError } from "@/lib/ai/errors";
import { retrieveForUser } from "@/lib/rag/retrieve";
import { generateMcqQuestions } from "@/lib/questions/generate-mcq";
import { TUTOR_REFUSAL_THRESHOLD } from "@/lib/tutor/tutor";

// Learner self-evaluation quiz — src/app/api/tutor/quiz/route.ts
//
// Retrieve first, then generate: questions come ONLY from material the
// learner can see (shared course documents + their own uploads), each citing
// the chunk it was written from. A topic the material doesn't cover is
// refused rather than answered from the model's general knowledge.
//
// Persisted as Assessment{type: SELF_EVAL}. Self-evaluation never feeds the
// Competency Engine — official scores move only through diagnostics,
// trainer-reviewed assessments and verified training records.

export const maxDuration = 45;

const RETRIEVAL_K = 8;

const requestSchema = z.object({
  competencyId: z.string().min(1),
  topic: z.string().trim().min(2).max(200).optional(),
  documentId: z.string().min(1).optional(),
  count: z.number().int().min(3).max(8).optional().default(5),
  language: z.enum(["en", "hi"]).optional().default("en"),
});

export async function POST(request: Request) {
  let session;
  try {
    session = await requireRoleApi("LEARNER");
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { competencyId, topic, documentId, count, language } = parsed.data;

  const competency = await db.competency.findUnique({ where: { id: competencyId }, include: { domain: true } });
  if (!competency) return NextResponse.json({ error: "Competency not found" }, { status: 404 });

  if (documentId) {
    const document = await db.document.findUnique({ where: { id: documentId } });
    const visible = document && (document.scope === "SHARED" || document.ownerId === session.user.id);
    if (!visible) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (document.processingStatus !== "READY") {
      return NextResponse.json({ error: "That document is still being processed." }, { status: 422 });
    }
  }

  const query = topic ?? `${competency.name} — ${competency.description ?? competency.domain.name}`;
  let chunks;
  try {
    chunks = await retrieveForUser(session.user.id, query, RETRIEVAL_K, { documentId });
  } catch (error) {
    const aiError = classifyAiError(error);
    return NextResponse.json({ error: aiError.message, kind: aiError.kind }, { status: 502 });
  }

  // Deterministic refusal, before any model call. A quiz scoped to one
  // chosen document with no specific topic is a "quiz me on this document"
  // request, so relevance to the competency label isn't required there.
  const requireRelevance = Boolean(topic) || !documentId;
  const grounded = requireRelevance ? chunks.filter((c) => c.similarity >= TUTOR_REFUSAL_THRESHOLD) : chunks;
  if (grounded.length === 0) {
    return NextResponse.json({
      refused: true,
      reason: topic
        ? `“${topic}” isn't covered by the material available to you. Upload your notes on it, or pick another topic.`
        : `No available material covers ${competency.name} yet. Upload your own notes, or ask your trainer to add a document.`,
    });
  }

  let generated;
  try {
    generated = await generateMcqQuestions({
      competencyName: competency.name,
      domainName: competency.domain.name,
      count,
      topic,
      chunks: grounded,
      language,
    });
  } catch (error) {
    const aiError = classifyAiError(error);
    return NextResponse.json({ error: aiError.message, kind: aiError.kind }, { status: 502 });
  }

  const assessment = await db.assessment.create({
    data: {
      ownerId: session.user.id,
      type: "SELF_EVAL",
      competencies: [competencyId],
      status: "PUBLISHED",
      questions: {
        create: generated.questions.map((q) => ({
          competencyId,
          stem: q.stem,
          optionsJson: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          sourceChunkId: grounded[q.sourceChunkIndex].id,
        })),
      },
    },
    include: { questions: { orderBy: { createdAt: "asc" } } },
  });

  const documents = await db.document.findMany({
    where: { id: { in: [...new Set(grounded.map((c) => c.documentId))] } },
    select: { id: true, fileName: true, scope: true },
  });
  const documentTitle = new Map(
    documents.map((d) => [d.id, `${d.fileName ?? "Course document"}${d.scope === "PERSONAL" ? " (your upload)" : ""}`]),
  );
  const chunkById = new Map(grounded.map((c) => [c.id, c]));

  return NextResponse.json({
    refused: false,
    assessmentId: assessment.id,
    competencyName: competency.name,
    questions: assessment.questions.map((q) => {
      const chunk = q.sourceChunkId ? chunkById.get(q.sourceChunkId) : undefined;
      return {
        id: q.id,
        stem: q.stem,
        options: q.optionsJson as string[],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        citation: chunk
          ? { chunkIndex: chunk.chunkIndex, content: chunk.content, similarity: chunk.similarity, documentTitle: documentTitle.get(chunk.documentId) }
          : null,
      };
    }),
  });
}
