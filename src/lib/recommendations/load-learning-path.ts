import "server-only";

import { db } from "@/lib/db/client";
import {
  buildLearningPath,
  DEFAULT_MAX_WEEKLY_HOURS,
  type LearningPathEdge,
} from "@/lib/engines/learning-path";

// Learning Path orchestration — src/lib/recommendations/load-learning-path.ts
//
// Picks each gap's top-ranked persisted Recommendation, orders them through
// the pure Learning Path Engine (Kahn's + week bin-packing), and persists a
// fresh LearningPath. Deliberately NOT under src/lib/engines/: DB access
// lives here; all ordering/scheduling decisions live in the engine.

export interface PathItemView {
  recommendationId: string;
  gapId: string;
  courseId: string;
  courseTitle: string;
  courseDescription: string | null;
  /** Course difficulty, 1–5. */
  courseLevel: number;
  source: "IGOT" | "NSSTA";
  externalUrl: string | null;
  competencyId: string;
  competencyName: string;
  severity: string;
  currentLevel: number;
  requiredLevel: number;
  /** Names of this item's prerequisite competencies that are also on the path. */
  after: string[];
  hours: number;
  order: number;
  weekNumber: number;
  rationale: string;
}

export interface PathWeekView {
  weekNumber: number;
  hours: number;
  items: PathItemView[];
}

export interface LearningPathData {
  weeks: PathWeekView[];
  maxWeeklyHours: number;
}

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Builds (and re-persists) the learner's learning path. Returns null when
 * there are no recommendations to schedule yet. A cyclic prerequisite graph
 * propagates the engine's throw — never silently truncated.
 */
export async function loadLearningPath(
  userId: string,
  maxWeeklyHours: number = DEFAULT_MAX_WEEKLY_HOURS,
): Promise<LearningPathData | null> {
  // One top recommendation per gap — the engine schedules competencies, so
  // duplicates per competency would corrupt the topological sort.
  const recommendations = await db.recommendation.findMany({
    where: { userId },
    include: {
      gap: { include: { competency: { select: { name: true } } } },
      course: { select: { id: true, title: true, description: true, level: true, source: true, externalUrl: true, durationHours: true } },
    },
    orderBy: [{ score: "desc" }, { id: "asc" }],
  });

  if (recommendations.length === 0) return null;

  const seenGaps = new Set<string>();
  const selected = recommendations.filter((r) => {
    if (seenGaps.has(r.gapId)) return false;
    seenGaps.add(r.gapId);
    return true;
  });

  const edges = await db.competencyPrerequisite.findMany({
    select: { competencyId: true, prerequisiteId: true },
  });
  const prerequisiteEdges: LearningPathEdge[] = edges.map((e) => ({
    competencyId: e.competencyId,
    prerequisiteId: e.prerequisiteId,
  }));

  const scheduled = buildLearningPath(
    selected.map((r) => ({
      itemId: r.id,
      competencyId: r.gap.competencyId,
      priorityRank: SEVERITY_RANK[r.gap.severity] ?? 9,
      hours: Number(r.course.durationHours),
    })),
    prerequisiteEdges,
    { maxWeeklyHours },
  );

  const byItemId = new Map(scheduled.map((s) => [s.itemId, s]));
  const nameByCompetency = new Map(selected.map((r) => [r.gap.competencyId, r.gap.competency.name]));

  const itemViews: PathItemView[] = selected.map((r) => {
    const slot = byItemId.get(r.id)!;
    return {
      recommendationId: r.id,
      gapId: r.gapId,
      courseId: r.course.id,
      courseTitle: r.course.title,
      courseDescription: r.course.description,
      courseLevel: r.course.level,
      source: r.course.source,
      externalUrl: r.course.externalUrl,
      competencyId: r.gap.competencyId,
      competencyName: r.gap.competency.name,
      severity: r.gap.severity,
      currentLevel: r.gap.currentLevel,
      requiredLevel: r.gap.requiredLevel,
      after: prerequisiteEdges
        .filter((e) => e.competencyId === r.gap.competencyId && nameByCompetency.has(e.prerequisiteId))
        .map((e) => nameByCompetency.get(e.prerequisiteId)!),
      hours: Number(r.course.durationHours),
      order: slot.order,
      weekNumber: slot.weekNumber,
      rationale:
        `Closes a ${r.gap.severity.toLowerCase()} ${r.gap.competency.name} gap ` +
        `(level ${r.gap.currentLevel} → ${r.gap.requiredLevel}); scheduled after its prerequisites.`,
    };
  });
  itemViews.sort((a, b) => a.order - b.order);

  await persistPath(userId, itemViews);

  const weeks = groupByWeek(itemViews);
  return { weeks, maxWeeklyHours };
}

async function persistPath(userId: string, items: PathItemView[]): Promise<void> {
  await db.learningPath.deleteMany({ where: { userId } });
  if (items.length === 0) return;
  const path = await db.learningPath.create({ data: { userId } });
  await db.learningPathItem.createMany({
    data: items.map((item) => ({
      learningPathId: path.id,
      gapId: item.gapId,
      courseId: item.courseId,
      order: item.order,
      weekNumber: item.weekNumber,
      rationale: item.rationale,
    })),
  });
}

function groupByWeek(items: PathItemView[]): PathWeekView[] {
  const map = new Map<number, PathItemView[]>();
  for (const item of items) {
    const list = map.get(item.weekNumber) ?? [];
    list.push(item);
    map.set(item.weekNumber, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, weekItems]) => ({
      weekNumber,
      hours: weekItems.reduce((sum, i) => sum + i.hours, 0),
      items: weekItems,
    }));
}
