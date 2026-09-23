import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { selectNextItem } from "@/lib/engines/adaptive";

// Adaptive diagnostic: grades the answers so far on the server (correct
// answers never reach the client) and asks the pure Adaptive Item Selection
// Engine which question to show next.

const bodySchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), selectedAnswer: z.string().min(1) })).max(60).default([]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRoleApi("LEARNER");
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const assessment = await db.assessment.findUnique({
      where: { id },
      select: { ownerId: true, type: true, questions: { select: { id: true, competencyId: true, difficulty: true, correctAnswer: true } } },
    });
    if (!assessment || assessment.type !== "DIAGNOSTIC" || assessment.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const byId = new Map(assessment.questions.map((q) => [q.id, q]));
    const responses = parsed.data.answers
      .filter((a) => byId.has(a.questionId))
      .map((a) => ({ questionId: a.questionId, correct: byId.get(a.questionId)!.correctAnswer === a.selectedAnswer }));
    const pool = assessment.questions.map((q) => ({ id: q.id, competencyId: q.competencyId, difficulty: Number(q.difficulty) }));

    return NextResponse.json(selectNextItem(pool, responses));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
