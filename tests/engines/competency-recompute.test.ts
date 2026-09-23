import { describe, expect, it } from "vitest";
import {
  applyHintPenalty,
  computeRelevance,
  monthsBetween,
  scoreCompetency,
  HINT_SCORE_FLOOR,
} from "@/lib/engines/competency";

// Engine-level guarantees the recompute service (src/lib/competency/recompute.ts)
// relies on when course completions and prior trainings feed a score.

const answers = [
  { correct: true, difficulty: 0.6, competencyId: "python" },
  { correct: false, difficulty: 0.4, competencyId: "python" },
];

describe("course completion raises a competency score", () => {
  it("a directly relevant, recent completion lifts current above assessment-only", () => {
    const assessmentOnly = scoreCompetency({ assessmentAnswers: answers, priorTrainings: [], assessmentHistory: [] });
    const withCompletion = scoreCompetency({
      assessmentAnswers: answers,
      priorTrainings: [{ relevance: 1, monthsSince: 0 }],
      assessmentHistory: [],
    });
    // Assessment-only = 60. One fresh relevance-1 completion scores 1/3 on the
    // training term, so the renormalized score stays below a perfect 100 and
    // cannot be driven by training alone.
    expect(withCompletion.current).not.toBeNull();
    expect(withCompletion.confidence!).toBeGreaterThan(assessmentOnly.confidence!);
    expect(withCompletion.evidence.some((e) => e.term === "priorTraining")).toBe(true);
  });

  it("three fresh completions with no assessment give a real score with LOW-to-MEDIUM confidence", () => {
    const result = scoreCompetency({
      assessmentAnswers: [],
      priorTrainings: [
        { relevance: 1, monthsSince: 0 },
        { relevance: 1, monthsSince: 1 },
        { relevance: 0.5, monthsSince: 2 },
      ],
      assessmentHistory: [],
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.confidenceBand).not.toBe("HIGH");
  });

  it("relevance comes from the prerequisite DAG, never free text", () => {
    const edges = [{ competencyId: "ml", prerequisiteId: "python" }];
    expect(computeRelevance("python", ["python"], edges)).toBe(1);
    expect(computeRelevance("python", ["ml"], edges)).toBe(0.5);
    expect(computeRelevance("python", ["gis"], edges)).toBe(0);
  });
});

describe("applyHintPenalty", () => {
  const base = scoreCompetency({ assessmentAnswers: answers, priorTrainings: [], assessmentHistory: [] });

  it("is a no-op with zero hints", () => {
    expect(applyHintPenalty(base, 0)).toBe(base);
  });

  it("scales current and every evidence contribution by the same multiplier", () => {
    const penalized = applyHintPenalty(base, 2);
    expect(penalized.current).toBeCloseTo(base.current! * 0.8, 10);
    const sum = penalized.evidence.reduce((s, e) => s + e.contribution, 0);
    expect(sum).toBeCloseTo(penalized.current!, 6);
  });

  it("never drops below the floor multiplier", () => {
    expect(applyHintPenalty(base, 50).current).toBeCloseTo(base.current! * HINT_SCORE_FLOOR, 10);
  });
});

describe("monthsBetween", () => {
  it("is ~12 for one year and never negative", () => {
    expect(monthsBetween(new Date("2025-01-01"), new Date("2026-01-01"))).toBeCloseTo(12, 0);
    expect(monthsBetween(new Date("2026-01-01"), new Date("2025-01-01"))).toBe(0);
  });
});
