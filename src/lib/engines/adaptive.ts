// Adaptive Item Selection Engine — src/lib/engines/adaptive.ts
//
// A deterministic up/down staircase for diagnostics. Each competency starts
// at the item closest to medium difficulty; after a correct answer the next
// item for that competency is the easiest one HARDER than the last, after a
// wrong answer the hardest one EASIER than the last. Competencies are served
// round-robin (fewest answered first) until each has ITEMS_PER_COMPETENCY
// responses or its pool is exhausted. No LLM, no randomness: the same pool
// and responses always yield the same next item.

export const ITEMS_PER_COMPETENCY = 3;
const START_DIFFICULTY = 0.5;

export interface PoolItem {
  id: string;
  competencyId: string;
  /** 0..1 */
  difficulty: number;
}

export interface ItemResponse {
  questionId: string;
  correct: boolean;
}

export interface NextItemResult {
  nextId: string | null;
  /** Upper bound on items this learner will see (for progress display). */
  maxItems: number;
}

const byDifficultyThenId = (a: PoolItem, b: PoolItem) => a.difficulty - b.difficulty || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function maxAdaptiveItems(pool: PoolItem[], perCompetency = ITEMS_PER_COMPETENCY): number {
  const counts = new Map<string, number>();
  for (const item of pool) counts.set(item.competencyId, (counts.get(item.competencyId) ?? 0) + 1);
  return [...counts.values()].reduce((sum, n) => sum + Math.min(n, perCompetency), 0);
}

export function selectNextItem(pool: PoolItem[], responses: ItemResponse[], perCompetency = ITEMS_PER_COMPETENCY): NextItemResult {
  const maxItems = maxAdaptiveItems(pool, perCompetency);
  const itemById = new Map(pool.map((i) => [i.id, i]));
  const answered = new Set(responses.map((r) => r.questionId));

  // Competencies in first-appearance order, for a stable round-robin.
  const competencies = [...new Set(pool.map((i) => i.competencyId))];
  const answeredCount = (c: string) => responses.filter((r) => itemById.get(r.questionId)?.competencyId === c).length;

  const open = competencies
    .map((c, order) => ({ c, order, n: answeredCount(c), remaining: pool.filter((i) => i.competencyId === c && !answered.has(i.id)) }))
    .filter((x) => x.n < perCompetency && x.remaining.length > 0)
    .sort((a, b) => a.n - b.n || a.order - b.order);
  if (open.length === 0) return { nextId: null, maxItems };

  const { c, remaining } = open[0];
  const sorted = [...remaining].sort(byDifficultyThenId);
  const last = [...responses].reverse().find((r) => itemById.get(r.questionId)?.competencyId === c);

  if (!last) {
    const start = sorted.reduce((best, item) =>
      Math.abs(item.difficulty - START_DIFFICULTY) < Math.abs(best.difficulty - START_DIFFICULTY) ? item : best,
    );
    return { nextId: start.id, maxItems };
  }

  const lastDifficulty = itemById.get(last.questionId)!.difficulty;
  const next = last.correct
    ? (sorted.find((i) => i.difficulty > lastDifficulty) ?? sorted[sorted.length - 1])
    : ([...sorted].reverse().find((i) => i.difficulty < lastDifficulty) ?? sorted[0]);
  return { nextId: next.id, maxItems };
}
