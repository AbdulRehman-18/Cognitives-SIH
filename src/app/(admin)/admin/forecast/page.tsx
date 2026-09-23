import { requireRole } from "@/lib/auth/rbac";
import { buildCohortPlan, loadShortageForecast, loadTrainingEffectiveness } from "@/lib/analytics/load-analytics";
import { FORECAST_HORIZON_MONTHS, MIN_POINTS_FOR_TREND } from "@/lib/engines/analytics";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-[11px] text-muted-foreground">—</span>;
  const w = 88, h = 26, max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default async function AdminForecastPage() {
  await requireRole("ADMIN");
  const [{ forecasts, months, seriesByCompetency }, effectiveness] = await Promise.all([loadShortageForecast(), loadTrainingEffectiveness()]);
  const plan = await buildCohortPlan(forecasts, effectiveness);
  const top = forecasts.slice(0, 12);
  const emergingRising = forecasts.filter((f) => f.emerging && f.slopePerMonth > 0);

  return (
    <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[20px]">
      <div className="max-w-[760px]">
        <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Skill-shortage forecast</h1>
        <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[10px]">
          Where capacity-building demand is heading over the next {FORECAST_HORIZON_MONTHS} months, projected from the monthly trend in open gaps and weighted by each division’s stated future demand.
        </p>
        <p className="text-[12px] tabular-mono text-muted-foreground mt-[6px]">History: {months.length ? `${months[0]} → ${months.at(-1)} (${months.length} month${months.length === 1 ? "" : "s"})` : "none yet"}</p>
      </div>

      {forecasts.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-[color:var(--color-border-resting)] p-[24px] text-[13px] text-muted-foreground">No gap history yet. Snapshots are recorded every time a learner’s gaps are computed; the forecast appears once there is data.</p>
      ) : (
        <>
          {emergingRising.length > 0 && (
            <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] px-[16px] py-[12px] text-[13px] text-[#92400E] dark:bg-[#2A2410] dark:border-[#8A6D00]/30 dark:text-[#FDE68A]">
              <span className="font-semibold">Emerging-technology pressure rising:</span> {emergingRising.map((f) => f.competencyName).join(", ")}.
            </div>
          )}

          <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] overflow-hidden">
            <div className="px-[18px] py-[14px] border-b border-[color:var(--color-border-resting)]">
              <h2 className="text-[15px] font-[650]">Projected shortages, highest pressure first</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  <tr className="border-b border-[color:var(--color-border-resting)]">
                    <th className="text-left font-semibold px-[18px] py-[10px]">Competency</th>
                    <th className="text-left font-semibold px-[10px] py-[10px]">Trend</th>
                    <th className="text-right font-semibold px-[10px] py-[10px]">Now</th>
                    <th className="text-right font-semibold px-[10px] py-[10px]">Per month</th>
                    <th className="text-right font-semibold px-[10px] py-[10px]">In {FORECAST_HORIZON_MONTHS} mo</th>
                    <th className="text-right font-semibold px-[10px] py-[10px]">Future demand</th>
                    <th className="text-right font-semibold px-[18px] py-[10px]">Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((f) => (
                    <tr key={f.competencyId} className="border-b border-[color:var(--color-border-resting)] last:border-0">
                      <td className="px-[18px] py-[10px]">
                        <p className="font-medium">{f.competencyName} {f.emerging && <span className="ml-[6px] rounded-full bg-[color:var(--color-accent)]/10 px-[7px] py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-accent)]">Emerging</span>}</p>
                        <p className="text-[11px] text-muted-foreground">{f.domainName}</p>
                      </td>
                      <td className="px-[10px] py-[10px]"><Sparkline values={seriesByCompetency[f.competencyId] ?? []} /></td>
                      <td className="px-[10px] py-[10px] text-right tabular-mono">{f.current}</td>
                      <td className="px-[10px] py-[10px] text-right tabular-mono">{f.trendFitted ? `${f.slopePerMonth > 0 ? "+" : ""}${f.slopePerMonth.toFixed(2)}` : "—"}</td>
                      <td className="px-[10px] py-[10px] text-right tabular-mono font-semibold">{f.projected.toFixed(1)}</td>
                      <td className="px-[10px] py-[10px] text-right tabular-mono">{f.futureDemand.toFixed(2)}</td>
                      <td className="px-[18px] py-[10px] text-right tabular-mono font-semibold">{f.pressure.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
            <h2 className="text-[15px] font-[650]">Recommended cohort training plan</h2>
            <p className="text-[12px] text-muted-foreground mt-[2px]">The top projected shortages, each paired with the course that has moved scores most — or, without measured data yet, the most foundational catalog course for it.</p>
            <ol className="mt-[12px] flex flex-col gap-[8px]">
              {plan.map(({ forecast, course }, i) => (
                <li key={forecast.competencyId} className="flex flex-wrap items-center gap-[10px] rounded-[12px] border border-[color:var(--color-border-resting)] px-[12px] py-[10px]">
                  <span className="num text-[12px] font-semibold tabular-mono text-muted-foreground w-[20px]">{i + 1}</span>
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[13px] font-semibold">{forecast.competencyName}</p>
                    <p className="text-[11px] tabular-mono text-muted-foreground">~{Math.ceil(forecast.projected)} officers projected to need it</p>
                  </div>
                  {course ? (
                    <div className="min-w-[220px] flex-[2]">
                      <p className="text-[13px]">{course.title}</p>
                      <p className="text-[11px] tabular-mono text-muted-foreground">
                        {course.source === "IGOT" ? "iGOT" : "NSSTA"} · {course.hours}h · {course.evidence === "measured" ? `measured ${course.meanDelta! > 0 ? "+" : ""}${course.meanDelta!.toFixed(1)} pts` : "no effectiveness data yet"}
                      </p>
                    </div>
                  ) : (
                    <p className="flex-[2] text-[12px] text-muted-foreground">No catalog course covers this yet — a content gap to raise with NSSTA.</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <p className="text-[12px] text-muted-foreground max-w-[80ch]">
        <span className="font-semibold text-foreground">Formula.</span> Monthly series = officers with an open gap in each competency (latest snapshot per officer per month). Trend = least-squares line, fitted with at least {MIN_POINTS_FOR_TREND} months of history. Projected = max(0, trend value {FORECAST_HORIZON_MONTHS} months ahead). Pressure = projected × (1 + mean division future-demand weight). Emerging-technology competencies are flagged, not up-weighted.
      </p>
    </div>
  );
}
