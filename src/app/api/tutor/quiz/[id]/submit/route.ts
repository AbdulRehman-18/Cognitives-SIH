import { z } from "zod";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";

// Records a finished self-evaluation attempt for the learner's own history.
// Deliberately does NOT call the recompute service: SELF_EVAL attempts never
// change official competency scores.

const bodySchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), selectedAnswer: z.string().min(1) })).min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRoleApi("LEARNER");
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });

    const assessment = await db.assessment.findUnique({ where: { id }, include: { questions: true } });
    if (!assessment || assessment.type !== "SELF_EVAL" || assessment.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    const questionById = new Map(assessment.questions.map((q) => [q.id, q]));
    const answers = parsed.data.answers.filter((a) => questionById.has(a.questionId));
    if (answers.length === 0) return NextResponse.json({ error: "No valid answers" }, { status: 400 });

    const correct = answers.filter((a) => questionById.get(a.questionId)!.correctAnswer === a.selectedAnswer).length;
    const score = (correct / assessment.questions.length) * 100;
    const attempt = await db.quizAttempt.create({
      data: {
        userId: session.user.id,
        assessmentId: id,
        submittedAt: new Date(),
        score: new Prisma.Decimal(score.toFixed(2)),
        answers: {
          create: answers.map((a) => ({
            questionId: a.questionId,
            selectedAnswer: a.selectedAnswer,
            isCorrect: questionById.get(a.questionId)!.correctAnswer === a.selectedAnswer,
          })),
        },
      },
    });
    return NextResponse.json({ attemptId: attempt.id, correct, total: assessment.questions.length, score });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
