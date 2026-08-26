import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";

// Publishing gate: nothing publishes unreviewed (RestPlan.md Phase 5).
// A trainer-authored (STANDARD) assessment can only move DRAFT -> PUBLISHED
// once it has at least one APPROVED question — an assessment with zero
// approved questions has nothing safe to show a learner.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi("TRAINER");
    const { id } = await params;

    const assessment = await db.assessment.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    if (assessment.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Not your assessment" }, { status: 403 });
    }
    if (assessment.type !== "STANDARD") {
      return NextResponse.json(
        { error: "Only trainer-authored assessments can be published this way." },
        { status: 422 },
      );
    }

    const approvedCount = assessment.questions.filter((q) => q.reviewStatus === "APPROVED").length;
    if (approvedCount === 0) {
      return NextResponse.json(
        { error: "Approve at least one question before publishing." },
        { status: 422 },
      );
    }

    const updated = await db.assessment.update({
      where: { id },
      data: { status: "PUBLISHED" },
    });

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ASSESSMENT_PUBLISHED",
        resourceType: "Assessment",
        resourceId: id,
        metadataJson: { approvedCount, totalQuestions: assessment.questions.length },
      },
    });

    return NextResponse.json({ status: updated.status, approvedCount });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
