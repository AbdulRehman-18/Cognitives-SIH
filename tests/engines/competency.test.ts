import { describe, expect, it } from "vitest";
import {
  computeAssessmentScore,
  computeHistoryScore,
  computePriorTrainingScore,
  computeRelevance,
  recencyDecay,
  scoreCompetency,
  TERM_WEIGHTS,
  CONFIDENCE_BANDS,
  type ScoringInput,
} from "@/lib/engines/competency";

// Per docs/engine-specifications.md "Test requirements".

describe("competency engine — determinism", () => {
  const input: ScoringInput = {
    assessmentAnswers: [
      { correct: true, difficulty: 0.8, competencyId: "c1" },
      { correct: false, difficulty: 0.5, competencyId: "c1" },
      { correct: true, difficulty: 0.3, competencyId: "c1" },
    ],
    priorTrainings: [{ relevance: 1, monthsSince: 6 }],
    assessmentHistory: [{ score: 55, ageInAssessments: 1 }],
  };

  it("same input × 100 runs ⇒ byte-identical output", () => {
    const results = Array.from({ length: 100 }, () => scoreCompetency(input));
    const serialized = results.map((r) => JSON.stringify(r));
    const first = serialized[0];
    for (const s of serialized) {
      expect(s).toBe(first);
    }
  });
});

describe("competency engine — weight renormalization", () => {
  it("assessment-only evidence is not diluted by absent terms", () => {
    const input: ScoringInput = {
      assessmentAnswers: [
        { correct: true, difficulty: 1, competencyId: "c1" },
        { correct: true, difficulty: 1, competencyId: "c1" },
      ],
      priorTrainings: [],
      assessmentHistory: [],
    };
    const result = scoreCompetency(input);
    // assessmentScore = 1.0 (both correct). With only the assessment term
    // present, current should be 100 * (0.60 * 1.0) / 0.60 = 100, NOT
    // 100 * 0.60 * 1.0 = 60 (which would be the undiluted/un-renormalized
    // — actually diluted — answer).
    expect(result.current).toBe(100);
    expect(result.level).toBe(5);
  });

  it("renormalizes correctly for a two-term mix (assessment + priorTraining)", () => {
    const input: ScoringInput = {
      assessmentAnswers: [{ correct: true, difficulty: 1, competencyId: "c1" }],
      priorTrainings: [{ relevance: 1, monthsSince: 0 }],
      assessmentHistory: [],
    };
    const result = scoreCompetency(input);
    // assessmentScore = 1, priorTrainingScore = min(1, 1*1/3) = 1/3.
    // presentWeightSum = 0.60 + 0.25 = 0.85.
    const expectedWeightedSum = 1 * TERM_WEIGHTS.assessment + (1 / 3) * TERM_WEIGHTS.priorTraining;
    const expectedCurrent = (100 * expectedWeightedSum) / (TERM_WEIGHTS.assessment + TERM_WEIGHTS.priorTraining);
    expect(result.current).toBeCloseTo(expectedCurrent, 10);
  });
});

describe("competency engine — null propagation", () => {
  it("no evidence at all ⇒ current, level, confidence are all null", () => {
    const result = scoreCompetency({ assessmentAnswers: [], priorTrainings: [], assessmentHistory: [] });
    expect(result.current).toBeNull();
    expect(result.level).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.confidenceBand).toBeNull();
    expect(result.evidence).toEqual([]);
  });

  it("current is never 0 when there is zero evidence, even though 0 is a valid score value", () => {
    const zeroEvidence = scoreCompetency({ assessmentAnswers: [], priorTrainings: [], assessmentHistory: [] });
    expect(zeroEvidence.current).not.toBe(0);
    expect(zeroEvidence.current).toBeNull();
  });

  it("all-incorrect assessment answers legitimately produce a low but non-null score", () => {
    const result = scoreCompetency({
      assessmentAnswers: [{ correct: false, difficulty: 1, competencyId: "c1" }],
      priorTrainings: [],
      assessmentHistory: [],
    });
    expect(result.current).toBe(0);
    expect(result.current).not.toBeNull();
  });

  it("computeAssessmentScore / computePriorTrainingScore / computeHistoryScore return null on empty input", () => {
    expect(computeAssessmentScore([])).toBeNull();
    expect(computePriorTrainingScore([])).toBeNull();
    expect(computeHistoryScore([])).toBeNull();
  });
});

describe("competency engine — evidence rows sum to the displayed score", () => {
  it("sums evidence contributions to current for a full three-term mix", () => {
    const input: ScoringInput = {
      assessmentAnswers: [
        { correct: true, difficulty: 0.9, competencyId: "c1" },
        { correct: false, difficulty: 0.4, competencyId: "c1" },
      ],
      priorTrainings: [
        { relevance: 1, monthsSince: 3 },
        { relevance: 0.5, monthsSince: 18 },
      ],
      assessmentHistory: [
        { score: 60, ageInAssessments: 0 },
        { score: 40, ageInAssessments: 2 },
      ],
    };
    const result = scoreCompetency(input);
    const evidenceSum = result.evidence.reduce((s, e) => s + e.contribution, 0);
    expect(evidenceSum).toBeCloseTo(result.current!, 8);
  });

  it("sums evidence contributions to current for assessment-only evidence", () => {
    const input: ScoringInput = {
      assessmentAnswers: [
        { correct: true, difficulty: 1, competencyId: "c1" },
        { correct: false, difficulty: 1, competencyId: "c1" },
        { correct: true, difficulty: 0.5, competencyId: "c1" },
      ],
      priorTrainings: [],
      assessmentHistory: [],
    };
    const result = scoreCompetency(input);
    const evidenceSum = result.evidence.reduce((s, e) => s + e.contribution, 0);
    expect(evidenceSum).toBeCloseTo(result.current!, 8);
  });

  it("sums evidence contributions to current for a single prior training only", () => {
    const input: ScoringInput = {
      assessmentAnswers: [],
      priorTrainings: [{ relevance: 1, monthsSince: 0 }],
      assessmentHistory: [],
    };
    const result = scoreCompetency(input);
    const evidenceSum = result.evidence.reduce((s, e) => s + e.contribution, 0);
    expect(evidenceSum).toBeCloseTo(result.current!, 8);
  });
});

describe("competency engine — relevance DAG logic", () => {
  const edges = [
    // "Sampling" requires "Survey Design"
    { competencyId: "sampling", prerequisiteId: "survey-design" },
    // "National Accounts" requires "Sampling"
    { competencyId: "national-accounts", prerequisiteId: "sampling" },
  ];

  it("direct match ⇒ 1.0", () => {
    expect(computeRelevance("sampling", ["sampling"], edges)).toBe(1);
  });

  it("one-hop prerequisite ⇒ 0.5", () => {
    // Training tagged with the prerequisite of the target competency.
    expect(computeRelevance("sampling", ["survey-design"], edges)).toBe(0.5);
  });

  it("one-hop dependent ⇒ 0.5", () => {
    // Training tagged with a competency that directly depends on the target.
    expect(computeRelevance("sampling", ["national-accounts"], edges)).toBe(0.5);
  });

  it("unrelated ⇒ 0", () => {
    expect(computeRelevance("sampling", ["national-accounts"], []).valueOf()).toBe(0);
  });

  it("two-hop relation (not direct, not one-hop) ⇒ 0", () => {
    // "national-accounts" is two hops from "survey-design" via "sampling".
    expect(computeRelevance("survey-design", ["national-accounts"], edges)).toBe(0);
  });

  it("direct match takes priority even if also one-hop-reachable", () => {
    expect(computeRelevance("sampling", ["sampling", "survey-design"], edges)).toBe(1);
  });
});

describe("competency engine — recencyDecay", () => {
  it("is 1.0 at zero months", () => {
    expect(recencyDecay(0)).toBe(1);
  });

  it("halves at the 24-month half-life", () => {
    expect(recencyDecay(24)).toBeCloseTo(0.5, 10);
  });

  it("quarters at 48 months", () => {
    expect(recencyDecay(48)).toBeCloseTo(0.25, 10);
  });
});

describe("competency engine — confidence band boundaries", () => {
  // confidence = min(1, evidenceCount/5) * avgRecencyFactor
  // With 5+ fresh assessment answers (recency factor 1 each), confidence = 1 → HIGH.
  it("high evidence count + full recency ⇒ HIGH band, ±3 display range", () => {
    const input: ScoringInput = {
      assessmentAnswers: Array.from({ length: 5 }, () => ({
        correct: true,
        difficulty: 1,
        competencyId: "c1",
      })),
      priorTrainings: [],
      assessmentHistory: [],
    };
    const result = scoreCompetency(input);
    expect(result.confidence).toBe(1);
    expect(result.confidenceBand).toBe("HIGH");
    expect(result.displayRange).toBe(CONFIDENCE_BANDS.HIGH.displayRange);
  });

  it("boundary: confidence just under 0.4 ⇒ LOW; at/just-over 0.4 ⇒ MEDIUM", () => {
    // 1 evidence item (evidenceCount/5 = 0.2) with recencyDecay chosen so
    // confidence lands exactly at the LOW/MEDIUM boundary (0.4).
    // confidence = 0.2 * recencyDecay(months) = 0.4 → recencyDecay = 2, impossible
    // (decay <= 1), so instead directly probe bandForConfidence via scoreCompetency
    // using evidenceCount=5 (factor 1/5=... ) -- use 2 items at full recency:
    // evidenceCount/5 = 2/5 = 0.4, avgRecencyFactor = 1 ⇒ confidence = 0.4 ⇒ MEDIUM.
    const atBoundary = scoreCompetency({
      assessmentAnswers: [
        { correct: true, difficulty: 1, competencyId: "c1" },
        { correct: true, difficulty: 1, competencyId: "c1" },
      ],
      priorTrainings: [],
      assessmentHistory: [],
    });
    expect(atBoundary.confidence).toBeCloseTo(0.4, 10);
    expect(atBoundary.confidenceBand).toBe("MEDIUM");
    expect(atBoundary.displayRange).toBe(CONFIDENCE_BANDS.MEDIUM.displayRange);

    // 1 evidence item ⇒ evidenceCount/5 = 0.2, avgRecencyFactor = 1 ⇒ confidence = 0.2 < 0.4 ⇒ LOW.
    const belowBoundary = scoreCompetency({
      assessmentAnswers: [{ correct: true, difficulty: 1, competencyId: "c1" }],
      priorTrainings: [],
      assessmentHistory: [],
    });
    expect(belowBoundary.confidence).toBeCloseTo(0.2, 10);
    expect(belowBoundary.confidenceBand).toBe("LOW");
    expect(belowBoundary.displayRange).toBe(CONFIDENCE_BANDS.LOW.displayRange);
  });

  it("boundary: confidence just under 0.75 ⇒ MEDIUM; at/over 0.75 ⇒ HIGH", () => {
    // evidenceCount = 4 (4/5 = 0.8 capped irrelevant here since <1), full recency ⇒ confidence 0.8 ⇒ HIGH.
    const high = scoreCompetency({
      assessmentAnswers: Array.from({ length: 4 }, () => ({
        correct: true,
        difficulty: 1,
        competencyId: "c1",
      })),
      priorTrainings: [],
      assessmentHistory: [],
    });
    expect(high.confidence).toBeCloseTo(0.8, 10);
    expect(high.confidenceBand).toBe("HIGH");

    // evidenceCount = 3 (3/5 = 0.6), full recency ⇒ confidence 0.6 ⇒ MEDIUM (< 0.75).
    const medium = scoreCompetency({
      assessmentAnswers: Array.from({ length: 3 }, () => ({
        correct: true,
        difficulty: 1,
        competencyId: "c1",
      })),
      priorTrainings: [],
      assessmentHistory: [],
    });
    expect(medium.confidence).toBeCloseTo(0.6, 10);
    expect(medium.confidenceBand).toBe("MEDIUM");
  });
});

describe("competency engine — level clamping", () => {
  it("level is ceil(current/20), clamped to 1..5", () => {
    const perfect = scoreCompetency({
      assessmentAnswers: [{ correct: true, difficulty: 1, competencyId: "c1" }],
      priorTrainings: [],
      assessmentHistory: [],
    });
    expect(perfect.current).toBe(100);
    expect(perfect.level).toBe(5);

    const zero = scoreCompetency({
      assessmentAnswers: [{ correct: false, difficulty: 1, competencyId: "c1" }],
      priorTrainings: [],
      assessmentHistory: [],
    });
    expect(zero.current).toBe(0);
    // ceil(0/20) = 0, clamped up to the minimum level of 1.
    expect(zero.level).toBe(1);
  });
});
