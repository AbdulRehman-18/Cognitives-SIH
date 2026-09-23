import { requireRole } from "@/lib/auth/rbac";
import { loadTrainingEffectiveness } from "@/lib/analytics/load-analytics";
import { MIN_COMPLETIONS_FOR_RANKING } from "@/lib/engines/analytics";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number | null, digits = 1) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}`);

export default async function AdminEffectivenessPage() {
  await requireRole("ADMIN");
  const courses = await loadTrainingEffectiveness();
  const ranked = courses.filter((c) => c.sufficientData);
  const totals = courses.reduce(
    (t, c) => ({ enrolments: t.enrolments + c.enrolments, completions: t.completions + c.completions, hours: t.hours + c.completions * c.hours }),
    { enrolments: 0, completions: 0, hours: 0 },
  );
  const maxDelta = Math.max(...ranked.map((c) => Math.abs(c.meanDelta ?? 0)), 1);

  return (
    <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[20px]">
      <div className="max-w-[760px]">
        <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Training effectiveness</h1>
        <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[10px]">
          Did the courses officers completed actually move their measured competency? Each learner’s score on a course’s competencies at enrolment is compared with their score now.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px]">
        {[
          { k: "Enrolments tracked", v: totals.enrolments.toString() },
          { k: "Completions", v: totals.completions.toString() },
          { k: "Completion rate", v: totals.enrolments ? pct(totals.completions / totals.enrolments) : "—" },
          { k: "Study hours completed", v: totals.hours.toFixed(0) },
        ].map((m) => (
          <div key={m.k} className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[16px]">
            <p className="num text-[26px] font-[700] leading-none tabular-mono">{m.v}</p>
            <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground mt-[8px]">{m.k}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] overflow-hidden">
        <div className="px-[18px] py-[14px] border-b border-[color:var(--color-border-resting)] flex flex-wrap items-baseline justify-between gap-[8px]">
          <h2 className="text-[15px] font-[650]">Courses ranked by measured improvement</h2>
          <p className="text-[12px] text-muted-foreground tabular-mono">ranked when ≥{MIN_COMPLETIONS_FOR_RANKING} completions have a before-and-after score</p>
        </div>
        {courses.length === 0 ? (
          <p className="p-[18px] text-[13px] text-muted-foreground">No enrolments yet. Effectiveness appears once officers enrol on and complete courses through iGOT.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <tr className="border-b border-[color:var(--color-border-resting)]">
                  <th className="text-left font-semibold px-[18px] py-[10px]">Course</th>
                  <th className="text-right font-semibold px-[10px] py-[10px]">Enrolled</th>
                  <th className="text-right font-semibold px-[10px] py-[10px]">Completed</th>
                  <th className="text-left font-semibold px-[10px] py-[10px] min-w-[180px]">Mean score change</th>
                  <th className="text-right font-semibold px-[18px] py-[10px]">Per hour</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.courseId} className="border-b border-[color:var(--color-border-resting)] last:border-0">
                    <td className="px-[18px] py-[10px]">
                      <p className="font-medium">{c.courseTitle}</p>
                      <p className="text-[11px] tabular-mono text-muted-foreground">{c.source === "IGOT" ? "iGOT" : "NSSTA"} · {c.hours}h</p>
                    </td>
                    <td className="px-[10px] py-[10px] text-right tabular-mono">{c.enrolments}</td>
                    <td className="px-[10px] py-[10px] text-right tabular-mono">{c.completions} <span className="text-muted-foreground">({pct(c.completionRate)})</span></td>
                    <td className="px-[10px] py-[10px]">
                      {c.sufficientData && c.meanDelta !== null ? (
                        <div className="flex items-center gap-[8px]">
                          <div className="h-[8px] w-[110px] rounded-full bg-[color:var(--color-border-resting)] overflow-hidden">
                            <div className={`h-full rounded-full ${c.meanDelta >= 0 ? "bg-[#12B76A]" : "bg-[#F04438]"}`} style={{ width: `${(Math.abs(c.meanDelta) / maxDelta) * 100}%` }} />
                          </div>
                          <span className="tabular-mono font-semibold">{signed(c.meanDelta)} pts</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">Insufficient data ({c.measuredCompletions} measured)</span>
                      )}
                    </td>
                    <td className="px-[18px] py-[10px] text-right tabular-mono">{c.sufficientData ? signed(c.deltaPerHour, 2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[12px] text-muted-foreground max-w-[80ch]">
        <span className="font-semibold text-foreground">Formula.</span> Per learner: mean over the course’s competencies of (score now − score at enrolment), counting only competencies scored at both points. Per course: mean of learner changes across completions; per hour = mean change ÷ course hours. Scores come from the Competency Engine; this page is observational and does not control for other learning that happened in between.
      </p>
    </div>
  );
}
