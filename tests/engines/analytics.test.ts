import { describe, expect, it } from "vitest";
import {
  computeCompetencyDistribution,
  computeTrainingEffectiveness,
  forecastShortages,
  learnerDelta,
  linearTrend,
  MIN_COMPLETIONS_FOR_RANKING,
  type EnrolmentObservation,
} from "@/lib/engines/analytics";

const obs = (courseId: string, completed: boolean, before: number | null, after: number | null, hours = 10): EnrolmentObservation => ({
  courseId,
  courseTitle: courseId,
  source: "IGOT",
  hours,
  completed,
  baseline: { c1: before },
  current: { c1: after },
});

describe("training effectiveness", () => {
  it("learner delta is the mean change over competencies with both scores", () => {
    expect(learnerDelta({ baseline: { a: 40, b: 50, c: null }, current: { a: 60, b: 50, c: 70 } })).toBe(10);
    expect(learnerDelta({ baseline: null, current: { a: 60 } })).toBeNull();
  });

  it("only completed, measured enrolments count; completion rate uses all enrolments", () => {
    const [course] = computeTrainingEffectiveness([obs("x", true, 40, 60), obs("x", true, 30, 40), obs("x", false, 20, 80), obs("x", true, null, 70)]);
    expect(course.enrolments).toBe(4);
    expect(course.completions).toBe(3);
    expect(course.completionRate).toBeCloseTo(0.75);
    expect(course.measuredCompletions).toBe(2);
    expect(course.meanDelta).toBe(15);
    expect(course.deltaPerHour).toBeCloseTo(1.5);
    expect(course.sufficientData).toBe(false);
  });

  it(`ranks only courses with ≥${MIN_COMPLETIONS_FOR_RANKING} measured completions, best delta first`, () => {
    const rows = [
      ...Array.from({ length: 3 }, () => obs("small-gain", true, 50, 55)),
      ...Array.from({ length: 3 }, () => obs("big-gain", true, 40, 70)),
      obs("thin-data", true, 10, 90),
    ];
    expect(computeTrainingEffectiveness(rows).map((c) => c.courseId)).toEqual(["big-gain", "small-gain", "thin-data"]);
  });

  it("is order-independent", () => {
    const rows = [obs("a", true, 40, 60), obs("b", true, 10, 20), obs("a", false, null, null), obs("b", true, 30, 35)];
    expect(computeTrainingEffectiveness(rows)).toEqual(computeTrainingEffectiveness([...rows].reverse()));
  });
});

describe("competency distribution", () => {
  it("averages assessed scores per department × domain and histograms levels", () => {
    const d = computeCompetencyDistribution([
      { departmentName: "NAD", domainName: "Statistical", score: 30 },
      { departmentName: "NAD", domainName: "Statistical", score: 50 },
      { departmentName: "NAD", domainName: "Statistical", score: null },
      { departmentName: "DIID", domainName: "Technical", score: 95 },
    ]);
    const cell = d.cells.find((c) => c.departmentName === "NAD")!;
    expect(cell.meanScore).toBe(40);
    expect(cell.coverage).toBeCloseTo(2 / 3);
    expect(d.levelHistogram.Statistical).toEqual([0, 1, 1, 0, 0]);
    expect(d.levelHistogram.Technical).toEqual([0, 0, 0, 0, 1]);
  });
});

describe("shortage forecast", () => {
  it("fits an exact line", () => {
    const { slope, intercept } = linearTrend([2, 4, 6, 8]);
    expect(slope).toBeCloseTo(2);
    expect(intercept).toBeCloseTo(2);
  });

  it("projects the trend, never below zero, and weights by future demand", () => {
    const [rising, falling] = forecastShortages(
      [
        { competencyId: "ai", competencyName: "AI/ML", domainName: "Technical", monthlyCounts: [1, 2, 3, 4], futureDemand: 0.5, emerging: true },
        { competencyId: "sas", competencyName: "SAS", domainName: "Technical", monthlyCounts: [6, 4, 2, 1], futureDemand: 0, emerging: false },
      ],
      6,
    );
    expect(rising.competencyId).toBe("ai");
    expect(rising.projected).toBeCloseTo(10); // 1 + 1×(3 + 6)
    expect(rising.pressure).toBeCloseTo(15);
    expect(falling.projected).toBe(0);
  });

  it("does not fit a trend on too little history", () => {
    const [f] = forecastShortages([{ competencyId: "x", competencyName: "X", domainName: "D", monthlyCounts: [5, 9], futureDemand: 0, emerging: false }]);
    expect(f.trendFitted).toBe(false);
    expect(f.projected).toBe(9);
  });
});
