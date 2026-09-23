// Workforce Analytics Engine — src/lib/engines/analytics.ts
//
// Pure, deterministic functions behind the admin analytics pages: training
// effectiveness, competency distribution, and the skill-shortage forecast.
// Same contract as the other engines: no database, no I/O, no LLM. Callers
// (src/lib/analytics/load-analytics.ts) gather rows and pass them in; every
// number an admin sees is computed here and can be shown with its formula.

// ─────────────────────────────────────────────────────────────────────────
// Training effectiveness
// ─────────────────────────────────────────────────────────────────────────

/** Courses need this many measured completions before they are ranked. */
export const MIN_COMPLETIONS_FOR_RANKING = 3;

export interface EnrolmentObservation {
  courseId: string;
  courseTitle: string;
  source: "IGOT" | "NSSTA";
  hours: number;
  completed: boolean;
  /** Score per targeted competency at enrolment (null = not yet assessed then). */
  baseline: Record<string, number | null> | null;
  /** Score per targeted competency now. */
  current: Record<string, number | null>;
}

export interface CourseEffectiveness {
  courseId: string;
  courseTitle: string;
  source: "IGOT" | "NSSTA";
  hours: number;
  enrolments: number;
  completions: number;
  /** completions / enrolments, 0..1 */
  completionRate: number;
  /** Completions with a before AND after score on at least one competency. */
  measuredCompletions: number;
  /** Mean score change (points, 0–100 scale) across measured completions, or null. */
  meanDelta: number | null;
  /** meanDelta / hours — improvement per study hour, or null. */
  deltaPerHour: number | null;
  /** measuredCompletions ≥ MIN_COMPLETIONS_FOR_RANKING */
  sufficientData: boolean;
}

/**
 * Per-learner delta = mean over the course's competencies of (current −
 * baseline), counting only competencies with both scores. Course meanDelta =
 * mean of per-learner deltas across COMPLETED enrolments.
 */
export function learnerDelta(obs: Pick<EnrolmentObservation, "baseline" | "current">): number | null {
  if (!obs.baseline) return null;
  const diffs: number[] = [];
  for (const [competencyId, before] of Object.entries(obs.baseline)) {
    const after = obs.current[competencyId];
    if (before === null || after === null || after === undefined) continue;
    diffs.push(after - before);
  }
  return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
}

export function computeTrainingEffectiveness(observations: EnrolmentObservation[]): CourseEffectiveness[] {
  const byCourse = new Map<string, EnrolmentObservation[]>();
  for (const o of observations) byCourse.set(o.courseId, [...(byCourse.get(o.courseId) ?? []), o]);

  const results: CourseEffectiveness[] = [];
  for (const [courseId, rows] of byCourse) {
    const completed = rows.filter((r) => r.completed);
    const deltas = completed.map(learnerDelta).filter((d): d is number => d !== null);
    const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
    const hours = rows[0].hours;
    results.push({
      courseId,
      courseTitle: rows[0].courseTitle,
      source: rows[0].source,
      hours,
      enrolments: rows.length,
      completions: completed.length,
      completionRate: completed.length / rows.length,
      measuredCompletions: deltas.length,
      meanDelta,
      deltaPerHour: meanDelta !== null && hours > 0 ? meanDelta / hours : null,
      sufficientData: deltas.length >= MIN_COMPLETIONS_FOR_RANKING,
    });
  }

  // Ranked courses first (by meanDelta desc), then the rest by completions;
  // courseId as the final tiebreak keeps output order deterministic.
  return results.sort((a, b) => {
    if (a.sufficientData !== b.sufficientData) return a.sufficientData ? -1 : 1;
    if (a.sufficientData && a.meanDelta !== b.meanDelta) return b.meanDelta! - a.meanDelta!;
    if (b.completions !== a.completions) return b.completions - a.completions;
    return a.courseId < b.courseId ? -1 : a.courseId > b.courseId ? 1 : 0;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Competency distribution
// ─────────────────────────────────────────────────────────────────────────

export interface ScoreObservation {
  departmentName: string;
  domainName: string;
  /** 0–100, or null = not yet assessed. */
  score: number | null;
}

export interface DistributionCell {
  departmentName: string;
  domainName: string;
  assessed: number;
  observations: number;
  /** Mean assessed score, or null when nothing is assessed. */
  meanScore: number | null;
  /** assessed / observations, 0..1 */
  coverage: number;
}

export interface CompetencyDistribution {
  departments: string[];
  domains: string[];
  cells: DistributionCell[];
  /** Per domain: counts of assessed scores at levels 1..5 (index 0 = level 1). */
  levelHistogram: Record<string, [number, number, number, number, number]>;
}

export const scoreToLevel = (score: number) => Math.max(1, Math.min(5, Math.ceil(score / 20)));

export function computeCompetencyDistribution(observations: ScoreObservation[]): CompetencyDistribution {
  const departments = [...new Set(observations.map((o) => o.departmentName))].sort();
  const domains = [...new Set(observations.map((o) => o.domainName))].sort();
  const levelHistogram: CompetencyDistribution["levelHistogram"] = {};
  for (const d of domains) levelHistogram[d] = [0, 0, 0, 0, 0];

  const cells: DistributionCell[] = [];
  for (const departmentName of departments) {
    for (const domainName of domains) {
      const rows = observations.filter((o) => o.departmentName === departmentName && o.domainName === domainName);
      if (rows.length === 0) continue;
      const scores = rows.map((r) => r.score).filter((s): s is number => s !== null);
      cells.push({
        departmentName,
        domainName,
        assessed: scores.length,
        observations: rows.length,
        meanScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        coverage: scores.length / rows.length,
      });
    }
  }
  for (const o of observations) {
    if (o.score !== null) levelHistogram[o.domainName][scoreToLevel(o.score) - 1]++;
  }
  return { departments, domains, cells, levelHistogram };
}

// ─────────────────────────────────────────────────────────────────────────
// Skill-shortage forecast
// ─────────────────────────────────────────────────────────────────────────

/** Months ahead the forecast projects (two quarters). */
export const FORECAST_HORIZON_MONTHS = 6;
/** Fewer monthly points than this ⇒ no trend is fitted (flat projection). */
export const MIN_POINTS_FOR_TREND = 3;

export interface ShortageSeries {
  competencyId: string;
  competencyName: string;
  domainName: string;
  /** Officers with an open gap in each consecutive month, oldest first. */
  monthlyCounts: number[];
  /** Mean DepartmentPriority.futureDemand across departments prioritising it, 0..1. */
  futureDemand: number;
  emerging: boolean;
}

export interface ShortageForecast {
  competencyId: string;
  competencyName: string;
  domainName: string;
  current: number;
  /** Least-squares slope, officers per month (0 when history is too short). */
  slopePerMonth: number;
  /** max(0, intercept + slope × (lastIndex + horizon)) */
  projected: number;
  futureDemand: number;
  emerging: boolean;
  /** projected × (1 + futureDemand) — the ranking key. */
  pressure: number;
  trendFitted: boolean;
}

/** Ordinary least squares on (i, y_i), i = 0..n-1. */
export function linearTrend(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

export function forecastShortages(series: ShortageSeries[], horizon = FORECAST_HORIZON_MONTHS): ShortageForecast[] {
  return series
    .map((s) => {
      const values = s.monthlyCounts;
      const current = values.at(-1) ?? 0;
      const trendFitted = values.length >= MIN_POINTS_FOR_TREND;
      const { slope, intercept } = trendFitted ? linearTrend(values) : { slope: 0, intercept: current };
      const projected = trendFitted ? Math.max(0, intercept + slope * (values.length - 1 + horizon)) : current;
      return {
        competencyId: s.competencyId,
        competencyName: s.competencyName,
        domainName: s.domainName,
        current,
        slopePerMonth: slope,
        projected,
        futureDemand: s.futureDemand,
        emerging: s.emerging,
        pressure: projected * (1 + s.futureDemand),
        trendFitted,
      };
    })
    .sort((a, b) => b.pressure - a.pressure || (a.competencyId < b.competencyId ? -1 : 1));
}
