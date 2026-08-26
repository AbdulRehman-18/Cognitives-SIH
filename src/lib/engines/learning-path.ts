// Learning Path Engine — src/lib/engines/learning-path.ts
//
// Normative reference: docs/engine-specifications.md §4. This file is pure:
// structured input in, an ordered/week-scheduled path out. No `import` from
// src/lib/ai/, no DB access, no Date.now() in the math.
//
// Two stages, both deterministic:
// 1. Kahn's topological sort over the prerequisite DAG, ties broken by the
//    caller-supplied gap priority (severity first), then stable id tiebreaks.
// 2. Greedy bin-packing of course hours into weeks at `maxWeeklyHours`
//    (default 5) → a 6–8 week ordered sequence for the demo officer.
//
// CYCLE DETECTION IS MANDATORY and throws with the offending competency ids
// (engine-specifications §4). A silently truncated learning path is a wrong
// answer that looks like a right one.

export interface LearningPathEdge {
  /** The competency that requires `prerequisiteId` first. */
  competencyId: string;
  prerequisiteId: string;
}

export interface LearningPathItemInput {
  /** Opaque caller id (e.g. `${gapId}:${courseId}`) echoed back on output. */
  itemId: string;
  competencyId: string;
  /**
   * Caller-computed priority — lower schedules earlier. The convention used
   * by callers: severity rank (CRITICAL=0 … LOW=3) as the primary key, so a
   * CRITICAL gap's course never queues behind a LOW one at equal topological
   * depth.
   */
  priorityRank: number;
  /** Course duration in hours (Course.durationHours). Drives week packing. */
  hours: number;
}

export interface ScheduledPathItem {
  itemId: string;
  competencyId: string;
  /** 0-based position in the final ordering — no item precedes its prerequisites. */
  order: number;
  /** 1-based week this item STARTS in; long courses span multiple weeks. */
  weekNumber: number;
}

export const DEFAULT_MAX_WEEKLY_HOURS = 5;

/**
 * Stage 1 — Kahn's algorithm with deterministic tie-breaking.
 *
 * Edges referencing competencies not present in `items` are ignored (a gap
 * set won't contain every prerequisite in the taxonomy; prerequisites outside
 * the set can't be scheduled here and are treated as out of scope).
 *
 * Throws when Kahn's terminates with nodes remaining, listing them — that is
 * a cycle in the prerequisite graph, and per §4 we fail loudly rather than
 * emit a truncated path.
 */
export function topologicalOrder(
  items: LearningPathItemInput[],
  edges: LearningPathEdge[],
): { itemId: string; competencyId: string; hours: number }[] {
  const byCompetency = new Map<string, LearningPathItemInput>();
  for (const item of items) {
    if (byCompetency.has(item.competencyId)) {
      throw new Error(
        `Duplicate competency in learning path input: ${item.competencyId} (items ${byCompetency.get(item.competencyId)!.itemId} and ${item.itemId}).`,
      );
    }
    byCompetency.set(item.competencyId, item);
  }

  // Adjacency prerequisite → dependents, and indegree per node — restricted
  // to nodes actually present in the input set.
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const item of items) {
    indegree.set(item.competencyId, 0);
    dependents.set(item.competencyId, []);
  }
  for (const edge of edges) {
    if (!indegree.has(edge.prerequisiteId) || !indegree.has(edge.competencyId)) continue;
    dependents.get(edge.prerequisiteId)!.push(edge.competencyId);
    indegree.set(edge.competencyId, indegree.get(edge.competencyId)! + 1);
  }

  // Ready set ordered deterministically: priorityRank asc, then competencyId,
  // then itemId — identical inputs always yield identical output order.
  const pickNext = (ready: Set<string>): string | null => {
    let best: string | null = null;
    for (const id of ready) {
      if (best === null) {
        best = id;
        continue;
      }
      const a = byCompetency.get(id)!;
      const b = byCompetency.get(best)!;
      if (
        a.priorityRank < b.priorityRank ||
        (a.priorityRank === b.priorityRank &&
          (id < best || (id === best && a.itemId < b.itemId)))
      ) {
        best = id;
      }
    }
    return best;
  };

  const ready = new Set<string>();
  for (const [id, degree] of indegree) {
    if (degree === 0) ready.add(id);
  }

  const ordered: { itemId: string; competencyId: string; hours: number }[] = [];
  while (ready.size > 0) {
    const next = pickNext(ready);
    if (next === null) break;
    ready.delete(next);
    const item = byCompetency.get(next)!;
    ordered.push({ itemId: item.itemId, competencyId: next, hours: item.hours });
    for (const dependent of dependents.get(next)!) {
      const remaining = indegree.get(dependent)! - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) ready.add(dependent);
    }
  }

  if (ordered.length !== items.length) {
    const processed = new Set(ordered.map((o) => o.competencyId));
    const stuck = items
      .filter((i) => !processed.has(i.competencyId))
      .map((i) => i.competencyId)
      .sort();
    throw new Error(
      `Cycle detected in prerequisite graph — cannot build learning path. Unresolvable competencies: ${stuck.join(", ")}`,
    );
  }

  return ordered;
}

/**
 * Stage 2 — greedy bin-packing into weeks. Items are consumed in the given
 * order; each consumes `hours` from the current week, spilling into
 * subsequent weeks when it exceeds the remaining capacity. An item records
 * the week it STARTS in. A course longer than `maxWeeklyHours` simply spans
 * multiple weeks starting on a fresh one.
 */
function packIntoWeeks(
  ordered: { itemId: string; competencyId: string; hours: number }[],
  maxWeeklyHours: number,
): ScheduledPathItem[] {
  const scheduled: ScheduledPathItem[] = [];
  let week = 1;
  let remainingThisWeek = maxWeeklyHours;

  for (const entry of ordered) {
    let hours = entry.hours;
    // If this item doesn't fit in what's left of the current week, start a
    // fresh week — but only if the current week already has content.
    if (remainingThisWeek < maxWeeklyHours && hours > remainingThisWeek) {
      week += 1;
      remainingThisWeek = maxWeeklyHours;
    }
    scheduled.push({
      itemId: entry.itemId,
      competencyId: entry.competencyId,
      order: scheduled.length,
      weekNumber: week,
    });
    while (hours > 0) {
      if (hours <= remainingThisWeek) {
        remainingThisWeek -= hours;
        hours = 0;
      } else {
        hours -= remainingThisWeek;
        week += 1;
        remainingThisWeek = maxWeeklyHours;
      }
    }
  }

  return scheduled;
}

/**
 * The Learning Path Engine's single entry point. Pure function: same input
 * always produces byte-identical output (asserted over 100 runs in
 * tests/engines/learning-path.test.ts).
 *
 * Invariant guaranteed by construction and asserted in tests: no item appears
 * before any of its prerequisites. A cyclic graph THROWS — it never silently
 * truncates.
 */
export function buildLearningPath(
  items: LearningPathItemInput[],
  edges: LearningPathEdge[],
  options?: { maxWeeklyHours?: number },
): ScheduledPathItem[] {
  const maxWeeklyHours = options?.maxWeeklyHours ?? DEFAULT_MAX_WEEKLY_HOURS;
  if (maxWeeklyHours <= 0) {
    throw new Error(`maxWeeklyHours must be positive, got ${maxWeeklyHours}.`);
  }
  const ordered = topologicalOrder(items, edges);
  return packIntoWeeks(ordered, maxWeeklyHours);
}
