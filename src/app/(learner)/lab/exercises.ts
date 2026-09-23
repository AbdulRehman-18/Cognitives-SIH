// Virtual lab exercises — hands-on practice for the Technical-domain
// competencies (Python, SQL) with official-statistics data. Each exercise is
// checked by deterministic Python assertions run in the browser sandbox.
// Practice only: results are never written back as competency evidence.

export interface LabExercise {
  id: string;
  competency: "Python" | "SQL";
  title: string;
  brief: string;
  /** Python for "python" exercises; a SQL query for "sql" exercises. */
  language: "python" | "sql";
  starter: string;
  /**
   * Python run after the learner's code. For SQL exercises the learner's
   * query result is available as `result` (list of tuples). Must raise
   * AssertionError with a helpful message on failure.
   */
  check: string;
}

/** Sample survey tables loaded into an in-memory SQLite database for SQL exercises. */
export const SQL_FIXTURE = `
CREATE TABLE households (hh_id INTEGER PRIMARY KEY, district TEXT, sector TEXT, hh_size INTEGER, mpce REAL);
INSERT INTO households VALUES
 (1,'Pune','Urban',4,6200),(2,'Pune','Rural',5,3900),(3,'Nashik','Rural',6,3400),
 (4,'Nashik','Urban',3,5800),(5,'Pune','Urban',2,8100),(6,'Nagpur','Rural',5,3600),
 (7,'Nagpur','Urban',4,6900),(8,'Nashik','Rural',7,3100),(9,'Pune','Rural',4,4200),
 (10,'Nagpur','Rural',3,3800);
`;

export const EXERCISES: LabExercise[] = [
  {
    id: "weighted-mean",
    competency: "Python",
    title: "Weighted mean household size",
    brief: "Survey records carry design weights (multipliers). Complete `weighted_mean(values, weights)` so it returns Σ(wᵢ·xᵢ) / Σwᵢ.",
    language: "python",
    starter: `def weighted_mean(values, weights):
    # your code here
    pass

sizes = [4, 5, 6, 3]
weights = [120.0, 80.0, 150.0, 50.0]
print(round(weighted_mean(sizes, weights), 3))`,
    check: `assert abs(weighted_mean([4, 5, 6, 3], [120.0, 80.0, 150.0, 50.0]) - 4.825) < 1e-9, "Expected 4.825 for the sample data"
assert weighted_mean([2, 2], [1, 3]) == 2, "Equal values should give that value"`,
  },
  {
    id: "proportional-allocation",
    competency: "Python",
    title: "Proportional allocation across strata",
    brief: "Allocate a total sample n across strata in proportion to stratum sizes: nₕ = round(n · Nₕ / N). Return a list in the same order as `strata_sizes`.",
    language: "python",
    starter: `def proportional_allocation(n, strata_sizes):
    # your code here
    pass

print(proportional_allocation(400, [5000, 3000, 2000]))`,
    check: `assert proportional_allocation(400, [5000, 3000, 2000]) == [200, 120, 80], "400 over 5000/3000/2000 should give [200, 120, 80]"
assert sum(proportional_allocation(100, [50, 50])) == 100`,
  },
  {
    id: "laspeyres",
    competency: "Python",
    title: "Laspeyres price index",
    brief: "Compute a Laspeyres index = 100 · Σ(p₁·q₀) / Σ(p₀·q₀) for a fixed base-period basket.",
    language: "python",
    starter: `def laspeyres(p0, p1, q0):
    # p0: base prices, p1: current prices, q0: base quantities
    pass

print(round(laspeyres([40, 25, 60], [44, 30, 63], [10, 20, 5]), 2))`,
    check: `assert round(laspeyres([40, 25, 60], [44, 30, 63], [10, 20, 5]), 2) == 112.92, "Expected 112.92 for the sample basket"
assert laspeyres([10], [10], [3]) == 100, "Unchanged prices must give 100"`,
  },
  {
    id: "rse",
    competency: "Python",
    title: "Relative standard error",
    brief: "The RSE flags unreliable estimates: RSE% = 100 · SE / estimate. Return None when the estimate is 0.",
    language: "python",
    starter: `def rse_percent(estimate, standard_error):
    pass

print(rse_percent(5200, 312))`,
    check: `assert abs(rse_percent(5200, 312) - 6.0) < 1e-9, "5200 with SE 312 is an RSE of 6%"
assert rse_percent(0, 5) is None, "Guard against division by zero"`,
  },
  {
    id: "sql-count-district",
    competency: "SQL",
    title: "Households per district",
    brief: "Table `households(hh_id, district, sector, hh_size, mpce)`. Return each district with its household count, ordered by district name.",
    language: "sql",
    starter: `SELECT district, COUNT(*) AS households
FROM households
-- finish the query
`,
    check: `assert result == [("Nagpur", 3), ("Nashik", 3), ("Pune", 4)], f"Got {result}; expected one row per district, ordered by name"`,
  },
  {
    id: "sql-mpce-sector",
    competency: "SQL",
    title: "Average MPCE by sector",
    brief: "Monthly per-capita consumption expenditure (mpce) by sector: return (sector, average mpce rounded to 1 decimal), Rural first.",
    language: "sql",
    starter: `SELECT sector, ROUND(AVG(mpce), 1) AS avg_mpce
FROM households
-- finish the query
`,
    check: `assert result == [("Rural", 3666.7), ("Urban", 6750.0)], f"Got {result}; expected Rural then Urban averages"`,
  },
];
