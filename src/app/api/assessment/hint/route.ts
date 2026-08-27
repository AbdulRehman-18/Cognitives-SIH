import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { computeHintTier, plannerReasoning, streamGuideHint, generateGuideHint, verifierLLMCheck, fallbackHint } from "@/lib/assessment/hint";
import { auth } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const { questionId, attemptId, stream } = await req.json();
  if (!questionId) return new Response(JSON.stringify({ error: "questionId required" }), { status: 400 });

  const question = await db.question.findUnique({ where: { id: questionId } });
  if (!question) return new Response(JSON.stringify({ error: "Question not found" }), { status: 404 });

   const hintsAlreadyGiven = await db.hintRequest.count({ where: { userId: session.user.id, questionId } });
   const tier = computeHintTier(hintsAlreadyGiven);
   const reasoning = plannerReasoning(hintsAlreadyGiven);

   const priorHints = await db.hintRequest.findMany({ where: { userId: session.user.id, questionId }, orderBy: { timestamp: "asc" }, take: 4 });
  const conversation = priorHints.map((h: any)=>`Tier ${h.tier}: ${h.guideResponseText}`).join("\n");

  // Streaming path: stream Guide tokens directly (matches Tutor streaming feel)
  if (stream) {
    let fullText = "";
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const tok of streamGuideHint(question.stem, question.optionsJson, tier, conversation)) {
            fullText += tok;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: tok, tier })}\n\n`));
          }
          // Verify after streaming; if unsafe, send fallback marker
          const v = await verifierLLMCheck(fullText, question.stem, question.correctAnswer);
          let finalText = fullText;
          let verifierPassed = true;
          if (!v.safe) {
            finalText = fallbackHint(tier);
            verifierPassed = false;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ fallback: finalText })}\n\n`));
          }
           await db.hintRequest.create({ data: { userId: session.user.id, questionId, quizAttemptId: attemptId ?? null, tier, guideResponseText: finalText, verifierPassed, reasoning } });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, tier, verifierPassed })}\n\n`));
          controller.close();
        } catch (e) { controller.error(e); }
      }
    });
    return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }

  // Non-streaming fallback (Guide + Verifier ~2 calls)
  const { hintText, verifierPassed } = await (async () => {
    let hint = await generateGuideHint(question.stem, question.optionsJson, tier, conversation);
    let v = await verifierLLMCheck(hint, question.stem, question.correctAnswer);
    if (!v.safe) {
      hint = await generateGuideHint(question.stem, question.optionsJson, tier, conversation + `\n[RETRY: previous hint leaked answer: ${v.reason}. Do not reveal the answer.]`);
      v = await verifierLLMCheck(hint, question.stem, question.correctAnswer);
      if (!v.safe) return { hintText: fallbackHint(tier), verifierPassed: false };
    }
    return { hintText: hint, verifierPassed: v.safe };
  })();

   const record = await db.hintRequest.create({ data: { userId: session.user.id, questionId, quizAttemptId: attemptId ?? null, tier, guideResponseText: hintText, verifierPassed, reasoning } });
  return new Response(JSON.stringify({ tier: record.tier, hintText: record.guideResponseText, reasoning }), { headers: { "Content-Type": "application/json" } });
}
