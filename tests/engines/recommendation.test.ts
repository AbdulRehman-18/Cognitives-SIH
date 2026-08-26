import { describe, expect, it } from "vitest";
import {
  difficultyFitFactor,
  GAP_SEVERITY_WEIGHT,
  prerequisiteReadinessFactor,
  recommendCoursesForGap,
  RECOMMENDATION_MIN_SCORE,
  RECOMMENDATION_WEIGHTS,
  roleRelevanceFactor,
  type RecommendationCandidate,
  type RecommendationContext,
} from "@/lib/engines/recommendation";

// Per docs/engine-specifications.md §3 + the phase definition of done:
// exact factor math, weight-sum integrity, closest-match caveat path,
// deterministic ordering tiebreaks, and 100-run byte-identical determinism.

const EDGES = [
  { competencyId: "dv", prerequisiteId: "python" },
  { competencyId: "ml", prerequisiteId: "dv" },
];

function makeContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
  return {
    severity: "HIGH",
    currentLevel: 2,
    roleTargetCompetencyIds: ["dv", "python"],
    departmentPriority: 0.8,
    ...overrides,
  };
}

describe("recommendation engine — factor functions", () => {
  it("gapSeverityFactor maps CRITICAL/HIGH/MEDIUM/LOW to 1.0/0.75/0.5/0.25 exactly", () => {
    expect(GAP_SEVERITY_WEIGHT.CRITICAL).toBe(1.0);
    expect(GAP_SEVERITY_WEIGHT.HIGH).toBe(0.75);
    expect(GAP_SEVERITY_WEIGHT.MEDIUM).toBe(0.5);
    expect(GAP_SEVERITY_WEIGHT.LOW).toBe(0.25);
  });

  it("roleRelevance is intersection size over course competency count", () => {
    // 1 of the course's 2 competencies is a role target → 0.5
    expect(roleRelevanceFactor(["dv", "sql"], ["dv", "python"])).toBeCloseTo(0.5, 12);
    expect(roleRelevanceFactor(["dv", "python"], ["dv", "python"])).toBe(1);
    expect(roleRelevanceFactor(["sql"], ["dv", "python"])).toBe(0);
    expect(roleRelevanceFactor([], ["dv"])).toBe(0); // degenerate course → 0, not NaN
  });

  it("prerequisiteReadiness: all met 1.0 / partial 0.5 / none met 0.2 / no prereqs 1.0", () => {
    const allMet = prerequisiteReadinessFactor(["dv"], EDGES, { python: 3 });
    const partial = prerequisiteReadinessFactor(["ml", "dv"], [...EDGES, { competencyId: "ml", prerequisiteId: "stats" }], {
      python: 3,
      stats: null,
      dv: 2,
    });
    const unmet = prerequisiteReadinessFactor(["dv"], EDGES, { python: null });
    const noPrereqs = prerequisiteReadinessFactor(["sql"], EDGES, {});
    expect(allMet).toBe(1.0);
    expect(partial).toBe(0.5);
    expect(unmet).toBe(0.2);
    expect(noPrereqs).toBe(1.0);
  });

  it("difficultyFit exact values recomputed by hand", () => {
    // currentLevel 2 ⇒ peak at courseLevel 3.
    expect(difficultyFitFactor(3, 2)).toBe(1);
    // courseLevel 5, currentLevel 2: |5 − 3| = 2 → 1 − 2/4 = 0.5
    expect(difficultyFitFactor(5, 2)).toBeCloseTo(0.5, 12);
    // courseLevel 7 would be 1 − 4/4 = 0; clamp keeps ≥ 0 for absurd inputs.
    expect(difficultyFitFactor(9, 2)).toBe(0);
  });

  it("weights sum to 1.0 so scores live on a 0..1 scale", () => {
    const sum = Object.values(RECOMMENDATION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
  });
});

describe("recommendation engine — ranking", () => {
  const candidates: RecommendationCandidate[] = [
    { courseId: "course-a", competencyIds: ["dv"], level: 3, semanticSimilarity: 0.9 },
    { courseId: "course-b", competencyIds: ["sql"], level: 5, semanticSimilarity: 0.8 },
    { courseId: "course-c", competencyIds: ["python"], level: 2, semanticSimilarity: 0.7 },
  ];

  it("orders score desc with full per-factor breakdowns persisted per candidate", () => {
    const result = recommendCoursesForGap({
      context: makeContext(),
      candidates,
      prerequisiteEdges: EDGES,
      learnerLevels: { python: 3 },
    });

    // Hand-compute the top candidate (course-a):
    //  0.35×0.9 + 0.25×0.75 + 0.15×1.0 + 0.10×1.0(prereq python met) + 0.10×1.0(level3 vs current2) + 0.05×0.8
    const expectedA =
      0.35 * 0.9 +
      0.25 * 0.75 +
      0.15 * 1 +
      0.1 * 1 +
      0.1 * 1 +
      0.05 * 0.8;
    expect(result[0].courseId).toBe("course-a");
    expect(result[0].score).toBeCloseTo(expectedA, 12);
    expect(result[0].factors.semanticSimilarity).toBe(0.9);
    expect(result[0].factors.gapSeverityWeight).toBe(0.75);
    expect(result[0].factors.roleRelevance).toBe(1);
    expect(result[0].factors.prerequisiteReadiness).toBe(1);
    expect(result[0].factors.difficultyFit).toBe(1);
    expect(result[0].factors.departmentPriority).toBe(0.8);

    // Monotonic non-increasing scores.
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("no recommendation carries isClosestMatch when the top score clears the minimum", () => {
    const result = recommendCoursesForGap({
      context: makeContext(),
      candidates,
      prerequisiteEdges: EDGES,
      learnerLevels: { python: 3 },
    });
    expect(result.every((r) => !r.isClosestMatch)).toBe(true);
  });

  it("when nothing clears the floor, exactly the top candidate is flagged isClosestMatch", () => {
    const weakCandidates: RecommendationCandidate[] = [
      { courseId: "weak-1", competencyIds: [], level: 1, semanticSimilarity: 0.05 },
      { courseId: "weak-2", competencyIds: [], level: 1, semanticSimilarity: 0.04 },
    ];
    const result = recommendCoursesForGap({
      context: makeContext({ severity: "LOW" }),
      candidates: weakCandidates,
      prerequisiteEdges: EDGES,
      learnerLevels: {},
      minScore: RECOMMENDATION_MIN_SCORE,
    });
    expect(result).toHaveLength(2);
    expect(result.filter((r) => r.isClosestMatch).map((r) => r.courseId)).toEqual(["weak-1"]);
  });

  it("ties in score break by courseId asc — stable across input order permutations", () => {
    const tied: RecommendationCandidate[] = [
      { courseId: "zzz", competencyIds: ["x"], level: 3, semanticSimilarity: 0.5 },
      { courseId: "aaa", competencyIds: ["x"], level: 3, semanticSimilarity: 0.5 },
    ];
    const forward = recommendCoursesForGap({
      context: makeContext(),
      candidates: tied,
      prerequisiteEdges: [],
      learnerLevels: {},
    });
    const reversed = recommendCoursesForGap({
      context: makeContext(),
      candidates: [...tied].reverse(),
      prerequisiteEdges: [],
      learnerLevels: {},
    });
    expect(forward.map((r) => r.courseId)).toEqual(["aaa", "zzz"]);
    expect(reversed.map((r) => r.courseId)).toEqual(["aaa", "zzz"]);
  });

  it("empty candidate list returns empty output — never throws", () => {
    const result = recommendCoursesForGap({
      context: makeContext(),
      candidates: [],
      prerequisiteEdges: [],
      learnerLevels: {},
    });
    expect(result).toEqual([]);
  });

  it("is deterministic over 100 identical runs (byte-identical JSON)", () => {
    const run = () =>
      JSON.stringify(
        recommendCoursesForGap({
          context: makeContext(),
          candidates,
          prerequisiteEdges: EDGES,
          learnerLevels: { python: 3, ml: null },
        }),
      );
    const first = run();
    for (let i = 0; i < 100; i++) {
      expect(run()).toBe(first);
    }
  });
});
