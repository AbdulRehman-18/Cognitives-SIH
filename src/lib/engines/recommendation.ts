// Recommendation Engine — src/lib/engines/recommendation.ts
//
// Normative reference: docs/engine-specifications.md §3. This file is pure:
// structured input in, ranked recommendations out. No `import` from
// src/lib/ai/ (enforced by eslint.config.mjs + tests/architecture), no DB
// access, no Date.now() in the math.
//
// The one input this engine consumes that the other engines don't —
// `semanticSimilarity` — is computed OUTSIDE by the RAG layer
// (src/lib/rag/retrieve.ts embeds the gap text and does pgvector cosine
// against Course embeddings) and passed IN as an argument. The engine itself
// must never query the database or call a model: PRD §2.5, the LLM never
// decides a number, and neither does a vector query — it only supplies one
// of six deterministic terms.

import type { GapSeverity } from "@/lib/engines/gap";

export interface PrerequisiteEdge {
  /** The competency that requires `prerequisiteId` first. */
  competencyId: string;
  prerequisiteId: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Weights + factor tables (exported so a judge can be shown the literal rule)
// ─────────────────────────────────────────────────────────────────────────

export const RECOMMENDATION_WEIGHTS = {
  semanticSimilarity: 0.35,
  gapSeverityWeight: 0.25,
  roleRelevance: 0.15,
  prerequisiteReadiness: 0.1,
  difficultyFit: 0.1,
  departmentPriority: 0.05,
} as const;

/** CRITICAL 1.0 / HIGH 0.75 / MEDIUM 0.5 / LOW 0.25 (engine-specifications §3). */
export const GAP_SEVERITY_WEIGHT: Record<GapSeverity, number> = {
  CRITICAL: 1.0,
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
};

/**
 * Below this score a match is considered weak. If NO candidate clears it,
 * the top-ranked candidate is still returned — flagged `isClosestMatch` —
 * because PRD §4.4 requires no gap to be left without at least one
 * recommendation, but an honest caveat beats a confident bad match.
 */
export const RECOMMENDATION_MIN_SCORE = 0.4;

/** prerequisiteReadiness values (§3): all met / some met / none met. */
export const PREREQ_READINESS = { ALL_MET: 1.0, PARTIAL: 0.5, UNMET: 0.2 } as const;

// ─────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────

export interface RecommendationCandidate {
  courseId: string;
  /** Competency ids this course targets (Course.competencies). */
  competencyIds: string[];
  /** 1..5 course difficulty level (Course.level). */
  level: number;
  /**
   * pgvector cosine similarity between the gap text embedding and this
   * course's embedding — 0..1. Computed by src/lib/rag/retrieve.ts, never
   * inside this engine.
   */
  semanticSimilarity: number;
}

export interface RecommendationContext {
  severity: GapSeverity;
  /** 1..5 — the learner's measured level on the gapped competency. */
  currentLevel: number;
  /** Competency ids in the learner's role target vector (RoleCompetency rows). */
  roleTargetCompetencyIds: string[];
  /** 0..1 — DepartmentPriority.priority for the gapped competency. */
  departmentPriority: number;
}

/** Learner's measured level per competency id; null = not yet assessed. */
export type LearnerLevelMap = Record<string, number | null>;

// ─────────────────────────────────────────────────────────────────────────
// Factor functions — each exported so ReasonBreakdown shows the real rule
// ─────────────────────────────────────────────────────────────────────────

/** CRITICAL/HIGH/MEDIUM/LOW → 1.0/0.75/0.5/0.25. */
export function gapSeverityFactor(severity: GapSeverity): number {
  return GAP_SEVERITY_WEIGHT[severity];
}

/**
 * |course competencies ∩ role target vector| ÷ |course competencies| → 0..1.
 * A course whose every target is also a role requirement is maximally
 * relevant to THIS role; a generic course scores proportionally lower.
 */
export function roleRelevanceFactor(
  courseCompetencyIds: string[],
  roleTargetCompetencyIds: string[],
): number {
  if (courseCompetencyIds.length === 0) return 0;
  const targets = new Set(roleTargetCompetencyIds);
  let hits = 0;
  for (const id of courseCompetencyIds) {
    if (targets.has(id)) hits += 1;
  }
  return hits / courseCompetencyIds.length;
}

/**
 * Prerequisite readiness for the course's target competencies, judged over
 * the learner's measured levels:
 * - collect the direct prerequisites (one hop in the DAG) of every competency
 *   the course targets;
 * - a prerequisite counts as MET when the learner has been assessed on it at
 *   all with level ≥ 1 ("has the foundation");
 * - all met → 1.0; some met → 0.5; none met → 0.2; a course with no
 *   prerequisites at all is trivially ready → 1.0.
 */
export function prerequisiteReadinessFactor(
  courseCompetencyIds: string[],
  prerequisiteEdges: PrerequisiteEdge[],
  learnerLevels: LearnerLevelMap,
): number {
  const targets = new Set(courseCompetencyIds);
  const prereqIds = new Set<string>();
  for (const edge of prerequisiteEdges) {
    if (targets.has(edge.competencyId)) prereqIds.add(edge.prerequisiteId);
  }
  if (prereqIds.size === 0) return PREREQ_READINESS.ALL_MET;

  let met = 0;
  for (const id of prereqIds) {
    const level = learnerLevels[id];
    if (level !== null && level !== undefined && level >= 1) met += 1;
  }
  if (met === prereqIds.size) return PREREQ_READINESS.ALL_MET;
  if (met > 0) return PREREQ_READINESS.PARTIAL;
  return PREREQ_READINESS.UNMET;
}

/**
 * 1 − |courseLevel − (currentLevel + 1)| / 4, floored at 0. Peaks when the
 * course sits exactly ONE level above the learner's current level — the next
 * reachable step, not the hardest available course (§3).
 */
export function difficultyFitFactor(courseLevel: number, currentLevel: number): number {
  return Math.max(0, 1 - Math.abs(courseLevel - (currentLevel + 1)) / 4);
}

// ─────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────

export interface RecommendationFactors {
  semanticSimilarity: number;
  gapSeverityWeight: number;
  roleRelevance: number;
  prerequisiteReadiness: number;
  difficultyFit: number;
  departmentPriority: number;
}

export interface RankedRecommendation {
  courseId: string;
  score: number;
  /**
   * Real per-factor values — persisted verbatim into Recommendation.reasonsJson
   * and rendered by the ReasonBreakdown primitive. The UI never paraphrases
   * these (PRD §4.5: every recommendation shows its computed breakdown).
   */
  factors: RecommendationFactors;
  /**
   * True only when NO candidate cleared RECOMMENDATION_MIN_SCORE and this is
   * the best available — rendered with an explicit "closest match" caveat.
   */
  isClosestMatch: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────

/**
 * The Recommendation Engine's single entry point. Pure function: same input
 * always produces byte-identical output (asserted over 100 runs in
 * tests/engines/recommendation.test.ts).
 *
 * Ranking: score desc, then courseId asc — the tiebreak keeps ordering stable
 * across identical candidates supplied in different array orders.
 *
 * Every candidate gets a full per-factor breakdown; nothing is hidden behind
 * "the model recommended it".
 */
export function recommendCoursesForGap(params: {
  context: RecommendationContext;
  candidates: RecommendationCandidate[];
  prerequisiteEdges: PrerequisiteEdge[];
  learnerLevels: LearnerLevelMap;
  minScore?: number;
}): RankedRecommendation[] {
  const { context, candidates, prerequisiteEdges, learnerLevels } = params;
  const minScore = params.minScore ?? RECOMMENDATION_MIN_SCORE;
  const severityWeight = gapSeverityFactor(context.severity);

  const scored = candidates.map((candidate) => {
    const factors: RecommendationFactors = {
      semanticSimilarity: candidate.semanticSimilarity,
      gapSeverityWeight: severityWeight,
      roleRelevance: roleRelevanceFactor(candidate.competencyIds, context.roleTargetCompetencyIds),
      prerequisiteReadiness: prerequisiteReadinessFactor(
        candidate.competencyIds,
        prerequisiteEdges,
        learnerLevels,
      ),
      difficultyFit: difficultyFitFactor(candidate.level, context.currentLevel),
      departmentPriority: context.departmentPriority,
    };

    const score =
      RECOMMENDATION_WEIGHTS.semanticSimilarity * factors.semanticSimilarity +
      RECOMMENDATION_WEIGHTS.gapSeverityWeight * factors.gapSeverityWeight +
      RECOMMENDATION_WEIGHTS.roleRelevance * factors.roleRelevance +
      RECOMMENDATION_WEIGHTS.prerequisiteReadiness * factors.prerequisiteReadiness +
      RECOMMENDATION_WEIGHTS.difficultyFit * factors.difficultyFit +
      RECOMMENDATION_WEIGHTS.departmentPriority * factors.departmentPriority;

    return { courseId: candidate.courseId, score, factors };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.courseId < b.courseId ? -1 : a.courseId > b.courseId ? 1 : 0;
  });

  const anyClearsMin = scored.length > 0 && scored[0].score >= minScore;

  return scored.map((s, index) => ({
    courseId: s.courseId,
    score: s.score,
    factors: s.factors,
    // Only flagged when nothing cleared the floor — and only the single top
    // candidate, so at most one recommendation ever carries the caveat.
    isClosestMatch: !anyClearsMin && index === 0,
  }));
}
