import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PathTimelineItem { id: string; title: string; meta?: string; rationale?: string; href?: string; severityLabel?: string; severityClass?: string; }
export interface PathWeek { weekNumber: number; hours: number; items: PathTimelineItem[]; }
export interface PathTimelineProps { weeks: PathWeek[]; maxWeeklyHours: number; className?: string; }

export function PathTimeline({ weeks, maxWeeklyHours, className }: PathTimelineProps) {
  const totalHours = weeks.reduce((s, w) => s + w.hours, 0);

  return (
    <div className={cn("flex flex-col gap-[0px]", className)}>
      <div className="flex flex-wrap gap-[8px] text-[12px] tabular-mono text-muted-foreground pb-[16px] border-b border-[color:var(--color-border-resting)] mb-[12px]">
        <span className="font-medium text-foreground">{weeks.length} weeks</span> · {totalHours}h total · {maxWeeklyHours}h / week budget · prerequisite-ordered
      </div>

      <div className="relative">
        <div className="absolute left-[19px] top-[14px] bottom-[24px] w-px bg-[color:var(--color-border-resting)] hidden sm:block opacity-60" aria-hidden />

        <ol className="flex flex-col gap-[28px]">
          {weeks.map((week, wi) => (
            <li key={week.weekNumber} className="relative">
              <div className="flex gap-[14px] items-start">
                <div className="hidden sm:grid size-[40px] rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] place-items-center text-[13px] font-[700] shrink-0 relative z-10 border-[3px] border-[color:var(--color-canvas)] shadow-sm">W{week.weekNumber}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-[10px]">
                    <h3 className="text-[15px] font-[700] tracking-[-0.01em] text-foreground">Week {week.weekNumber}</h3>
                    <span className="text-[12px] tabular-mono text-muted-foreground">{week.hours}h planned · {week.items.length} course{week.items.length !== 1 ? "s" : ""}</span>
                    <span className="text-[11px] font-semibold tracking-wide px-[9px] py-[3px] rounded-full border bg-[color:var(--color-surface-1)] text-muted-foreground" style={{ borderColor: week.hours > maxWeeklyHours * 0.9 ? "rgba(240,68,56,0.25)" : "var(--color-border-resting)", color: week.hours > maxWeeklyHours * 0.9 ? "#F04438" : undefined }}>
                      {week.hours > maxWeeklyHours * 0.9 ? "Full load" : "Balanced load"}
                    </span>
                    {wi === 0 && <span className="rounded-full bg-[color:var(--color-accent)] text-white px-[9px] py-[3px] text-[11px] font-semibold">Start here</span>}
                  </div>

                  <div className="mt-[12px] flex flex-col gap-[10px]">
                    {week.items.map((item, idx) => (
                      <div key={item.id} className="relative flex gap-[12px]">
                        <div className="hidden sm:block absolute -left-[34px] top-[22px] w-[28px] h-px bg-[color:var(--color-border-resting)] opacity-60" aria-hidden />
                        <div className="hidden sm:grid absolute -left-[34px] top-[16px] size-[13px] rounded-full bg-[color:var(--color-canvas)] border-2 border-[color:var(--color-accent)] place-items-center z-10"><span className="size-[4px] rounded-full bg-[color:var(--color-accent)]" /></div>

                        <div className="flex-1 rounded-[14px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[16px] hover:border-[color:var(--color-border-hover)] hover:shadow-[var(--shadow-card)] transition flex gap-[12px]">
                          <span className="hidden sm:grid size-[28px] rounded-full bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] place-items-center num text-[11px] font-semibold shrink-0 mt-[1px] text-muted-foreground">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start gap-[8px]">
                              {item.href ? (
                                <Link href={item.href} target="_blank" rel="noopener noreferrer" className="text-[14px] font-[600] leading-tight text-foreground hover:text-[color:var(--color-accent)] underline decoration-transparent hover:decoration-[color:var(--color-accent)] underline-offset-4">{item.title}</Link>
                              ) : (
                                <span className="text-[14px] font-[600] leading-tight text-foreground">{item.title}</span>
                              )}
                              {item.severityLabel && <span className={cn("shrink-0 rounded-full px-[8px] py-[3px] text-[11px] font-semibold border", item.severityClass)}>{item.severityLabel}</span>}
                            </div>
                            {item.meta && <p className="text-[11px] tabular-mono text-muted-foreground mt-[6px]">{item.meta}</p>}
                            {item.rationale && <p className="text-[13px] leading-[1.55] text-muted-foreground mt-[8px]">{item.rationale}</p>}
                            <div className="mt-[12px] flex flex-wrap gap-[8px] items-center">
                              <span className="text-[11px] tabular-mono text-muted-foreground">Est. {item.meta?.match(/(\d+)h/)?.[1] ?? "?"}h</span>
                              <span className="text-muted-foreground text-[11px]">·</span>
                              <span className="text-[11px] text-muted-foreground">{wi === 0 && idx === 0 ? "No prerequisites — start immediately" : "Follows prerequisites, priority-ordered"}</span>
                              {item.href && (
                                <Link href={item.href} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-[4px] rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] px-[12px] py-[6px] text-[11px] font-semibold hover:opacity-90 transition">
                                  Open <span aria-hidden>→</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {wi < weeks.length - 1 && <div className="hidden sm:flex ml-[19px] mt-[16px] items-center gap-[8px] text-[11px] tabular-mono text-muted-foreground/70"><span className="w-[14px] h-px bg-[color:var(--color-border-resting)] opacity-60" /><span>prerequisite → next week</span></div>}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-[12px] text-muted-foreground text-center mt-[20px] pt-[14px] border-t border-[color:var(--color-border-resting)]">Kahn’s order guaranteed prerequisite-first · not a streak, a traceable path you can pause and resume.</p>
    </div>
  );
}
