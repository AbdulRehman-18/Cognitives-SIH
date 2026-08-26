import { describe, expect, it } from "vitest";
import {
  classifySeverity,
  computeGapAnalysis,
  computeGapSize,
  computeWeighted,
  SEVERITY_THRESHOLDS,
  CRITICAL_OVERRIDE,
  type GapInput,
} from "@/lib/engines/gap";

// Per docs/engine-specifications.md §2 "Test requirements".

function makeInput(overrides: Partial<GapInput> = {}): GapInput {
  return {
    competencyId: "c1",
    competencyName: "Survey Design",
    domainName: "Statistical",
    currentLevel: 2,
    requiredLevel: 4,
    roleWeight: 0.8,
    departmentPriority: 0.8,
    ...overrides,
  };
}

describe("gap engine — basic formula", () => {
  it("computeGapSize is max(0, required - current)", () => {
    expect(computeGapSize(2, 4)).toBe(2);
    expect(computeGapSize(4, 2)).toBe(0);
    expect(computeGapSize(3, 3)).toBe(0);
  });

  it("computeWeighted multiplies gapSize x roleWeight x departmentPriority", () => {
    expect(computeWeighted(2, 0.9, 0.9)).toBeCloseTo(1.62, 10);
    expect(computeWeighted(0, 1, 1)).toBe(0);
  });
});

describe("gap engine — severity thresholds, asserted exactly at the boundary", () => {
  it("weighted = 3.0 is CRITICAL", () => {
    const { severity } = classifySeverity(3.0, 3, 1);
    expect(severity).toBe("CRITICAL");
    expect(SEVERITY_THRESHOLDS.CRITICAL).toBe(3.0);
  });

  it("weighted = 2.999... is HIGH, not CRITICAL", () => {
    const { severity } = classifySeverity(2.999999, 1.5, 0.5);
    expect(severity).toBe("HIGH");
  });

  it("weighted = 2.0 is HIGH", () => {
    const { severity } = classifySeverity(2.0, 1, 0.5);
    expect(severity).toBe("HIGH");
    expect(SEVERITY_THRESHOLDS.HIGH).toBe(2.0);
  });

  it("weighted just below 2.0 is MEDIUM", () => {
    const { severity } = classifySeverity(1.999999, 1, 0.5);
    expect(severity).toBe("MEDIUM");
  });

  it("weighted = 1.0 is MEDIUM", () => {
    const { severity } = classifySeverity(1.0, 1, 0.4);
    expect(severity).toBe("MEDIUM");
    expect(SEVERITY_THRESHOLDS.MEDIUM).toBe(1.0);
  });

  it("weighted just below 1.0 is LOW", () => {
    const { severity } = classifySeverity(0.999999, 0.5, 0.5);
    expect(severity).toBe("LOW");
  });

  it("weighted just above 0 is LOW", () => {
    const { severity } = classifySeverity(0.0001, 0.1, 0.1);
    expect(severity).toBe("LOW");
  });
});

describe("gap engine — CRITICAL override path", () => {
  it("gapSize >= 2 AND roleWeight >= 0.9 forces CRITICAL even when weighted < 3.0", () => {
    // weighted = 2 * 0.9 * 0.5 = 0.9, well under 3.0 and even under 1.0 (MEDIUM territory).
    const { severity, criticalOverride } = classifySeverity(0.9, 2, 0.9);
    expect(severity).toBe("CRITICAL");
    expect(criticalOverride).toBe(true);
    expect(CRITICAL_OVERRIDE).toEqual({ gapSize: 2, roleWeight: 0.9 });
  });

  it("does not fire when gapSize is 1, even with roleWeight >= 0.9", () => {
    const { severity, criticalOverride } = classifySeverity(0.9, 1, 0.95);
    expect(severity).not.toBe("CRITICAL");
    expect(criticalOverride).toBe(false);
  });

  it("does not fire when roleWeight is below 0.9, even with gapSize >= 2", () => {
    const { severity, criticalOverride } = classifySeverity(0.7, 2, 0.85);
    expect(severity).not.toBe("CRITICAL");
    expect(criticalOverride).toBe(false);
  });

  it("does not double-flag when weighted alone already reached CRITICAL", () => {
    // weighted = 2 * 0.95 * 1 = 1.9 -> not >= 3.0, override fires, but check
    // the case where weighted alone crosses 3.0 the override flag stays false.
    const { severity, criticalOverride } = classifySeverity(3.5, 2, 0.95);
    expect(severity).toBe("CRITICAL");
    expect(criticalOverride).toBe(false);
  });

  it("end-to-end via computeGapAnalysis: gapSize 2, roleWeight 0.9, low departmentPriority", () => {
    const input = makeInput({
      currentLevel: 1,
      requiredLevel: 3, // gapSize = 2
      roleWeight: 0.9,
      departmentPriority: 0.3, // weighted = 2 * 0.9 * 0.3 = 0.54, MEDIUM territory by weighted alone
    });
    const { gaps } = computeGapAnalysis([input]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].severity).toBe("CRITICAL");
    expect(gaps[0].criticalOverride).toBe(true);
  });
});

describe("gap engine — currentLevel null is an unknown, never a gap", () => {
  it("produces an UNKNOWN entry, not a gap", () => {
    const input = makeInput({ currentLevel: null, requiredLevel: 5, roleWeight: 1, departmentPriority: 1 });
    const { gaps, unknown } = computeGapAnalysis([input]);
    expect(gaps).toHaveLength(0);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].status).toBe("UNKNOWN");
    expect(unknown[0].currentLevel).toBeNull();
  });

  it("never produces CRITICAL severity from missing data, even with max role weight/priority/required level", () => {
    const input = makeInput({ currentLevel: null, requiredLevel: 5, roleWeight: 1, departmentPriority: 1 });
    const { gaps } = computeGapAnalysis([input]);
    expect(gaps.find((g) => g.competencyId === input.competencyId)).toBeUndefined();
  });

  it("a zero-size gap (current already meets/exceeds required) is not included as a gap", () => {
    const input = makeInput({ currentLevel: 4, requiredLevel: 3, roleWeight: 1, departmentPriority: 1 });
    const { gaps, unknown } = computeGapAnalysis([input]);
    expect(gaps).toHaveLength(0);
    expect(unknown).toHaveLength(0);
  });
});

describe("gap engine — ordering", () => {
  it("orders by severity rank, then weighted desc, then competencyId asc", () => {
    const inputs: GapInput[] = [
      makeInput({ competencyId: "low-1", currentLevel: 4, requiredLevel: 5, roleWeight: 0.5, departmentPriority: 0.5 }), // gapSize 1, weighted 0.25 -> LOW
      makeInput({ competencyId: "crit-b", currentLevel: 0, requiredLevel: 5, roleWeight: 1, departmentPriority: 1 }), // gapSize 5, weighted 5 -> CRITICAL
      makeInput({ competencyId: "crit-a", currentLevel: 0, requiredLevel: 5, roleWeight: 1, departmentPriority: 1 }), // gapSize 5, weighted 5 -> CRITICAL, ties with crit-b
      makeInput({ competencyId: "high-1", currentLevel: 1, requiredLevel: 4, roleWeight: 0.9, departmentPriority: 0.8 }), // gapSize 3, weighted 2.16 -> HIGH
      makeInput({ competencyId: "med-1", currentLevel: 1, requiredLevel: 3, roleWeight: 0.7, departmentPriority: 0.8 }), // gapSize 2, weighted 1.12 -> MEDIUM
    ];
    const { gaps } = computeGapAnalysis(inputs);
    const ids = gaps.map((g) => g.competencyId);
    // crit-a before crit-b (tie broken by competencyId asc), both before high-1, before the LOW entries.
    expect(ids[0]).toBe("crit-a");
    expect(ids[1]).toBe("crit-b");
    expect(ids[2]).toBe("high-1");
    // Verify overall severity rank ordering is non-decreasing.
    const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    for (let i = 1; i < gaps.length; i++) {
      expect(rank[gaps[i].severity]).toBeGreaterThanOrEqual(rank[gaps[i - 1].severity]);
    }
  });

  it("identical inputs in different array orders produce identical output ordering", () => {
    const inputs: GapInput[] = [
      makeInput({ competencyId: "b", currentLevel: 1, requiredLevel: 4, roleWeight: 0.7, departmentPriority: 0.6 }),
      makeInput({ competencyId: "a", currentLevel: 2, requiredLevel: 3, roleWeight: 0.6, departmentPriority: 0.5 }),
      makeInput({ competencyId: "d", currentLevel: 0, requiredLevel: 5, roleWeight: 1, departmentPriority: 1 }),
      makeInput({ competencyId: "c", currentLevel: 3, requiredLevel: 5, roleWeight: 0.5, departmentPriority: 0.4 }),
      makeInput({ competencyId: "e", currentLevel: null }),
    ];
    const shuffled = [inputs[4], inputs[1], inputs[3], inputs[0], inputs[2]];

    const resultA = computeGapAnalysis(inputs);
    const resultB = computeGapAnalysis(shuffled);

    expect(resultA.gaps.map((g) => g.competencyId)).toEqual(resultB.gaps.map((g) => g.competencyId));
    expect(resultA.unknown.map((u) => u.competencyId)).toEqual(resultB.unknown.map((u) => u.competencyId));
  });

  it("ties on identical weighted values are broken by competencyId ascending", () => {
    const inputs: GapInput[] = [
      makeInput({ competencyId: "zz", currentLevel: 2, requiredLevel: 4, roleWeight: 0.5, departmentPriority: 0.5 }), // weighted 0.5
      makeInput({ competencyId: "aa", currentLevel: 2, requiredLevel: 4, roleWeight: 0.5, departmentPriority: 0.5 }), // weighted 0.5, same severity
    ];
    const { gaps } = computeGapAnalysis(inputs);
    expect(gaps.map((g) => g.competencyId)).toEqual(["aa", "zz"]);
  });
});

describe("gap engine — determinism", () => {
  it("same input x 100 runs => byte-identical output", () => {
    const inputs: GapInput[] = [
      makeInput({ competencyId: "c1", currentLevel: 1, requiredLevel: 4, roleWeight: 0.9, departmentPriority: 0.8 }),
      makeInput({ competencyId: "c2", currentLevel: null }),
      makeInput({ competencyId: "c3", currentLevel: 3, requiredLevel: 3, roleWeight: 0.6, departmentPriority: 0.6 }),
      makeInput({ competencyId: "c4", currentLevel: 2, requiredLevel: 5, roleWeight: 0.4, departmentPriority: 0.3 }),
    ];
    const results = Array.from({ length: 100 }, () => computeGapAnalysis(inputs));
    const serialized = results.map((r) => JSON.stringify(r));
    const first = serialized[0];
    for (const s of serialized) {
      expect(s).toBe(first);
    }
  });
});
