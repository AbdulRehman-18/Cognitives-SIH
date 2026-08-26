// Competency Engine — src/lib/engines/competency.ts
//
// Normative reference: docs/engine-specifications.md §1. This file is pure:
// structured input in, number/classification out. No `import` from
// src/lib/ai/ (enforced by eslint.config.mjs + tests/architecture), no
// network calls, no Date.now() inside the math — every timestamp-dependent
// calculation takes `now` as an explicit argument so tests can pin it.
//
// PRD §2.5: the LLM never decides a number. This module is the entire
// defensibility claim of the product.

// ─────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────

export interface AssessmentAnswerInput {
  correct: boolean;
  /** 0..1 */
  difficulty: number;
  competencyId: string;
}

export interface PriorTrainingInput {
  /** 0, 0.5, or 1.0 — see computeRelevance(). Never LLM-assigned. */
  relevance: 0 | 0.5 | 1;
  monthsSince: number;
}

export interface AssessmentHistoryInput {
  /** 0..100 — a previously computed `current` score for this competency. */
  score: number;
  /** 0 = most recent prior assessment, 1 = the one before that, etc. */
  ageInAssessments: number;
}

export interface ScoringInput {
  assessmentAnswers: AssessmentAnswerInput[];
  priorTrainings: PriorTrainingInput[];
  assessmentHistory: AssessmentHistoryInput[];
}

// ─────────────────────────────────────────────────────────────────────────
// Weights (exported so a judge can be shown the literal rule)
// ─────────────────────────────────────────────────────────────────────────

export const TERM_WEIGHTS = {
  assessment: 0.6,
  priorTraining: 0.25,
  history: 0.15,
} as const;

export const RECENCY_HALF_LIFE_MONTHS = 24;
export const HISTORY_DECAY_BASE = 0.7;
export const PRIOR_TRAINING_NORMALIZER = 3;

export const CONFIDENCE_BANDS = {
  LOW: { max: 0.4, displayRange: 12 },
  MEDIUM: { max: 0.75, displayRange: 7 },
  HIGH: { max: 1, displayRange: 3 },
} as const;

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

// ─────────────────────────────────────────────────────────────────────────
// Term scores
// ─────────────────────────────────────────────────────────────────────────

/** Σ(correct_i × difficulty_i) / Σ(difficulty_i) → 0..1, or null if no answers. */
export function computeAssessmentScore(answers: AssessmentAnswerInput[]): number | null {
  if (answers.length === 0) return null;
  const totalDifficulty = answers.reduce((sum, a) => sum + a.difficulty, 0);
  if (totalDifficulty <= 0) return null;
  const earned = answers.reduce((sum, a) => sum + (a.correct ? a.difficulty : 0), 0);
  return earned / totalDifficulty;
}

/** 0.5 ^ (monthsSince / 24) — a 24-month half-life. */
export function recencyDecay(monthsSince: number): number {
  return Math.pow(0.5, monthsSince / RECENCY_HALF_LIFE_MONTHS);
}

/** min(1, Σ(relevance × recencyDecay) / 3) → 0..1, or null if no trainings. */
export function computePriorTrainingScore(trainings: PriorTrainingInput[]): number | null {
  if (trainings.length === 0) return null;
  const sum = trainings.reduce((acc, t) => acc + t.relevance * recencyDecay(t.monthsSince), 0);
  return Math.min(1, sum / PRIOR_TRAINING_NORMALIZER);
}

/** Σ(score_i × 0.7^age_i) / Σ(0.7^age_i) → 0..1 (score input is 0..100), or null if no history. */
export function computeHistoryScore(history: AssessmentHistoryInput[]): number | null {
  if (history.length === 0) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const h of history) {
    const w = Math.pow(HISTORY_DECAY_BASE, h.ageInAssessments);
    weightedSum += (h.score / 100) * w;
    weightTotal += w;
  }
  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
}

// ─────────────────────────────────────────────────────────────────────────
// relevance — resolved by DAG set overlap, never an LLM judgment
// ─────────────────────────────────────────────────────────────────────────

export interface PrerequisiteEdge {
  /** The competency that requires `prerequisiteId`. */
  competencyId: string;
  prerequisiteId: string;
}

/**
 * relevance ∈ {0, 0.5, 1.0} between a prior training's tagged competency ids
 * and the competency being scored — computed by set overlap over the
 * CompetencyPrerequisite DAG. 1.0 direct match, 0.5 one-hop prerequisite or
 * dependent, 0 unrelated. Never delegated to the LLM (engine-specifications
 * §1: "Tempting to ask an LLM to judge relevance. Don't.").
 */
export function computeRelevance(
  targetCompetencyId: string,
  trainingCompetencyIds: string[],
  prerequisiteEdges: PrerequisiteEdge[],
): 0 | 0.5 | 1 {
  const tagged = new Set(trainingCompetencyIds);
  if (tagged.has(targetCompetencyId)) return 1;

  const oneHop = new Set<string>();
  for (const edge of prerequisiteEdges) {
    if (edge.competencyId === targetCompetencyId) {
      // targetCompetency's direct prerequisites.
      oneHop.add(edge.prerequisiteId);
    }
    if (edge.prerequisiteId === targetCompetencyId) {
      // competencies that directly depend on targetCompetency.
      oneHop.add(edge.competencyId);
    }
  }

  for (const id of tagged) {
    if (oneHop.has(id)) return 0.5;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Composite score
// ─────────────────────────────────────────────────────────────────────────

export interface ScoringTermResult {
  score: number | null;
  weight: number;
}

export interface CompetencyScoreResult {
  /** null = zero evidence across all three terms = "Not yet assessed." Never 0. */
  current: number | null;
  /** 1..5, or null when current is null. */
  level: number | null;
  /** 0..1, or null when current is null. */
  confidence: number | null;
  confidenceBand: ConfidenceBand | null;
  /** ± display range driven by confidenceBand (engine-specifications §1). */
  displayRange: number | null;
  terms: {
    assessment: ScoringTermResult;
    priorTraining: ScoringTermResult;
    history: ScoringTermResult;
  };
  /** Evidence line items — one per non-zero contributing input, plus per-term rollups. */
  evidence: EvidenceContribution[];
}

export interface EvidenceContribution {
  /**
   * Which raw input this line traces back to, using the schema's
   * EvidenceSourceType enum. `assessmentHistory` entries are prior
   * diagnostic/standard assessments (just aged, per §1's historyScore),
   * so they map to ASSESSMENT — never COURSE_COMPLETION, which is reserved
   * for the Recommendation Engine's learning-path completion evidence.
   */
  sourceType: "ASSESSMENT" | "PRIOR_TRAINING";
  /** Which input array this line came from, for traceability/debugging. */
  term: "assessment" | "priorTraining" | "history";
  /** Index into the corresponding input array, for traceability. */
  sourceIndex: number;
  /** This evidence row's contribution to the final 0-100 `current` score. */
  contribution: number;
  /** The weight applied by the formula for this term. */
  weight: number;
}

/**
 * The Competency Engine's single entry point. Pure function: same input
 * always produces byte-identical output (see tests/engines/competency.test.ts).
 *
 * `now` is accepted for API symmetry with callers that may want to stamp
 * evidence rows, but nothing in the math below reads wall-clock time —
 * recency is entirely a function of the `monthsSince` / `ageInAssessments`
 * fields already present in the input.
 */
export function scoreCompetency(input: ScoringInput): CompetencyScoreResult {
  const assessmentScore = computeAssessmentScore(input.assessmentAnswers);
  const priorTrainingScore = computePriorTrainingScore(input.priorTrainings);
  const historyScore = computeHistoryScore(input.assessmentHistory);

  const terms = {
    assessment: { score: assessmentScore, weight: TERM_WEIGHTS.assessment },
    priorTraining: { score: priorTrainingScore, weight: TERM_WEIGHTS.priorTraining },
    history: { score: historyScore, weight: TERM_WEIGHTS.history },
  };

  const presentWeightSum =
    (assessmentScore !== null ? TERM_WEIGHTS.assessment : 0) +
    (priorTrainingScore !== null ? TERM_WEIGHTS.priorTraining : 0) +
    (historyScore !== null ? TERM_WEIGHTS.history : 0);

  // Zero evidence across all three terms ⇒ null, never 0 (engine-specifications §1 "Null handling").
  if (presentWeightSum === 0) {
    return {
      current: null,
      level: null,
      confidence: null,
      confidenceBand: null,
      displayRange: null,
      terms,
      evidence: [],
    };
  }

  const weightedSum =
    (assessmentScore ?? 0) * TERM_WEIGHTS.assessment +
    (priorTrainingScore ?? 0) * TERM_WEIGHTS.priorTraining +
    (historyScore ?? 0) * TERM_WEIGHTS.history;

  // Weight renormalization by weights actually present — mandatory. An
  // officer with assessment-only evidence is not diluted by absent terms.
  const current = (100 * weightedSum) / presentWeightSum;

  const level = Math.max(1, Math.min(5, Math.ceil(current / 20)));

  const evidenceCount =
    input.assessmentAnswers.length + input.priorTrainings.length + input.assessmentHistory.length;

  const avgRecencyFactor = computeAvgRecencyFactor(input);
  const confidence = Math.min(1, evidenceCount / 5) * avgRecencyFactor;
  const confidenceBand = bandForConfidence(confidence);
  const displayRange = CONFIDENCE_BANDS[confidenceBand].displayRange;

  const evidence = buildEvidenceContributions(input, presentWeightSum);

  return {
    current,
    level,
    confidence,
    confidenceBand,
    displayRange,
    terms,
    evidence,
  };
}

/**
 * Recency factor feeding confidence: 1.0 for assessment answers (always
 * "now" relative to the diagnostic that produced them), recencyDecay() for
 * prior trainings, and the same 0.7^age decay curve for assessment history.
 * Averaged across all evidence items — more, fresher evidence raises
 * confidence; stale or sparse evidence lowers it (engine-specifications §1
 * "Confidence").
 */
function computeAvgRecencyFactor(input: ScoringInput): number {
  const factors: number[] = [];
  for (let i = 0; i < input.assessmentAnswers.length; i++) factors.push(1);
  for (const t of input.priorTrainings) factors.push(recencyDecay(t.monthsSince));
  for (const h of input.assessmentHistory) factors.push(Math.pow(HISTORY_DECAY_BASE, h.ageInAssessments));

  if (factors.length === 0) return 0;
  return factors.reduce((a, b) => a + b, 0) / factors.length;
}

function bandForConfidence(confidence: number): ConfidenceBand {
  if (confidence < CONFIDENCE_BANDS.LOW.max) return "LOW";
  if (confidence < CONFIDENCE_BANDS.MEDIUM.max) return "MEDIUM";
  return "HIGH";
}

/**
 * Every non-zero term writes evidence rows whose contributions sum to the
 * displayed `current` score (engine-specifications §1 "Evidence rows" —
 * asserted directly in tests/engines/competency.test.ts).
 *
 * Each raw input line item is attributed a proportional share of its term's
 * total contribution, so `EvidenceDrawer` can render real per-source rows
 * (e.g. "Diagnostic assessment — contrib 3.6") rather than one lump sum per
 * term.
 */
function buildEvidenceContributions(
  input: ScoringInput,
  presentWeightSum: number,
): EvidenceContribution[] {
  const rows: EvidenceContribution[] = [];

  const assessmentTotal = computeAssessmentScore(input.assessmentAnswers);
  if (assessmentTotal !== null && input.assessmentAnswers.length > 0) {
    const termContribution = (100 * assessmentTotal * TERM_WEIGHTS.assessment) / presentWeightSum;
    const totalDifficulty = input.assessmentAnswers.reduce((s, a) => s + a.difficulty, 0);
    input.assessmentAnswers.forEach((a, i) => {
      const share = totalDifficulty > 0 ? a.difficulty / totalDifficulty : 0;
      rows.push({
        sourceType: "ASSESSMENT",
        term: "assessment",
        sourceIndex: i,
        contribution: termContribution * share,
        weight: TERM_WEIGHTS.assessment,
      });
    });
  }

  const priorTrainingTotal = computePriorTrainingScore(input.priorTrainings);
  if (priorTrainingTotal !== null && input.priorTrainings.length > 0) {
    const termContribution = (100 * priorTrainingTotal * TERM_WEIGHTS.priorTraining) / presentWeightSum;
    const rawSum = input.priorTrainings.reduce(
      (s, t) => s + t.relevance * recencyDecay(t.monthsSince),
      0,
    );
    input.priorTrainings.forEach((t, i) => {
      const raw = t.relevance * recencyDecay(t.monthsSince);
      const share = rawSum > 0 ? raw / rawSum : 0;
      rows.push({
        sourceType: "PRIOR_TRAINING",
        term: "priorTraining",
        sourceIndex: i,
        contribution: termContribution * share,
        weight: TERM_WEIGHTS.priorTraining,
      });
    });
  }

  const historyTotal = computeHistoryScore(input.assessmentHistory);
  if (historyTotal !== null && input.assessmentHistory.length > 0) {
    const termContribution = (100 * historyTotal * TERM_WEIGHTS.history) / presentWeightSum;
    const weightTotal = input.assessmentHistory.reduce(
      (s, h) => s + Math.pow(HISTORY_DECAY_BASE, h.ageInAssessments),
      0,
    );
    input.assessmentHistory.forEach((h, i) => {
      const w = Math.pow(HISTORY_DECAY_BASE, h.ageInAssessments);
      const share = weightTotal > 0 ? w / weightTotal : 0;
      rows.push({
        sourceType: "ASSESSMENT",
        term: "history",
        sourceIndex: i,
        contribution: termContribution * share,
        weight: TERM_WEIGHTS.history,
      });
    });
  }

  return rows;
}
