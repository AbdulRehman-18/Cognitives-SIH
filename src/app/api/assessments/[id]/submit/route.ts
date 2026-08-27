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
    const hintsUsedRaw = (body as any).hintsUsed as Record<string, number> | undefined;
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
    const missing = answerableQuestions.filter((q) => !answeredIds.has(q.id));
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

      let result = scoreCompetency({
        assessmentAnswers,
        priorTrainings: [],
        assessmentHistory,
      });
      // Hint penalty: score_multiplier = max(0.6, 1 - 0.1*hints_used) per spec
      const hintsForCompetency = answers.reduce((s, a) => s + (hintsUsedRaw?.[a.questionId] ?? 0), 0);
      if (hintsForCompetency > 0 && result.current !== null) {
        const mult = Math.max(0.6, 1 - 0.1 * hintsForCompetency);
        result = { ...result, current: result.current * mult, evidenceJson: result } as typeof result;
        // keep level in sync
        (result as any).level = Math.max(1, Math.min(5, Math.ceil((result.current as number) / 20)));
      }

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
        metadataJson: { assessmentId: assessment.id, competencyCount: results.length, hintsUsed: hintsUsedRaw ?? {} },
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
