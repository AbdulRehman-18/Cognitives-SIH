import "server-only";

import { db } from "@/lib/db/client";
import {
  computeCompetencyDistribution,
  computeTrainingEffectiveness,
  forecastShortages,
  type CompetencyDistribution,
  type CourseEffectiveness,
  type EnrolmentObservation,
  type ScoreObservation,
  type ShortageForecast,
  type ShortageSeries,
} from "@/lib/engines/analytics";

// Admin analytics orchestration — gathers rows and hands them to the pure
// Workforce Analytics Engine (src/lib/engines/analytics.ts). No number is
// computed here beyond grouping/bucketing the raw inputs.

/** Competencies flagged as emerging-technology skills in the problem statement. */
export const EMERGING_COMPETENCIES = new Set([
  "AI/ML",
  "Cloud Computing",
  "Cybersecurity",
  "Data Privacy",
  "GIS",
  "APIs",
  "Open Data",
  "Government Cloud",
  "Digital Public Infrastructure",
]);

const FORECAST_LOOKBACK_MONTHS = 6;

export async function loadTrainingEffectiveness(): Promise<CourseEffectiveness[]> {
  const progress = await db.learningProgress.findMany({
    where: { courseId: { not: null } },
    select: {
      userId: true,
      status: true,
      baselineJson: true,
      course: { select: { id: true, title: true, source: true, durationHours: true, competencies: true } },
    },
  });
  const userIds = [...new Set(progress.map((p) => p.userId))];
  const scores = await db.userCompetency.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, competencyId: true, currentScore: true },
  });
  const scoreKey = (u: string, c: string) => `${u}:${c}`;
  const scoreBy = new Map(scores.map((s) => [scoreKey(s.userId, s.competencyId), s.currentScore === null ? null : Number(s.currentScore)]));

  const observations: EnrolmentObservation[] = progress
    .filter((p) => p.course)
    .map((p) => {
      const course = p.course!;
      return {
        courseId: course.id,
        courseTitle: course.title,
        source: course.source,
        hours: Number(course.durationHours),
        completed: p.status === "COMPLETED",
        baseline: (p.baselineJson as Record<string, number | null> | null) ?? null,
        current: Object.fromEntries(course.competencies.map((c) => [c, scoreBy.get(scoreKey(p.userId, c)) ?? null])),
      };
    });
  return computeTrainingEffectiveness(observations);
}

/** Each learner × each competency their role requires → score (null = not assessed). */
export async function loadCompetencyDistribution(): Promise<CompetencyDistribution> {
  const learners = await db.user.findMany({
    where: { role: "LEARNER", roleId: { not: null } },
    select: {
      id: true,
      department: { select: { name: true } },
      jobRole: { select: { roleCompetencies: { select: { competencyId: true, competency: { select: { domain: { select: { name: true } } } } } } } },
      userCompetencies: { select: { competencyId: true, currentScore: true } },
    },
  });
  const observations: ScoreObservation[] = [];
  for (const learner of learners) {
    const scoreBy = new Map(learner.userCompetencies.map((uc) => [uc.competencyId, uc.currentScore === null ? null : Number(uc.currentScore)]));
    for (const rc of learner.jobRole?.roleCompetencies ?? []) {
      observations.push({
        departmentName: learner.department?.name ?? "Unassigned",
        domainName: rc.competency.domain.name,
        score: scoreBy.get(rc.competencyId) ?? null,
      });
    }
  }
  return computeCompetencyDistribution(observations);
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface ForecastData {
  forecasts: ShortageForecast[];
  months: string[];
  seriesByCompetency: Record<string, number[]>;
}

/**
 * Monthly open-gap counts per competency from GapSnapshot: for each month,
 * each (officer, competency) counts once, using that officer's latest
 * snapshot in the month. The series starts at the first month with any
 * snapshots, so a young dataset isn't read as a rising trend from zero.
 */
export async function loadShortageForecast(now = new Date()): Promise<ForecastData> {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (FORECAST_LOOKBACK_MONTHS - 1), 1));
  const [snapshots, competencies, priorities] = await Promise.all([
    db.gapSnapshot.findMany({ where: { day: { gte: since } }, orderBy: { day: "asc" }, select: { day: true, userId: true, competencyId: true } }),
    db.competency.findMany({ select: { id: true, name: true, domain: { select: { name: true } } } }),
    db.departmentPriority.findMany({ select: { competencyId: true, futureDemand: true } }),
  ]);

  const allMonths: string[] = [];
  for (let i = 0; i < FORECAST_LOOKBACK_MONTHS; i++) {
    allMonths.push(monthKey(new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1))));
  }
  const firstWithData = allMonths.findIndex((m) => snapshots.some((s) => monthKey(s.day) === m));
  const months = firstWithData === -1 ? [] : allMonths.slice(firstWithData);

  // month → competency → set of officers with an open gap that month
  const counts = new Map<string, Map<string, Set<string>>>();
  for (const s of snapshots) {
    const m = monthKey(s.day);
    if (!counts.has(m)) counts.set(m, new Map());
    const byComp = counts.get(m)!;
    if (!byComp.has(s.competencyId)) byComp.set(s.competencyId, new Set());
    byComp.get(s.competencyId)!.add(s.userId);
  }

  const demand = new Map<string, number[]>();
  for (const p of priorities) {
    if (p.futureDemand === null) continue;
    demand.set(p.competencyId, [...(demand.get(p.competencyId) ?? []), Number(p.futureDemand)]);
  }

  const seriesByCompetency: Record<string, number[]> = {};
  const series: ShortageSeries[] = [];
  for (const c of competencies) {
    const monthlyCounts = months.map((m) => counts.get(m)?.get(c.id)?.size ?? 0);
    if (monthlyCounts.every((v) => v === 0)) continue;
    const d = demand.get(c.id) ?? [];
    seriesByCompetency[c.id] = monthlyCounts;
    series.push({
      competencyId: c.id,
      competencyName: c.name,
      domainName: c.domain.name,
      monthlyCounts,
      futureDemand: d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0,
      emerging: EMERGING_COMPETENCIES.has(c.name),
    });
  }
  return { forecasts: forecastShortages(series), months, seriesByCompetency };
}

export interface CohortPlanItem {
  forecast: ShortageForecast;
  course: { id: string; title: string; source: "IGOT" | "NSSTA"; hours: number; meanDelta: number | null; evidence: "measured" | "catalog-only" } | null;
}

/**
 * Pairs the highest-pressure forecast competencies with the course most
 * likely to close them: best measured effectiveness first, otherwise the
 * catalog course tagged with that competency at the most suitable level.
 */
export async function buildCohortPlan(forecasts: ShortageForecast[], effectiveness: CourseEffectiveness[], limit = 5): Promise<CohortPlanItem[]> {
  const top = forecasts.slice(0, limit);
  const courses = await db.course.findMany({
    where: { competencies: { hasSome: top.map((f) => f.competencyId) } },
    select: { id: true, title: true, source: true, durationHours: true, competencies: true, level: true },
    orderBy: [{ level: "asc" }, { id: "asc" }],
  });
  const effectivenessById = new Map(effectiveness.map((e) => [e.courseId, e]));

  return top.map((forecast) => {
    const tagged = courses.filter((c) => c.competencies.includes(forecast.competencyId));
    const measured = tagged
      .map((c) => ({ c, e: effectivenessById.get(c.id) }))
      .filter((x) => x.e?.sufficientData && x.e.meanDelta !== null)
      .sort((a, b) => b.e!.meanDelta! - a.e!.meanDelta!);
    if (measured.length) {
      const { c, e } = measured[0];
      return { forecast, course: { id: c.id, title: c.title, source: c.source, hours: Number(c.durationHours), meanDelta: e!.meanDelta, evidence: "measured" } };
    }
    // Catalog fallback: the most foundational tagged course (lowest level).
    const c = tagged[0];
    return {
      forecast,
      course: c ? { id: c.id, title: c.title, source: c.source, hours: Number(c.durationHours), meanDelta: null, evidence: "catalog-only" } : null,
    };
  });
}
