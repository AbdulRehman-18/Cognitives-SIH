import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { submitAssessmentSchema } from "@/lib/validation/assessment";
import { scoreCompetency, type AssessmentAnswerInput } from "@/lib/engines/competency";

// Submission scoring: the engine (src/lib/engines/competency.ts) computes
// every number here. This route only gathers structured evidence from the
// database and hands it to the pure function — it never computes a score
// itself and never calls src/lib/ai/ (PRD §2.5).

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

    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    if (assessment.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Not your assessment" }, { status: 403 });
    }

    const questionById = new Map(assessment.questions.map((q) => [q.id, q]));
    const answeredIds = new Set(parsed.data.answers.map((a) => a.questionId));
    const missing = assessment.questions.filter((q) => !answeredIds.has(q.id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing answers for ${missing.length} question(s).` },
        { status: 400 },
      );
    }

    // Group answers by competency — one CompetencyEngine run per competency
    // covered by this assessment.
    const answersByCompetency = new Map<
      string,
      { correct: boolean; difficulty: number; competencyId: string; questionId: string; selectedAnswer: string }[]
    >();

    for (const answer of parsed.data.answers) {
      const question = questionById.get(answer.questionId);
      if (!question) {
        return NextResponse.json(
          { error: `Unknown question id: ${answer.questionId}` },
          { status: 400 },
        );
      }
      const correct = question.correctAnswer === answer.selectedAnswer;
      const list = answersByCompetency.get(question.competencyId) ?? [];
      list.push({
        correct,
        difficulty: Number(question.difficulty),
        competencyId: question.competencyId,
        questionId: question.id,
        selectedAnswer: answer.selectedAnswer,
      });
      answersByCompetency.set(question.competencyId, list);
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

    const competencyMeta = await db.competency.findMany({
      where: { id: { in: [...answersByCompetency.keys()] } },
      include: { domain: true },
    });
    const competencyMetaById = new Map(competencyMeta.map((c) => [c.id, c]));

    const results: Array<{
      competencyId: string;
      competencyName: string;
      domainName: string;
      current: number | null;
      level: number | null;
      confidence: number | null;
      confidenceBand: string | null;
      displayRange: number | null;
    }> = [];

    for (const [competencyId, answers] of answersByCompetency) {
      // Prior evidence for this competency: existing prior-training rows and
      // this officer's assessment history (previous attempts on this
      // competency, most recent first), read fresh from the DB so scoring
      // reflects everything on record — never invented.
      // Prior assessment history: earlier QuizAttempts touching this
      // competency, ordered most-recent-first for ageInAssessments.
      const priorAttempts = await db.quizAttempt.findMany({
        where: {
          userId: session.user.id,
          id: { not: quizAttempt.id },
          answers: { some: { question: { competencyId } } },
          score: { not: null },
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
      });

      const assessmentAnswers: AssessmentAnswerInput[] = answers.map((a) => ({
        correct: a.correct,
        difficulty: a.difficulty,
        competencyId,
      }));

      // NOTE on priorTrainings: PRIOR_TRAINING evidence rows (from an
      // external training-record ingestion flow, not yet built) would feed
      // the engine's `priorTrainings` array with their original
      // {relevance, monthsSince} pair. That ingestion path doesn't exist
      // yet in Phase 2, so this route only ever supplies assessment-derived
      // evidence; passing [] here is correct (not a stub) until that
      // pipeline is built — it must never be reconstructed from already
      //-collapsed CompetencyEvidence rows, which would double-count.
      const assessmentHistory = priorAttempts.map((attempt, index) => ({
        score: Number(attempt.score),
        ageInAssessments: index,
      }));

      const result = scoreCompetency({
        assessmentAnswers,
        priorTrainings: [],
        assessmentHistory,
      });

      const userCompetency = await db.userCompetency.upsert({
        where: { userId_competencyId: { userId: session.user.id, competencyId } },
        update: {
          currentScore: result.current === null ? null : new Prisma.Decimal(result.current.toFixed(2)),
          confidence: result.confidence === null ? null : new Prisma.Decimal(result.confidence.toFixed(3)),
          lastComputedAt: new Date(),
          evidenceJson: JSON.parse(JSON.stringify(result)),
        },
        create: {
          userId: session.user.id,
          competencyId,
          currentScore: result.current === null ? null : new Prisma.Decimal(result.current.toFixed(2)),
          confidence: result.confidence === null ? null : new Prisma.Decimal(result.confidence.toFixed(3)),
          lastComputedAt: new Date(),
          evidenceJson: JSON.parse(JSON.stringify(result)),
        },
      });

      // Every non-zero term writes a CompetencyEvidence row (engine-specifications
      // §1). Clear this competency's prior ASSESSMENT-sourced rows first so
      // re-scoring doesn't accumulate duplicates — PRIOR_TRAINING rows from
      // other flows are left untouched.
      await db.competencyEvidence.deleteMany({
        where: { userCompetencyId: userCompetency.id, sourceType: "ASSESSMENT" },
      });

      if (result.evidence.length > 0) {
        await db.competencyEvidence.createMany({
          data: result.evidence.map((e) => ({
            userCompetencyId: userCompetency.id,
            sourceType: e.sourceType,
            sourceId: e.term === "history" ? (priorAttempts[e.sourceIndex]?.id ?? quizAttempt.id) : quizAttempt.id,
            contribution: new Prisma.Decimal(e.contribution.toFixed(4)),
            weight: new Prisma.Decimal(e.weight.toFixed(3)),
          })),
        });
      }

      const meta = competencyMetaById.get(competencyId);
      results.push({
        competencyId,
        competencyName: meta?.name ?? competencyId,
        domainName: meta?.domain.name ?? "Unknown domain",
        current: result.current,
        level: result.level,
        confidence: result.confidence,
        confidenceBand: result.confidenceBand,
        displayRange: result.displayRange,
      });
    }

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ASSESSMENT_SUBMITTED",
        resourceType: "QuizAttempt",
        resourceId: quizAttempt.id,
        metadataJson: { assessmentId: assessment.id, competencyCount: results.length },
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
