import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { generateDiagnosticQuestions } from "@/lib/assessment/generate-diagnostic";
import { generateDiagnosticRequestSchema } from "@/lib/validation/assessment";
import { classifyAiError } from "@/lib/ai/errors";

// Diagnostic generation: given the caller's role, look up its required
// competencies, ask the LLM to write questions (never scores), validate,
// and persist Assessment + Question rows. Target ≤30s (PRD §4.11) — the
// route itself does a small number of DB reads/writes; the LLM call
// dominates the budget, so maxDuration gives it headroom.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await requireRoleApi("LEARNER");

    const body = await request.json().catch(() => ({}));
    const parsedRequest = generateDiagnosticRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsedRequest.error.issues },
        { status: 400 },
      );
    }
    const { competencyIds, questionsPerCompetency } = parsedRequest.data;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: { jobRole: true },
    });

    if (!user?.roleId || !user.jobRole) {
      return NextResponse.json(
        {
          error:
            "No job role is set on your profile yet. Complete onboarding before starting a diagnostic.",
        },
        { status: 422 },
      );
    }

    const roleCompetencies = await db.roleCompetency.findMany({
      where: {
        roleId: user.roleId,
        ...(competencyIds ? { competencyId: { in: competencyIds } } : {}),
      },
      include: { competency: { include: { domain: true } } },
      orderBy: { weight: "desc" },
    });

    if (roleCompetencies.length === 0) {
      return NextResponse.json(
        { error: "No competencies are configured for your role yet." },
        { status: 422 },
      );
    }

    // Cap the diagnostic to a reasonable breadth so generation reliably
    // finishes within the 30s budget — mirrors the ~10-question diagnostic
    // referenced in PRODUCT.md.
    const MAX_COMPETENCIES = 6;
    const selected = roleCompetencies.slice(0, MAX_COMPETENCIES);

    let generated;
    try {
      generated = await generateDiagnosticQuestions({
        roleName: user.jobRole.name,
        questionsPerCompetency,
        competencies: selected.map((rc) => ({
          id: rc.competencyId,
          name: rc.competency.name,
          domainName: rc.competency.domain.name,
          description: rc.competency.description,
          requiredLevel: rc.requiredLevel,
        })),
      });
    } catch (error) {
      const aiError = classifyAiError(error);
      return NextResponse.json(
        { error: aiError.message, kind: aiError.kind },
        { status: 502 },
      );
    }

    const assessment = await db.assessment.create({
      data: {
        ownerId: user.id,
        type: "DIAGNOSTIC",
        competencies: selected.map((rc) => rc.competencyId),
        status: "PUBLISHED",
        questions: {
          create: generated.questions.map((q) => ({
            competencyId: q.competencyId,
            stem: q.stem,
            optionsJson: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: q.difficulty,
            // Diagnostic questions aren't grounded in an uploaded document,
            // so sourceChunkId stays null here — RAG-grounded generation
            // (trainer MCQ flow, Phase 5) always sets it.
            reviewStatus: "APPROVED",
          })),
        },
      },
      include: { questions: true },
    });

    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "ASSESSMENT_GENERATED",
        resourceType: "Assessment",
        resourceId: assessment.id,
        metadataJson: {
          competencyCount: selected.length,
          questionCount: assessment.questions.length,
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
