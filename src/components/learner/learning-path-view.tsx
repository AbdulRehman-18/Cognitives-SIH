import Link from "next/link";
import { Check, PanelRight } from "lucide-react";
import { LevelScale } from "@/components/caliper/level-scale";
import { CoursePanel } from "./course-panel";
import { cn } from "@/lib/utils";

/** done: completed on iGOT · active: enrolled, in progress · todo: not started · untracked: NSSTA, no progress feed */
export type PathItemStatus = "done" | "active" | "todo" | "untracked";

export interface PathViewItem {
  id: string;
  title: string;
  source: "IGOT" | "NSSTA";
  hours: number;
  weekNumber: number;
  order: number;
  href: string | null;
  competencyName: string;
  severity: string;
  currentLevel: number;
  requiredLevel: number;
  after: string[];
  status: PathItemStatus;
  /** 0–100, meaningful for "active". */
  pct: number;
  /** Enrol / progress control, rendered for the up-next and in-progress items. */
  action?: React.ReactNode;
  /** The same control without its own progress bar, for the course panel. */
  controls?: React.ReactNode;
  description?: string | null;
  /** Course difficulty, 1–5. */
  courseLevel?: number;
  enrolledAt?: string | null;
  syncedAt?: string | null;
  mockMode?: boolean;
}

export interface LearningPathViewProps {
  items: PathViewItem[];
  budget: number;
  className?: string;
}

const SOURCE_LABEL = { IGOT: "iGOT Karmayogi", NSSTA: "NSSTA" } as const;
const fmtH = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)}h`;

export function LearningPathView({ items, budget, className }: LearningPathViewProps) {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const total = ordered.reduce((s, i) => s + i.hours, 0);
  const doneHours = ordered.reduce((s, i) => s + (i.status === "done" ? i.hours : i.status === "active" ? (i.hours * i.pct) / 100 : 0), 0);
  const doneCount = ordered.filter((i) => i.status === "done").length;
  const upNext = ordered.find((i) => i.status !== "done") ?? null;
  // Position on the path, not hours logged: everything before the next course,
  // plus how far into it you are. Progress on later courses doesn't move it.
  const hereHours = upNext
    ? ordered.filter((i) => i.order < upNext.order).reduce((s, i) => s + i.hours, 0) + (upNext.status === "active" ? (upNext.hours * upNext.pct) / 100 : 0)
    : total;
  const doneByCompetency = new Set(ordered.filter((i) => i.status === "done").map((i) => i.competencyName));

  const weekNumbers = [...new Set(ordered.map((i) => i.weekNumber))].sort((a, b) => a - b);
  const lastWeek = ordered.reduce((w, i) => Math.max(w, i.weekNumber + Math.max(0, Math.ceil(i.hours / budget) - 1)), 1);
  const weeks = weekNumbers.map((n) => {
    const weekItems = ordered.filter((i) => i.weekNumber === n);
    const startHours = ordered.filter((i) => i.order < weekItems[0].order).reduce((s, i) => s + i.hours, 0);
    return { n, items: weekItems, hours: weekItems.reduce((s, i) => s + i.hours, 0), startHours };
  });

  return (
    <div className={cn("flex flex-col gap-[40px]", className)}>
      {/* Readout + ruler */}
      <section aria-label="Path progress" className="flex flex-col gap-[18px]">
        <dl className="flex flex-wrap gap-x-[32px] gap-y-[10px]">
          <Readout label="Courses complete" value={`${doneCount}`} of={`/ ${ordered.length}`} />
          <Readout label="Hours logged" value={fmtH(Math.round(doneHours * 10) / 10).replace("h", "")} of={`/ ${fmtH(total)}`} />
          <Readout label="Finish week" value={`${lastWeek}`} of={`at ${budget}h a week`} />
        </dl>
        <PathRuler items={ordered} total={total} hereHours={hereHours} weeks={weeks} upNextId={upNext?.id ?? null} />
      </section>

      {/* Up next */}
      {upNext ? (
        <UpNext item={upNext} doneByCompetency={doneByCompetency} />
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-[16px] rounded-[16px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-1)] p-[24px]">
          <div className="flex flex-col gap-[4px]">
            <h2 className="text-[20px] font-semibold tracking-[-0.015em]">Path complete</h2>
            <p className="max-w-[56ch] text-[14px] leading-[1.55] text-muted-foreground">Every course on your path is done. Take a fresh diagnostic to measure how far your levels have moved.</p>
          </div>
          <Link href="/assessment/new" className="inline-flex items-center gap-[8px] rounded-[10px] bg-[color:var(--color-accent)] px-[16px] py-[9px] text-[14px] font-medium text-white shadow-[var(--shadow-cta)] transition hover:brightness-110">
            Re-measure my levels
          </Link>
        </section>
      )}

      {/* Schedule */}
      <section aria-labelledby="schedule-heading" className="flex flex-col gap-[4px]">
        <div className="flex items-baseline justify-between gap-[12px] pb-[12px]">
          <h2 id="schedule-heading" className="text-[15px] font-semibold">Schedule</h2>
          <p className="text-[12px] text-muted-foreground">Prerequisites first, then by gap priority</p>
        </div>
        <ol className="flex flex-col border-t border-[color:var(--color-border-resting)]">
          {weeks.map((w) => {
            const current = upNext?.weekNumber === w.n;
            const past = upNext ? w.n < upNext.weekNumber : true;
            return (
              <li key={w.n} className="grid grid-cols-1 gap-[12px] border-b border-[color:var(--color-border-resting)] py-[18px] md:grid-cols-[160px_minmax(0,1fr)] md:gap-[24px]">
                <div className="flex items-baseline gap-[10px] md:flex-col md:gap-[6px]">
                  <div className="flex items-center gap-[8px]">
                    <h3 className={cn("text-[14px] font-semibold", past && !current && "text-muted-foreground")}>Week {w.n}</h3>
                    {current && <span className="rounded-[6px] bg-[color:var(--color-accent-15)] px-[6px] py-[1px] text-[11px] font-medium text-[color:var(--color-accent-ink)]">Now</span>}
                  </div>
                  <div className="flex items-center gap-[8px]">
                    <span className="flex h-[4px] w-[56px] overflow-hidden rounded-full bg-[color:var(--color-border-resting)]" aria-hidden>
                      <span className="h-full rounded-full bg-[color:var(--color-ink-faint)]" style={{ width: `${Math.min(100, (w.hours / budget) * 100)}%` }} />
                    </span>
                    <span className="text-[11px] text-muted-foreground"><span className="num">{fmtH(w.hours)}</span> planned</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-[4px]">
                  {w.items.map((item) => (
                    <ScheduleRow key={item.id} item={item} isNext={item.id === upNext?.id} budget={budget} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Readout({ label, value, of }: { label: string; value: string; of: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="flex items-baseline gap-[6px]">
        <span className="num text-[22px] font-medium leading-[1.1] tracking-[-0.02em] text-foreground">{value}</span>
        <span className="num text-[12px] text-muted-foreground">{of}</span>
      </dd>
    </div>
  );
}

/** The whole path as a measured rule: one segment per course, sized by hours. */
function PathRuler({
  items, total, hereHours, weeks, upNextId,
}: {
  items: PathViewItem[];
  total: number;
  hereHours: number;
  weeks: { n: number; startHours: number }[];
  upNextId: string | null;
}) {
  const here = total ? Math.min(100, (hereHours / total) * 100) : 0;
  const labelEvery = weeks.length > 10 ? 2 : 1;
  const edge = here < 8 ? "start" : here > 92 ? "end" : "middle";
  return (
    <div className="relative pb-[22px] pt-[26px]">
      {/* You-are-here marker */}
      <div
        className={cn("absolute top-0", edge === "start" ? "-translate-x-[5px]" : edge === "end" ? "-translate-x-full translate-x-[5px]" : "-translate-x-1/2")}
        style={{ left: `${here}%` }}
      >
        <span className={cn("path-here flex flex-col", edge === "start" ? "items-start" : edge === "end" ? "items-end" : "items-center")}>
          <span className="num whitespace-nowrap text-[11px] font-medium text-[color:var(--color-accent-ink)]">You are here</span>
          <svg viewBox="0 0 10 6" className="mt-[2px] h-[6px] w-[10px] text-[color:var(--color-accent)]" aria-hidden><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
        </span>
      </div>

      <div className="flex h-[10px] gap-[2px]" role="img" aria-label={`${Math.round(here)}% of the way along your path`}>
        {items.map((i) => (
          <div
            key={i.id}
            title={`${i.title} · ${fmtH(i.hours)}`}
            className={cn(
              "path-seg relative h-full overflow-hidden rounded-[2px]",
              i.status === "done" ? "bg-[color:var(--color-grow)]" : "bg-[color:var(--color-border-hover)]",
              i.id === upNextId && "ring-1 ring-[color:var(--color-accent)] ring-offset-2 ring-offset-[color:var(--color-canvas)]",
            )}
            style={{ flexGrow: i.hours, flexBasis: 0, ["--d" as string]: `${i.order * 50}ms` } as React.CSSProperties}
          >
            {i.status === "active" && <span className="absolute inset-y-0 left-0 bg-[color:var(--color-accent)]" style={{ width: `${i.pct}%` }} />}
          </div>
        ))}
      </div>

      {/* Week ticks */}
      <div className="absolute inset-x-0 bottom-0 h-[20px]" aria-hidden>
        {weeks.map((w, k) => {
          const left = total ? (w.startHours / total) * 100 : 0;
          return (
            <div key={w.n} className="absolute top-0 flex flex-col items-start" style={{ left: `${left}%` }}>
              <span className="h-[6px] w-px bg-[color:var(--color-ink-faint)]" />
              {k % labelEvery === 0 && <span className="num mt-[1px] -translate-x-[1px] text-[10px] text-muted-foreground">W{w.n}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpNext({ item, doneByCompetency }: { item: PathViewItem; doneByCompetency: Set<string> }) {
  return (
    <section aria-labelledby="up-next-heading" className="overflow-hidden rounded-[16px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-1)] shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-[14px] p-[24px]">
          <p className="flex flex-wrap items-center gap-[8px] text-[12px] text-muted-foreground">
            <span className="rounded-[6px] bg-[color:var(--color-accent-15)] px-[6px] py-[1px] font-medium text-[color:var(--color-accent-ink)]">{item.status === "active" ? "In progress" : "Up next"}</span>
            <span>Week {item.weekNumber}</span>
            <span aria-hidden>·</span>
            <span>{SOURCE_LABEL[item.source]}</span>
            <span aria-hidden>·</span>
            <span className="num">{fmtH(item.hours)}</span>
          </p>
          <h2 id="up-next-heading" className="text-[22px] font-[640] leading-[1.25] tracking-[-0.02em] text-foreground">
            <CoursePanel item={item}>{item.title}</CoursePanel>
          </h2>
          <p className="max-w-[60ch] text-[14px] leading-[1.55] text-muted-foreground">
            Closes your {item.severity === "CRITICAL" ? "critical" : item.severity.toLowerCase()} <span className="text-foreground">{item.competencyName}</span> gap
            {item.after.length > 0 && (
              <>
                {" "}— it builds on{" "}
                {item.after.map((a, k) => (
                  <span key={a}>
                    {k > 0 && (k === item.after.length - 1 ? " and " : ", ")}
                    <span className="text-foreground">{a}</span>
                    {doneByCompetency.has(a) && <Check className="ml-[3px] inline size-[13px] -translate-y-[1px] text-[color:var(--color-grow)]" aria-label="completed" />}
                  </span>
                ))}
              </>
            )}
            .
          </p>
          <div className="mt-[4px] flex flex-wrap items-center gap-[10px]">
            {item.action}
            <CoursePanel item={item} className="inline-flex items-center gap-[6px] rounded-[8px] border border-[color:var(--color-border-hover)] px-[12px] py-[6px] text-[13px] font-medium text-foreground no-underline transition-colors hover:bg-[color:var(--color-canvas)]">
              Course details <PanelRight className="size-[14px]" aria-hidden />
            </CoursePanel>
            <Link href={`/tutor/quiz?topic=${encodeURIComponent(item.competencyName)}`} className="inline-flex items-center rounded-[8px] px-[10px] py-[6px] text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Check yourself
            </Link>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-[10px] border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/35 p-[24px] lg:border-l lg:border-t-0">
          <p className="flex items-baseline justify-between text-[12px] text-muted-foreground">
            <span>{item.competencyName}</span>
            <span className="num">L{item.currentLevel} → L{item.requiredLevel}</span>
          </p>
          <LevelScale size="lg" current={item.currentLevel} required={item.requiredLevel} severity={item.severity} label={item.competencyName} />
          <p className="text-[12px] leading-[1.5] text-muted-foreground">Completing it on iGOT counts as evidence and updates your measured level.</p>
        </div>
      </div>
    </section>
  );
}

function ScheduleRow({ item, isNext, budget }: { item: PathViewItem; isNext: boolean; budget: number }) {
  const spans = Math.ceil(item.hours / budget);
  return (
    <li className={cn("flex items-start gap-[12px] rounded-[10px] px-[10px] py-[10px] -mx-[10px]", isNext && "bg-[color:var(--color-surface-1)]")}>
      <StatusGlyph status={item.status} pct={item.pct} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <CoursePanel item={item} className={cn("text-[14px] font-medium leading-[1.4]", item.status === "done" ? "text-muted-foreground" : "text-foreground")}>
          {item.title}
        </CoursePanel>
        <p className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px] text-[12px] text-muted-foreground">
          <span>{SOURCE_LABEL[item.source]}</span>
          <span aria-hidden>·</span>
          <span><span className="num">{fmtH(item.hours)}</span>{spans > 1 ? ` over ${spans} weeks` : ""}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-[5px]">
            <span className="size-[5px] rounded-full" style={{ background: item.severity === "CRITICAL" ? "var(--color-critical)" : item.severity === "HIGH" ? "var(--color-moderate)" : "var(--color-ink-faint)" }} aria-hidden />
            {item.competencyName} <span className="num">L{item.currentLevel}→L{item.requiredLevel}</span>
          </span>
          {item.after.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>after {item.after.join(", ")}</span>
            </>
          )}
        </p>
        {item.status === "active" && !isNext && item.action && <div className="mt-[8px]">{item.action}</div>}
      </div>
      <div className="flex shrink-0 items-center pt-[1px]">
        {item.status === "done" ? (
          <span className="text-[12px] text-[color:var(--color-grow)]">Completed</span>
        ) : item.status === "active" ? (
          <span className="num text-[12px] text-foreground">{item.pct}%</span>
        ) : item.status === "untracked" ? (
          <span className="text-[12px] text-muted-foreground">Via nomination</span>
        ) : (
          <span className="text-[12px] text-muted-foreground">{isNext ? "Up next" : "Not started"}</span>
        )}
      </div>
    </li>
  );
}

function StatusGlyph({ status, pct }: { status: PathItemStatus; pct: number }) {
  const r = 7, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="mt-[2px] size-[18px] shrink-0" aria-hidden>
      {status === "done" ? (
        <>
          <circle cx="9" cy="9" r="8" fill="var(--color-grow)" />
          <path d="M5.5 9.2l2.2 2.2 4.8-4.8" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : status === "active" ? (
        <>
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--color-border-hover)" strokeWidth="2" />
          <circle cx="9" cy="9" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 9 9)" />
        </>
      ) : (
        <circle cx="9" cy="9" r={r} fill="none" stroke="var(--color-ink-faint)" strokeWidth="1.5" strokeDasharray={status === "untracked" ? "2 2.4" : undefined} />
      )}
    </svg>
  );
}
