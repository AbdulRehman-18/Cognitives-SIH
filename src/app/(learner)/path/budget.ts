// Weekly study budget the path is packed into. Stored in a cookie so a
// learner can re-pace their path without a schema change.
export const PATH_BUDGET_COOKIE = "path_weekly_hours";
export const PATH_BUDGET_OPTIONS = [3, 5, 8, 12] as const;

export function parseBudget(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return (PATH_BUDGET_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}
