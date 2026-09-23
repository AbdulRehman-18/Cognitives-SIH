import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { submitAssessmentSchema } from "@/lib/validation/assessment";
import { recomputeUserCompetencies } from "@/lib/competency/recompute";

// Submission scoring: the engine (src/lib/engines/competency.ts) computes
// every number here, via the shared recompute service
// (src/lib/competency/recompute.ts). This route records the attempt and its
// answers, then asks the service to rescore each competency covered — it
// never computes a score itself and never calls src/lib/ai/ (PRD §2.5).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi("LEARNER");
    const { id: assessmentId } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = submitAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const hintsUsed = parsed.data.hintsUsed ?? {};

    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });

    // Self-evaluation quizzes have their own route and never move official scores.
    if (!assessment || assessment.type === "SELF_EVAL") {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // DIAGNOSTIC assessments are generated per-learner and never shared —
    // only their owner may submit. STANDARD (trainer-authored) assessments
    // are shared once PUBLISHED: any learner may attempt one, tracked via
    // this QuizAttempt row rather than Assessment.ownerId.
    const isOwner = assessment.ownerId === session.user.id;
    const isSharedAndPublished = assessment.type === "STANDARD" && assessment.status === "PUBLISHED";
    if (!isOwner && !isSharedAndPublished) {
      return NextResponse.json({ error: "Not your assessment" }, { status: 403 });
    }

    // Only APPROVED questions are ever answerable on a STANDARD assessment
    // — mirrors the runner page's filter, so a stale client can't submit
    // answers for a question that was rejected after the page loaded.
    const answerableQuestions =
      assessment.type === "STANDARD"
        ? assessment.questions.filter((q) => q.reviewStatus === "APPROVED")
        : assessment.questions;
    const questionById = new Map(answerableQuestions.map((q) => [q.id, q]));
    const answeredIds = new Set(parsed.data.answers.map((a) => a.questionId));
    // An adaptive diagnostic shows only the items the staircase selected, so
    // unanswered pool items are expected there; every competency must still
    // have at least one answer.
    const adaptive = parsed.data.adaptive === true && assessment.type === "DIAGNOSTIC";
    const missing = adaptive
      ? [...new Set(answerableQuestions.map((q) => q.competencyId))]
          .filter((c) => !answerableQuestions.some((q) => q.competencyId === c && answeredIds.has(q.id)))
          .map((c) => ({ competencyId: c }))
      : answerableQuestions.filter((q) => !answeredIds.has(q.id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing answers for ${missing.length} ${adaptive ? "competenc(ies)" : "question(s)"}.` },
        { status: 400 },
      );
    }

    for (const answer of parsed.data.answers) {
      if (!questionById.has(answer.questionId)) {
        return NextResponse.json(
          { error: `Unknown question id: ${answer.questionId}` },
          { status: 400 },
        );
      }
    }

    const quizAttempt = await db.quizAttempt.create({
      data: {
        userId: session.user.id,
        assessmentId: assessment.id,
        submittedAt: new Date(),
        answers: {
          create: parsed.data.answers.map((a) => {
            const q = questionById.get(a.questionId)!;
            return {
              questionId: a.questionId,
              selectedAnswer: a.selectedAnswer,
              isCorrect: q.correctAnswer === a.selectedAnswer,
              hintsUsed: hintsUsed[a.questionId] ?? 0,
            };
          }),
        },
      },
    });

    const overallCorrect = parsed.data.answers.filter(
      (a) => questionById.get(a.questionId)?.correctAnswer === a.selectedAnswer,
    ).length;
    const overallScore = (overallCorrect / parsed.data.answers.length) * 100;

    await db.quizAttempt.update({
      where: { id: quizAttempt.id },
      data: { score: new Prisma.Decimal(overallScore.toFixed(2)) },
    });

    const competencyIds = new Set(parsed.data.answers.map((a) => questionById.get(a.questionId)!.competencyId));
    const [recomputed, competencyMeta] = await Promise.all([
      recomputeUserCompetencies(session.user.id, competencyIds),
      db.competency.findMany({ where: { id: { in: [...competencyIds] } }, include: { domain: true } }),
    ]);
    const competencyMetaById = new Map(competencyMeta.map((c) => [c.id, c]));

    const results = recomputed.map(({ competencyId, result }) => {
      const meta = competencyMetaById.get(competencyId);
      return {
        competencyId,
        competencyName: meta?.name ?? competencyId,
        domainName: meta?.domain.name ?? "Unknown domain",
        current: result.current,
        level: result.level,
        confidence: result.confidence,
        confidenceBand: result.confidenceBand,
        displayRange: result.displayRange,
      };
    });

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ASSESSMENT_SUBMITTED",
        resourceType: "QuizAttempt",
        resourceId: quizAttempt.id,
        metadataJson: { assessmentId: assessment.id, competencyCount: results.length, hintsUsed },
      },
    });

    return NextResponse.json({
      quizAttemptId: quizAttempt.id,
      overallScore,
      competencies: results,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
