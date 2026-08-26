import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { updateQuestionSchema } from "@/lib/validation/questions";

// Trainer review queue mutation: edit stem/options/answer/explanation
// and/or move reviewStatus DRAFT -> APPROVED/REJECTED. Nothing publishes
// unreviewed (RestPlan.md Phase 5) — reviewStatus starts DRAFT at
// generation time, and only an explicit APPROVED transition here makes a
// question eligible to appear once its assessment is published.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi("TRAINER");
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = updateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const question = await db.question.findUnique({
      where: { id },
      include: { assessment: true },
    });
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (question.assessment.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Not your question" }, { status: 403 });
    }

    const nextOptions = parsed.data.options ?? (question.optionsJson as string[]);
    const nextCorrectAnswer = parsed.data.correctAnswer ?? question.correctAnswer;
    if (!nextOptions.includes(nextCorrectAnswer)) {
      return NextResponse.json(
        { error: "correctAnswer must be one of the question's options." },
        { status: 400 },
      );
    }

    const updated = await db.question.update({
      where: { id },
      data: {
        ...(parsed.data.stem !== undefined ? { stem: parsed.data.stem } : {}),
        ...(parsed.data.options !== undefined ? { optionsJson: parsed.data.options } : {}),
        ...(parsed.data.correctAnswer !== undefined ? { correctAnswer: parsed.data.correctAnswer } : {}),
        ...(parsed.data.explanation !== undefined ? { explanation: parsed.data.explanation } : {}),
        ...(parsed.data.reviewStatus !== undefined
          ? { reviewStatus: parsed.data.reviewStatus, reviewerId: session.user.id }
          : {}),
      },
    });

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: parsed.data.reviewStatus ? `QUESTION_${parsed.data.reviewStatus}` : "QUESTION_EDITED",
        resourceType: "Question",
        resourceId: id,
        metadataJson: { assessmentId: question.assessmentId },
      },
    });

    return NextResponse.json({ question: updated });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
