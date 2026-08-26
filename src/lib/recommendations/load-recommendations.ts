import "server-only";

import type { GapSeverity } from "@prisma/client";
import { db } from "@/lib/db/client";
import {
  recommendCoursesForGap,
  type LearnerLevelMap,
  type PrerequisiteEdge,
  type RankedRecommendation,
  type RecommendationFactors,
} from "@/lib/engines/recommendation";
import { courseSimilarities } from "@/lib/rag/retrieve";

// Recommendation orchestration — src/lib/recommendations/load-recommendations.ts
//
// The bridge between the DB/RAG layers and the pure Recommendation Engine
// (mirrors src/lib/gap-reasoning/load-gap-analysis.ts). Deliberately NOT
// under src/lib/engines/: it queries the database and embeds gap text via
// the RAG layer. All NUMBERS still come from the pure engine — this module
// only fetches inputs, passes them in, and persists the engine's output
// verbatim into Recommendation.score / Recommendation.reasonsJson.

const RECOMMENDATIONS_PER_GAP = 3;

export interface RecommendationView {
  courseId: string;
  title: string;
  source: "IGOT" | "NSSTA";
  externalUrl: string | null;
  level: number;
  durationHours: number;
  description: string | null;
  score: number;
  /** Real per-factor breakdown from the engine — rendered by ReasonBreakdown, never paraphrased. */
  factors: RecommendationFactors & { isClosestMatch?: boolean };
  isClosestMatch: boolean;
}

export interface RecommendationGapGroup {
  gapId: string;
  competencyId: string;
  competencyName: string;
  domainName: string;
  severity: GapSeverity;
  currentLevel: number;
  requiredLevel: number;
  reason: string | null;
  recommendations: RecommendationView[];
}

export interface RecommendationsData {
  gaps: RecommendationGapGroup[];
  /** Catalog stats for honest empty states ("N of M courses embedded"). */
  courseCount: number;
  embeddedCourseCount: number;
}

export async function loadRecommendations(userId: string): Promise<RecommendationsData | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { roleId: true, departmentId: true },
  });
  if (!user?.roleId) return null;

  const [gaps, roleTargets, courses, edges, learnerCompetencies, departmentPriorities, courseCount, embeddedCourseCount] =
    await Promise.all([
      db.skillGap.findMany({
        where: { userId },
        include: { competency: { select: { name: true, description: true, domain: { select: { name: true } } } } },
        orderBy: [{ severity: "asc" }, { priorityScore: "desc" }],
      }),
      db.roleCompetency.findMany({
        where: { roleId: user.roleId },
        select: { competencyId: true },
      }),
      db.course.findMany({
        select: {
          id: true,
          source: true,
          title: true,
          description: true,
          competencies: true,
          level: true,
          durationHours: true,
          externalUrl: true,
        },
      }),
      db.competencyPrerequisite.findMany({
        select: { competencyId: true, prerequisiteId: true },
      }),
      db.userCompetency.findMany({
        where: { userId },
        select: { competencyId: true, currentScore: true },
      }),
      user.departmentId
        ? db.departmentPriority.findMany({
            where: { departmentId: user.departmentId },
            select: { competencyId: true, priority: true },
          })
        : Promise.resolve([]),
      db.course.count(),
      db.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "Course" WHERE embedding IS NOT NULL
      `.then((rows) => rows[0]?.count ?? 0),
    ]);

  if (gaps.length === 0) {
    return { gaps: [], courseCount, embeddedCourseCount };
  }

  const prerequisiteEdges: PrerequisiteEdge[] = edges.map((e) => ({
    competencyId: e.competencyId,
    prerequisiteId: e.prerequisiteId,
  }));
  const learnerLevels: LearnerLevelMap = Object.fromEntries(
    learnerCompetencies.map((uc) => [
      uc.competencyId,
      uc.currentScore != null ? Math.max(1, Math.min(5, Math.ceil(Number(uc.currentScore) / 20))) : null,
    ]),
  );
  const roleTargetIds = roleTargets.map((rt) => rt.competencyId);
  const priorityByCompetencyId = new Map(departmentPriorities.map((dp) => [dp.competencyId, Number(dp.priority)]));

  // Preserve any ACCEPTED/DISMISSED/COMPLETED status across recomputation —
  // a learner's decisions must not be wiped because scores moved.
  const existing = await db.recommendation.findMany({
    where: { userId },
    select: { gapId: true, courseId: true, status: true },
  });
  const existingStatus = new Map(existing.map((r) => [`${r.gapId}:${r.courseId}`, r.status]));

  const gapGroups: RecommendationGapGroup[] = [];

  for (const gap of gaps) {
    const competency = gap.competency;
    const queryText = `${competency.name}. ${competency.description ?? ""} training course`.trim();
    let similarities = new Map<string, number>();
    try {
      similarities = await courseSimilarities(queryText);
    } catch {
      // Embedding failure (missing GEMINI_API_KEY, network): fall through
      // with zero similarity so rule-based factors still rank courses.
      // This keeps the page functional without fabricating semantic values —
      // the breakdown will show semanticSimilarity: 0 honestly.
      similarities = new Map();
    }

    const ranked: RankedRecommendation[] = recommendCoursesForGap({
      context: {
        severity: gap.severity,
        currentLevel: gap.currentLevel,
        roleTargetCompetencyIds: roleTargetIds,
        departmentPriority: priorityByCompetencyId.get(gap.competencyId) ?? 0,
      },
      candidates: courses.map((course) => ({
        courseId: course.id,
        competencyIds: course.competencies,
        level: course.level,
        semanticSimilarity: similarities.get(course.id) ?? 0,
      })),
      prerequisiteEdges,
      learnerLevels,
    });

    const top = ranked.slice(0, RECOMMENDATIONS_PER_GAP);

    gapGroups.push({
      gapId: gap.id,
      competencyId: gap.competencyId,
      competencyName: competency.name,
      domainName: competency.domain.name,
      severity: gap.severity,
      currentLevel: gap.currentLevel,
      requiredLevel: gap.requiredLevel,
      reason: gap.reason,
      recommendations: top.map((r) => {
        const course = courses.find((c) => c.id === r.courseId)!;
        return {
          courseId: r.courseId,
          title: course.title,
          source: course.source,
          externalUrl: course.externalUrl,
          level: course.level,
          durationHours: Number(course.durationHours),
          description: course.description,
          score: r.score,
          factors: { ...r.factors, isClosestMatch: r.isClosestMatch },
          isClosestMatch: r.isClosestMatch,
        };
      }),
    });

    // Persist exactly what was computed — every term into reasonsJson.
    await db.recommendation.deleteMany({ where: { userId, gapId: gap.id } });
    if (top.length > 0) {
      await db.recommendation.createMany({
        data: top.map((r) => ({
          userId,
          courseId: r.courseId,
          gapId: gap.id,
          score: r.score,
          reasonsJson: { ...r.factors, isClosestMatch: r.isClosestMatch },
          status: existingStatus.get(`${gap.id}:${r.courseId}`) ?? "SUGGESTED",
        })),
      });
    }
  }

  return { gaps: gapGroups, courseCount, embeddedCourseCount };
}
