import Link from "next/link";
import { cn } from "@/lib/utils";

// PathTimeline — src/components/caliper/path-timeline.tsx
//
// Week-banded learning path with prerequisite-ordered items. The order shown
// is exactly what the Learning Path Engine computed — the UI adds labels and
// links, never re-sequences.

export interface PathTimelineItem {
  id: string;
  title: string;
  /** e.g. "iGOT · 30h" or "NSSTA · 3h". */
  meta?: string;
  rationale?: string;
  href?: string;
  severityLabel?: string;
  severityClass?: string;
}

export interface PathWeek {
  weekNumber: number;
  hours: number;
  items: PathTimelineItem[];
}

export interface PathTimelineProps {
  weeks: PathWeek[];
  maxWeeklyHours: number;
  className?: string;
}

export function PathTimeline({ weeks, maxWeeklyHours, className }: PathTimelineProps) {
  return (
    <ol className={cn("flex flex-col gap-4", className)}>
      {weeks.map((week) => (
        <li key={week.weekNumber} className="relative border-l border-border pl-5">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[5px] h-2 w-2 rounded-full bg-[color:var(--color-target)]"
          />
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">
              Week {week.weekNumber}
            </h3>
            <span className="tabular-mono text-xs text-muted-foreground">
              {week.hours}h / {maxWeeklyHours}h budget
            </span>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {week.items.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {item.href ? (
                    <Link
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-[color:var(--color-measure)]"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                  )}
                  {item.severityLabel ? (
                    <span
                      className={cn(
                        "rounded-sm px-2 py-0.5 text-xs font-medium",
                        item.severityClass,
                      )}
                    >
                      {item.severityLabel}
                    </span>
                  ) : null}
                </div>
                {item.meta ? (
                  <p className="mt-0.5 text-xs tabular-mono text-muted-foreground">{item.meta}</p>
                ) : null}
                {item.rationale ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{item.rationale}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
