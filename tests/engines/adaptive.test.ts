import { describe, expect, it } from "vitest";
import { maxAdaptiveItems, selectNextItem, type PoolItem } from "@/lib/engines/adaptive";

const pool: PoolItem[] = [
  { id: "s1", competencyId: "sampling", difficulty: 0.2 },
  { id: "s2", competencyId: "sampling", difficulty: 0.45 },
  { id: "s3", competencyId: "sampling", difficulty: 0.7 },
  { id: "s4", competencyId: "sampling", difficulty: 0.9 },
  { id: "p1", competencyId: "python", difficulty: 0.3 },
  { id: "p2", competencyId: "python", difficulty: 0.55 },
  { id: "p3", competencyId: "python", difficulty: 0.8 },
];

describe("adaptive item selection", () => {
  it("starts each competency nearest medium difficulty", () => {
    expect(selectNextItem(pool, []).nextId).toBe("s2");
    expect(selectNextItem(pool, [{ questionId: "s2", correct: true }]).nextId).toBe("p2");
  });

  it("steps up after a correct answer and down after a wrong one", () => {
    const afterRight = selectNextItem(pool, [
      { questionId: "s2", correct: true },
      { questionId: "p2", correct: false },
    ]);
    expect(afterRight.nextId).toBe("s3");
    const afterWrong = selectNextItem(pool, [
      { questionId: "s2", correct: true },
      { questionId: "p2", correct: false },
      { questionId: "s3", correct: true },
    ]);
    expect(afterWrong.nextId).toBe("p1");
  });

  it("stops after the per-competency cap and reports the bound", () => {
    expect(maxAdaptiveItems(pool)).toBe(6);
    const done = selectNextItem(pool, ["s2", "p2", "s3", "p1", "s4", "p3"].map((questionId) => ({ questionId, correct: true })));
    expect(done.nextId).toBeNull();
  });

  it("is deterministic and independent of item order within a competency", () => {
    const responses = [{ questionId: "s2", correct: false }, { questionId: "p2", correct: true }];
    const shuffled = [pool[3], pool[0], pool[2], pool[1], pool[6], pool[4], pool[5]];
    const first = selectNextItem(pool, responses);
    expect(selectNextItem(pool, responses)).toEqual(first);
    expect(selectNextItem(shuffled, responses)).toEqual(first);
    expect(first.nextId).toBe("s1");
  });
});
