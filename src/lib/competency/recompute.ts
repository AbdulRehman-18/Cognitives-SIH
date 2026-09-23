import "server-only";

import { Prisma, type EvidenceSourceType } from "@prisma/client";
import { db } from "@/lib/db/client";
import {
  applyHintPenalty,
  computeRelevance,
  monthsBetween,
  scoreCompetency,
  type CompetencyScoreResult,
  type PrerequisiteEdge,
  type PriorTrainingInput,
} from "@/lib/engines/competency";

// Competency recompute — src/lib/competency/recompute.ts
//
// The single place a UserCompetency score is (re)written. Every call gathers
// the officer's SOURCE records fresh — latest official assessment attempt,
// earlier attempts, self-declared/imported prior trainings, and completed
// iGOT courses — and hands them to the pure Competency Engine. It never
// rebuilds inputs from already-collapsed CompetencyEvidence rows (that would
// double-count), which is also why it can safely replace ALL evidence rows
// for the competency on each run.
//
// SELF_EVAL attempts (learner self-practice) are excluded by design: only
// official assessments and verified training records move a score.

const HISTORY_DEPTH = 5;

/** Where each priorTrainings[] entry came from, so evidence rows point back to it. */
interface TrainingOrigin {
  sourceType: Extract<EvidenceSourceType, "PRIOR_TRAINING" | "COURSE_COMPLETION">;
  sourceId: string;
}

export interface RecomputeResult {
  competencyId: string;
  result: CompetencyScoreResult;
}

async function loadPrerequisiteEdges(): Promise<PrerequisiteEdge[]> {
  return db.competencyPrerequisite.findMany({ select: { competencyId: true, prerequisiteId: true } });
}

export async function recomputeUserCompetency(
  userId: string,
  competencyId: string,
  opts: { now?: Date; edges?: PrerequisiteEdge[] } = {},
): Promise<RecomputeResult> {
  const now = opts.now ?? new Date();
  const edges = opts.edges ?? (await loadPrerequisiteEdges());

  const [attempts, priorTrainings, completions] = await Promise.all([
    // Official attempts touching this competency, most recent first.
    db.quizAttempt.findMany({
      where: {
        userId,
        submittedAt: { not: null },
        score: { not: null },
        assessment: { type: { not: "SELF_EVAL" } },
        answers: { some: { question: { competencyId } } },
      },
      orderBy: { submittedAt: "desc" },
      take: HISTORY_DEPTH + 1,
      include: {
        answers: {
          where: { question: { competencyId } },
          include: { question: { select: { difficulty: true } } },
        },
      },
    }),
    db.priorTraining.findMany({ where: { userId } }),
    db.learningProgress.findMany({
      where: { userId, status: "COMPLETED", completedAt: { not: null }, courseId: { not: null } },
      include: { course: { select: { competencies: true } } },
    }),
  ]);

  const [latest, ...earlier] = attempts;

  const trainingInputs: PriorTrainingInput[] = [];
  const origins: TrainingOrigin[] = [];
  for (const pt of priorTrainings) {
    const relevance = computeRelevance(competencyId, pt.competencyIds, edges);
    if (relevance === 0) continue;
    trainingInputs.push({ relevance, monthsSince: monthsBetween(pt.completedAt, now) });
    origins.push({ sourceType: "PRIOR_TRAINING", sourceId: pt.id });
  }
  for (const lp of completions) {
    const relevance = computeRelevance(competencyId, lp.course?.competencies ?? [], edges);
    if (relevance === 0) continue;
    trainingInputs.push({ relevance, monthsSince: monthsBetween(lp.completedAt!, now) });
    origins.push({ sourceType: "COURSE_COMPLETION", sourceId: lp.id });
  }

  const scored = scoreCompetency({
    assessmentAnswers: (latest?.answers ?? []).map((a) => ({
      correct: a.isCorrect,
      difficulty: Number(a.question.difficulty),
      competencyId,
    })),
    priorTrainings: trainingInputs,
    assessmentHistory: earlier.slice(0, HISTORY_DEPTH).map((attempt, index) => ({
      score: Number(attempt.score),
      ageInAssessments: index,
    })),
  });
  const hintsUsed = (latest?.answers ?? []).reduce((sum, a) => sum + a.hintsUsed, 0);
  const result = applyHintPenalty(scored, hintsUsed);

  const existing = await db.userCompetency.findUnique({
    where: { userId_competencyId: { userId, competencyId } },
    select: { id: true },
  });
  // No evidence and nothing on record: leave "Not yet assessed" as absence.
  if (result.current === null && !existing) return { competencyId, result };

  const toDecimal = (value: number | null, digits: number) =>
    value === null ? null : new Prisma.Decimal(value.toFixed(digits));
  const data = {
    currentScore: toDecimal(result.current, 2),
    confidence: toDecimal(result.confidence, 3),
    lastComputedAt: now,
    evidenceJson: JSON.parse(JSON.stringify({ ...result, hintsUsed })),
  };
  const userCompetency = await db.userCompetency.upsert({
    where: { userId_competencyId: { userId, competencyId } },
    update: data,
    create: { userId, competencyId, ...data },
  });

  await db.competencyEvidence.deleteMany({ where: { userCompetencyId: userCompetency.id } });
  if (result.evidence.length > 0) {
    await db.competencyEvidence.createMany({
      data: result.evidence.map((e) => {
        const origin =
          e.term === "priorTraining"
            ? origins[e.sourceIndex]
            : { sourceType: "ASSESSMENT" as const, sourceId: (e.term === "history" ? earlier[e.sourceIndex] : latest)!.id };
        return {
          userCompetencyId: userCompetency.id,
          sourceType: origin.sourceType,
          sourceId: origin.sourceId,
          contribution: new Prisma.Decimal(e.contribution.toFixed(4)),
          weight: new Prisma.Decimal(e.weight.toFixed(3)),
        };
      }),
    });
  }

  return { competencyId, result };
}

/** Recomputes several competencies for one user, sharing one read of the prerequisite DAG. */
export async function recomputeUserCompetencies(
  userId: string,
  competencyIds: Iterable<string>,
  opts: { now?: Date } = {},
): Promise<RecomputeResult[]> {
  const edges = await loadPrerequisiteEdges();
  const results: RecomputeResult[] = [];
  for (const competencyId of new Set(competencyIds)) {
    results.push(await recomputeUserCompetency(userId, competencyId, { ...opts, edges }));
  }
  return results;
}

/**
 * Competencies a set of training records can move: each tagged competency
 * plus its one-hop DAG neighbours (relevance 0.5). Used after a new
 * completion or prior-training declaration to know what to recompute.
 */
export async function competenciesAffectedBy(taggedCompetencyIds: string[]): Promise<string[]> {
  if (taggedCompetencyIds.length === 0) return [];
  const edges = await db.competencyPrerequisite.findMany({
    where: {
      OR: [{ competencyId: { in: taggedCompetencyIds } }, { prerequisiteId: { in: taggedCompetencyIds } }],
    },
    select: { competencyId: true, prerequisiteId: true },
  });
  const affected = new Set(taggedCompetencyIds);
  for (const e of edges) {
    affected.add(e.competencyId);
    affected.add(e.prerequisiteId);
  }
  return [...affected];
}
