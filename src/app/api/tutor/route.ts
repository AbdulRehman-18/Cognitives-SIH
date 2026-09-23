import { z } from "zod";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { retrieveForUser } from "@/lib/rag/retrieve";
import { classifyAiError } from "@/lib/ai/errors";
import { getAiProvider } from "@/lib/ai/provider";
import {
  buildTutorSystemPrompt,
  describeLearnerLevel,
  isGenericOffTopic,
  tutorBasis,
  tutorRefusalMessage,
  OUT_OF_SCOPE_SENTINEL,
  TUTOR_RETRIEVAL_K,
  TUTOR_REFUSAL_THRESHOLD,
  type TutorCitation,
  type TutorLanguage,
} from "@/lib/tutor/tutor";

// AI Tutor streaming route — src/app/api/tutor/route.ts
//
// Retrieval BEFORE generation, always (reusing Phase 4's shared retrieval
// path). The top similarity decides the answer's basis — material, blended
// or general — before any model call, and the client labels it. Off-topic
// questions get a deterministic refusal: obvious chit-chat without a model
// call, anything else when the model answers with OUT_OF_SCOPE_SENTINEL.
//
// Wire protocol: the response body starts with a single-line JSON header
// (`{"refused":bool,"basis":…,"citations":[…]}`) followed by a blank line,
// then raw text deltas. The client parses the header once, then appends deltas.

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
  language: z.enum(["en", "hi"]).optional().default("en"),
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
    // Shared course material + this learner's own uploads only.
    chunks = await retrieveForUser(session.user.id, question, TUTOR_RETRIEVAL_K);
  } catch (error) {
    const aiError = classifyAiError(error);
    return NextResponse.json({ error: aiError.message, kind: aiError.kind }, { status: 502 });
  }

  if (isGenericOffTopic(question)) {
    return refusalResponse(parsed.data.language);
  }

  const topSimilarity = chunks.length ? Math.max(...chunks.map((c) => c.similarity)) : null;
  const basis = tutorBasis(topSimilarity);
  const groundedChunks = basis === "general" ? [] : chunks.filter((chunk) => chunk.similarity >= TUTOR_REFUSAL_THRESHOLD);

  // Attach document titles so citations render honestly in SourceChunkCard.
  const documentIds = [...new Set(groundedChunks.map((c) => c.documentId))];
  const documents = documentIds.length
    ? await db.document.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, fileName: true, scope: true },
      })
    : [];
  const documentTitle = new Map(
    documents.map((d) => [d.id, `${d.fileName ?? "Course document"}${d.scope === "PERSONAL" ? " (your upload)" : ""}`]),
  );

  const citations: TutorCitation[] = groundedChunks.map((chunk, index) => ({
    ...chunk,
    marker: index + 1,
    documentTitle: documentTitle.get(chunk.documentId),
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

  const system = buildTutorSystemPrompt(citations, describeLearnerLevel(learnerLevels), parsed.data.mode, parsed.data.language, basis);

  const provider = getAiProvider();
  const iterator = provider.streamText({
    messages: parsed.data.messages,
    system,
  })[Symbol.asyncIterator]();

  // Read ahead before committing to a streaming response: a missing key /
  // rate limit / timeout surfaces as a clean typed 502, an empty completion
  // is an error rather than a blank answer, and the out-of-scope sentinel is
  // caught before any of it reaches the learner.
  let opening = "";
  let finished = false;
  try {
    while (opening.trimStart().length < OUT_OF_SCOPE_SENTINEL.length) {
      const next = await iterator.next();
      if (next.done) { finished = true; break; }
      opening += next.value ?? "";
    }
  } catch (error) {
    const aiError = classifyAiError(error);
    return NextResponse.json({ error: aiError.message, kind: aiError.kind }, { status: 502 });
  }
  if (opening.trimStart().startsWith(OUT_OF_SCOPE_SENTINEL)) {
    return refusalResponse(parsed.data.language);
  }
  if (finished && !opening.trim()) {
    return NextResponse.json({ error: "The AI provider returned an empty answer.", kind: "INVALID_RESPONSE" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const header = JSON.stringify({
    refused: false,
    basis,
    citations: citations.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      similarity: c.similarity,
      documentTitle: c.documentTitle,
    })),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      send(`${header}\n\n`);
      try {
        send(opening);
        while (!finished) {
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

function refusalResponse(language: TutorLanguage): Response {
  const encoder = new TextEncoder();
  const header = JSON.stringify({ refused: true, citations: [] });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${header}\n\n${tutorRefusalMessage(language)}`));
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
