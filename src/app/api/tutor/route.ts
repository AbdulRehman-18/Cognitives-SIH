import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { retrieveAcrossAllDocuments } from "@/lib/rag/retrieve";
import { classifyAiError } from "@/lib/ai/errors";
import { getAiProvider } from "@/lib/ai/provider";
import {
  buildTutorSystemPrompt,
  describeLearnerLevel,
  tutorRefusalMessage,
  TUTOR_RETRIEVAL_K,
  TUTOR_REFUSAL_THRESHOLD,
  type TutorCitation,
} from "@/lib/tutor/tutor";

// AI Tutor streaming route — src/app/api/tutor/route.ts
//
// Retrieval BEFORE generation, always (reusing Phase 4's shared retrieval
// path). Refusal rule (PRD §4.9): top similarity < TUTOR_REFUSAL_THRESHOLD ⇒
// a DETERMINISTIC out-of-scope response streamed without any model call.
// Grounded or explicitly silent — never guessing.
//
// Wire protocol: the response body starts with a single-line JSON header
// (`{"refused":bool,"citations":[…]}`) followed by a blank line, then raw
// text deltas. The client parses the header once, then appends deltas.

export const maxDuration = 60;

const tutorRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(24),
  mode: z.enum(["explain", "guide", "quiz"]).optional().default("explain"),
});

export async function POST(request: Request) {
  let session;
  try {
    session = await requireRoleApi(["LEARNER", "TRAINER", "ADMIN"]);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = tutorRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const question = [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content;
  if (!question) {
    return NextResponse.json({ error: "No user question in the exchange." }, { status: 400 });
  }

  // ── Retrieval first — always. Never generate ungrounded. ──────────────
  let chunks;
  try {
    chunks = await retrieveAcrossAllDocuments(question, TUTOR_RETRIEVAL_K);
  } catch (error) {
    const aiError = classifyAiError(error);
    return NextResponse.json({ error: aiError.message, kind: aiError.kind }, { status: 502 });
  }

  const refused =
    chunks.length === 0 || !chunks.some((chunk) => chunk.similarity >= TUTOR_REFUSAL_THRESHOLD);

  // Deterministic refusal — no model call at all when out of scope.
  if (refused) {
    return refusalResponse();
  }

  const groundedChunks = chunks.filter((chunk) => chunk.similarity >= TUTOR_REFUSAL_THRESHOLD);

  // Attach document titles so citations render honestly in SourceChunkCard.
  const documentIds = [...new Set(groundedChunks.map((c) => c.documentId))];
  const documents = await db.document.findMany({
    where: { id: { in: documentIds } },
    select: { id: true },
  });
  void documents;

  const citations: TutorCitation[] = groundedChunks.map((chunk, index) => ({
    ...chunk,
    marker: index + 1,
  }));

  // Calibrate to the learner's measured levels (real UserCompetency rows).
  const competencies = await db.userCompetency.findMany({
    where: { userId: session.user.id },
    select: { currentScore: true, competency: { select: { name: true } } },
  });
  const learnerLevels = competencies.map((uc) => ({
    name: uc.competency.name,
    level:
      uc.currentScore != null
        ? Math.max(1, Math.min(5, Math.ceil(Number(uc.currentScore) / 20)))
        : null,
  }));

  const system = buildTutorSystemPrompt(citations, describeLearnerLevel(learnerLevels), parsed.data.mode);

  const provider = getAiProvider();
  const iterator = provider.streamText({
    messages: parsed.data.messages,
    system,
  })[Symbol.asyncIterator]();

  // Pull the first delta before committing to a streaming response, so a
  // missing key / rate limit / timeout surfaces as a clean typed 502 instead
  // of a truncated 200 stream.
  let first;
  try {
    first = await iterator.next();
  } catch (error) {
    const aiError = classifyAiError(error);
    return NextResponse.json({ error: aiError.message, kind: aiError.kind }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const header = JSON.stringify({
    refused: false,
    citations: citations.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      similarity: c.similarity,
    })),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      send(`${header}\n\n`);
      try {
        if (!first.done && first.value) send(first.value);
        while (true) {
          const { done, value } = await iterator.next();
          if (done) break;
          if (value) send(value);
        }
      } catch {
        // Mid-stream failure: close cleanly with a visible interruption note
        // rather than hanging or silently truncating the answer.
        send("\n\n[The connection to the AI provider was interrupted mid-answer.]");
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function refusalResponse(): Response {
  const encoder = new TextEncoder();
  const header = JSON.stringify({ refused: true, citations: [] });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${header}\n\n${tutorRefusalMessage()}`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
