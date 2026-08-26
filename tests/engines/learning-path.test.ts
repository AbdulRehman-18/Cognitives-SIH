import { describe, expect, it } from "vitest";
import {
  buildLearningPath,
  DEFAULT_MAX_WEEKLY_HOURS,
  topologicalOrder,
  type LearningPathEdge,
  type LearningPathItemInput,
} from "@/lib/engines/learning-path";

// Per docs/engine-specifications.md §4 + the phase definition of done:
// prerequisite ordering invariant, cycle ⇒ throw (never truncate),
// deterministic tie-breaking, week bin-packing, 100-run determinism.

function item(itemId: string, competencyId: string, overrides: Partial<LearningPathItemInput> = {}): LearningPathItemInput {
  return { itemId, competencyId, priorityRank: 0, hours: 3, ...overrides };
}

describe("learning path engine — topological order", () => {
  const edges: LearningPathEdge[] = [
    // dv requires python; ml requires dv — chain python → dv → ml
    { competencyId: "dv", prerequisiteId: "python" },
    { competencyId: "ml", prerequisiteId: "dv" },
    // sql is independent
  ];

  it("no item appears before any of its prerequisites", () => {
    const items = [item("i-ml", "ml"), item("i-dv", "dv"), item("i-py", "python"), item("i-sql", "sql")];
    const ordered = topologicalOrder(items, edges);
    const position = new Map(ordered.map((o, i) => [o.competencyId, i]));
    expect(position.get("python")!).toBeLessThan(position.get("dv")!);
    expect(position.get("dv")!).toBeLessThan(position.get("ml")!);
  });

  it("edges referencing absent competencies are ignored, not fatal", () => {
    const items = [item("i-py", "python"), item("i-sql", "sql")];
    // ml/dv not scheduled — their edges must not block or corrupt the output.
    const ordered = topologicalOrder(items, edges);
    expect(ordered).toHaveLength(2);
  });

  it("equal priority breaks ties deterministically by competency id", () => {
    const items = [item("i-b", "bbb"), item("i-a", "aaa")];
    const forward = topologicalOrder(items, []);
    const reversed = topologicalOrder([...items].reverse(), []);
    expect(forward.map((o) => o.competencyId)).toEqual(["aaa", "bbb"]);
    expect(reversed.map((o) => o.competencyId)).toEqual(["aaa", "bbb"]);
  });

  it("priorityRank outranks alphabetical order among simultaneously-ready nodes", () => {
    const items = [
      item("i-low", "alpha", { priorityRank: 2 }),
      item("i-high", "zeta", { priorityRank: 0 }),
    ];
    const ordered = topologicalOrder(items, []);
    expect(ordered.map((o) => o.competencyId)).toEqual(["zeta", "alpha"]);
  });

  it("duplicate competencies throw — one course per gap per path", () => {
    expect(() =>
      topologicalOrder([item("a", "x"), item("b", "x")], []),
    ).toThrow(/Duplicate competency/);
  });
});

describe("learning path engine — cycle detection", () => {
  it("a cyclic graph THROWS with the offending competency ids — never truncates", () => {
    const cycleEdges: LearningPathEdge[] = [
      { competencyId: "a", prerequisiteId: "c" },
      { competencyId: "b", prerequisiteId: "a" },
      { competencyId: "c", prerequisiteId: "b" },
    ];
    const items = [item("1", "a"), item("2", "b"), item("3", "c")];
    expect(() => buildLearningPath(items, cycleEdges)).toThrow(/Cycle detected[\s\S]*a, b, c/);
  });

  it("a self-loop throws", () => {
    expect(() =>
      buildLearningPath([item("1", "a")], [{ competencyId: "a", prerequisiteId: "a" }]),
    ).toThrow(/Cycle detected/);
  });

  it("a cycle in part of the graph does not silently drop just the cyclic subset — it fails loudly", () => {
    // Independent node "ok" plus a 2-cycle. Output must NOT contain "ok" with
    // the cycle swallowed — the whole call throws.
    const items = [item("1", "ok"), item("2", "p"), item("3", "q")];
    const edges: LearningPathEdge[] = [
      { competencyId: "p", prerequisiteId: "q" },
      { competencyId: "q", prerequisiteId: "p" },
    ];
    expect(() => buildLearningPath(items, edges)).toThrow(/p, q/);
  });
});

describe("learning path engine — week bin-packing", () => {
  it("packs greedily at maxWeeklyHours=5 and starts a fresh week on overflow", () => {
    // 3h + 3h = 6h > 5 → second item starts week 2.
    const result = buildLearningPath(
      [item("1", "a", { hours: 3 }), item("2", "b", { hours: 3 })],
      [],
    );
    expect(result.map((r) => r.weekNumber)).toEqual([1, 2]);
    expect(result.map((r) => r.order)).toEqual([0, 1]);
  });

  it("items fitting within a week share that week", () => {
    const result = buildLearningPath(
      [item("1", "a", { hours: 2 }), item("2", "b", { hours: 3 })],
      [],
    );
    expect(result.map((r) => r.weekNumber)).toEqual([1, 1]);
  });

  it("a long course spans multiple weeks starting on a fresh week", () => {
    // 30-hour NSSTA programme at 5h/week → weeks 1..6; next item starts week 7.
    const result = buildLearningPath(
      [item("1", "big", { hours: 30 }), item("2", "small", { hours: 2 })],
      [],
    );
    expect(result[0].weekNumber).toBe(1);
    expect(result[1].weekNumber).toBe(7);
  });

  it("respects an explicit maxWeeklyHours override", () => {
    const result = buildLearningPath(
      [item("1", "a", { hours: 4 }), item("2", "b", { hours: 4 })],
      [],
      { maxWeeklyHours: 8 },
    );
    expect(result.map((r) => r.weekNumber)).toEqual([1, 1]);
  });

  it("rejects non-positive maxWeeklyHours", () => {
    expect(() => buildLearningPath([item("1", "a")], [], { maxWeeklyHours: 0 })).toThrow(
      /maxWeeklyHours/,
    );
  });

  it("default maxWeeklyHours is 5 (the demo officer's study budget)", () => {
    expect(DEFAULT_MAX_WEEKLY_HOURS).toBe(5);
  });
});

describe("learning path engine — determinism + end-to-end shape", () => {
  it("is deterministic over 100 identical runs (byte-identical JSON)", () => {
    const items = [
      item("r1", "ml", { priorityRank: 0, hours: 6 }),
      item("r2", "dv", { priorityRank: 0, hours: 4 }),
      item("r3", "python", { priorityRank: 1, hours: 3 }),
      item("r4", "comm", { priorityRank: 2, hours: 2 }),
    ];
    const edges: LearningPathEdge[] = [
      { competencyId: "ml", prerequisiteId: "dv" },
      { competencyId: "dv", prerequisiteId: "python" },
    ];
    const run = () => JSON.stringify(buildLearningPath(items, edges));
    const first = run();
    for (let i = 0; i < 100; i++) {
      expect(run()).toBe(first);
    }
  });

  it("end-to-end: prereq ordering survives week packing (orders are 0-based and dense)", () => {
    const result = buildLearningPath(
      [
        item("late", "dependent", { hours: 3 }),
        item("early", "foundation", { priorityRank: 1, hours: 10 }),
      ],
      [{ competencyId: "dependent", prerequisiteId: "foundation" }],
    );
    const byId = new Map(result.map((r) => [r.itemId, r]));
    expect(byId.get("early")!.order).toBe(0);
    expect(byId.get("late")!.order).toBe(1);
    expect(byId.get("late")!.weekNumber).toBeGreaterThanOrEqual(byId.get("early")!.weekNumber);
  });

  it("empty input yields an empty path", () => {
    expect(buildLearningPath([], [])).toEqual([]);
  });
});
