import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PathTimelineItem { id: string; title: string; meta?: string; rationale?: string; href?: string; severityLabel?: string; severityClass?: string; completed?: boolean; }
export interface PathWeek { weekNumber: number; hours: number; items: PathTimelineItem[]; }
export interface PathTimelineProps { weeks: PathWeek[]; maxWeeklyHours: number; className?: string; }

export function PathTimeline({ weeks, maxWeeklyHours, className }: PathTimelineProps) {
  const totalHours = weeks.reduce((s, w) => s + w.hours, 0);
  const totalItems = weeks.reduce((s, w) => s + w.items.length, 0);
  return (
    <div className={cn("flex flex-col gap-[20px]", className)}>
      {/* Progress header */}
      <div className="rounded-[16px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[14px] flex flex-wrap items-center gap-[12px]">
        <div className="flex items-center gap-[10px]">
          <span className="size-8 rounded-full bg-[color:var(--color-accent)] text-white grid place-items-center text-[12px] font-semibold">{weeks.length}</span>
          <div>
            <p className="text-small font-semibold leading-none">{weeks.length} weeks · {totalHours}h total</p>
            <p className="text-[11px] tabular-mono text-muted-foreground">{totalItems} courses · {maxWeeklyHours}h/week budget</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-[12px]">
          <div className="hidden md:flex items-center gap-[6px] text-[11px] tabular-mono text-muted-foreground">
            <span className="size-2 rounded-full bg-[#12B76A]" />Prerequisite-ordered
            <span className="mx-[6px] h-3 w-px bg-[color:var(--color-border-resting)]" />
            <span className="size-2 rounded-full bg-[color:var(--color-accent)]" />Priority-packed
          </div>
          <div className="h-[36px] w-[120px] rounded-full bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] overflow-hidden flex">
            {weeks.map((w) => (
              <div key={w.weekNumber} className="flex-1 flex flex-col justify-end p-[3px] gap-[2px]">
                <div className="rounded-full bg-[color:var(--color-accent)]" style={{ height: `${(w.hours / maxWeeklyHours) * 100}%`, opacity: 0.35 + (w.weekNumber / weeks.length) * 0.65 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <ol className="flex flex-col gap-[16px]">
        {weeks.map((week) => {
          const pct = Math.round((week.hours / maxWeeklyHours) * 100);
          return (
            <li key={week.weekNumber} className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] shadow-[var(--shadow-card)] overflow-hidden">
              <div className="flex items-center justify-between gap-[12px] px-[18px] py-[14px] bg-[color:var(--color-canvas)]/50 border-b border-[color:var(--color-border-resting)]">
                <div className="flex items-center gap-[12px]">
                  <span className="size-8 rounded-full bg-white border border-[color:var(--color-border-resting)] grid place-items-center num text-[12px] font-semibold shadow-sm">W{week.weekNumber}</span>
                  <div>
                    <h3 className="text-small font-semibold">Week {week.weekNumber}</h3>
                    <p className="text-[11px] tabular-mono text-muted-foreground">{week.items.length} item{week.items.length !== 1 ? "s" : ""} · {week.hours}h planned</p>
                  </div>
                </div>
                <div className="flex items-center gap-[10px]">
                  <div className="hidden sm:flex items-center gap-[8px]">
                    <div className="w-[96px] h-[6px] rounded-full bg-white border border-[color:var(--color-border-resting)] overflow-hidden">
                      <div className="h-full rounded-full bg-[color:var(--color-accent)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="num text-[11px] tabular-mono text-muted-foreground w-[44px]">{pct}% load</span>
                  </div>
                  <span className={cn("text-[11px] font-semibold px-[8px] py-[4px] rounded-full border", pct > 90 ? "bg-[#F04438]/10 text-[#C9190B] border-[#F04438]/20" : "bg-white text-muted-foreground border-[color:var(--color-border-resting)]")}>{pct > 90 ? "Full" : "Balanced"}</span>
                </div>
              </div>
              <ul className="p-[12px] flex flex-col gap-[10px]">
                {week.items.map((item, idx) => (
                  <li key={item.id} className="group flex gap-[12px] rounded-[16px] border border-[color:var(--color-border-resting)] bg-white p-[14px] hover:border-[color:var(--color-border-hover)] hover:shadow-[var(--shadow-card)] transition">
                    <span className="size-7 shrink-0 rounded-full bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] grid place-items-center num text-[11px] font-semibold text-muted-foreground group-hover:bg-[color:var(--color-accent)] group-hover:text-white transition">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-[8px]">
                        {item.href ? (
                          <Link href={item.href} target="_blank" rel="noopener noreferrer" className="text-small font-semibold hover:text-[color:var(--color-accent)] hover:underline underline-offset-4">{item.title}</Link>
                        ) : (
                          <span className="text-small font-semibold">{item.title}</span>
                        )}
                        {item.severityLabel ? <span className={cn("rounded-full px-[8px] py-[3px] text-[11px] font-semibold border", item.severityClass)}>{item.severityLabel}</span> : null}
                        <span className="ml-auto size-5 rounded-full border border-[color:var(--color-border-resting)] grid place-items-center text-[10px] text-muted-foreground" title="Mark complete">○</span>
                      </div>
                      {item.meta ? <p className="num text-[11px] tabular-mono text-muted-foreground mt-[4px]">{item.meta}</p> : null}
                      {item.rationale ? <p className="text-small leading-relaxed text-muted-foreground mt-[8px] bg-[color:var(--color-canvas)]/70 rounded-[10px] px-[10px] py-[8px] border border-[color:var(--color-border-resting)]/50">{item.rationale}</p> : null}
                      <div className="mt-[10px] flex gap-[8px]">
                        <span className="text-[11px] font-medium px-[10px] py-[5px] rounded-full bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)]">Est. {item.meta?.match(/(\d+)h/)?.[1] ?? "?"}h</span>
                        {item.href ? <Link href={item.href} target="_blank" className="text-[11px] font-medium px-[10px] py-[5px] rounded-full bg-[color:var(--color-accent)] text-white hover:brightness-105">Open course →</Link> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] tabular-mono text-muted-foreground text-center">Ordered by prerequisites first, then gap priority — packed into a {maxWeeklyHours}h weekly budget. Institutional pace, not gamified.</p>
    </div>
  );
}
