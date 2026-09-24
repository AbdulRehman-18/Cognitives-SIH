"use client";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, X } from "lucide-react";
import { LevelScale } from "@/components/caliper/level-scale";
import { cn } from "@/lib/utils";
import type { PathViewItem } from "./learning-path-view";

const SOURCE_LABEL = { IGOT: "iGOT Karmayogi", NSSTA: "NSSTA" } as const;

function relative(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, secs] of steps) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  return "just now";
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Opens a course in a side panel instead of sending the learner off-site:
 * progress as a measured rule, the path from enrolment to a re-measured
 * level, the gap it closes, and the iGOT controls.
 */
export function CoursePanel({ item, children, className }: { item: PathViewItem; children: React.ReactNode; className?: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(
          "w-fit rounded-[4px] text-left underline decoration-transparent underline-offset-4 outline-none transition-colors hover:decoration-[color:var(--color-border-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60",
          className,
        )}
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-[var(--duration-standard)] data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[540px] flex-col border-l border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-1)] shadow-[-24px_0_64px_rgba(0,0,0,0.28)] outline-none transition-[transform,opacity] duration-[380ms] ease-[var(--ease-entrance)] data-ending-style:translate-x-[48px] data-ending-style:opacity-0 data-starting-style:translate-x-[48px] data-starting-style:opacity-0">
          <PanelBody item={item} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PanelBody({ item }: { item: PathViewItem }) {
  const tracked = item.source === "IGOT";
  const enrolled = item.status === "active" || item.status === "done";
  const pct = item.status === "done" ? 100 : item.status === "active" ? item.pct : 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-[16px] border-b border-[color:var(--color-border-resting)] px-[28px] pb-[20px] pt-[24px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
          <p className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-[12px] text-muted-foreground">
            <span>{SOURCE_LABEL[item.source]}</span>
            <span aria-hidden>·</span>
            <span className="num">{item.hours}h</span>
            <span aria-hidden>·</span>
            <span>Week {item.weekNumber} of your path</span>
            {item.courseLevel ? (
              <>
                <span aria-hidden>·</span>
                <span>Difficulty <span className="num">L{item.courseLevel}</span></span>
              </>
            ) : null}
          </p>
          <Dialog.Title className="text-[22px] font-[640] leading-[1.25] tracking-[-0.02em] text-foreground">{item.title}</Dialog.Title>
        </div>
        <Dialog.Close className="-mr-[8px] -mt-[2px] grid size-[32px] shrink-0 place-items-center rounded-[8px] text-muted-foreground outline-none transition-colors hover:bg-[color:var(--color-canvas)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60">
          <X className="size-[16px]" aria-hidden />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </div>

      <div className="tutor-scroll flex flex-1 flex-col gap-[32px] overflow-y-auto px-[28px] py-[24px]">
        {/* Progress */}
        <section aria-labelledby="panel-progress" className="flex flex-col gap-[14px]">
          <h3 id="panel-progress" className="sr-only">Progress</h3>
          {tracked ? (
            <>
              <div className="flex items-end justify-between gap-[16px]">
                <p className="flex items-baseline gap-[8px]">
                  <span className="num text-[40px] font-medium leading-none tracking-[-0.03em] text-foreground">{pct}</span>
                  <span className="num text-[16px] text-muted-foreground">%</span>
                  <span className="ml-[4px] text-[13px] text-muted-foreground">
                    {item.status === "done" ? "complete" : enrolled ? "through the course" : "not enrolled yet"}
                  </span>
                </p>
                <p className="text-right text-[12px] leading-[1.5] text-muted-foreground">
                  {item.enrolledAt && <span className="block">Enrolled {fmtDate(item.enrolledAt)}</span>}
                  {item.syncedAt && enrolled && <span className="block">Synced {relative(item.syncedAt)}</span>}
                </p>
              </div>
              <ProgressRule pct={pct} done={item.status === "done"} />
              {item.mockMode && enrolled && item.status !== "done" && (
                <p className="text-[12px] leading-[1.5] text-muted-foreground">
                  Demo iGOT connection: use the simulate controls to advance progress. Each step runs the real sync.
                </p>
              )}
              {item.controls && <div className="pt-[2px]">{item.controls}</div>}
            </>
          ) : (
            <div className="flex flex-col gap-[6px] rounded-[12px] border border-dashed border-[color:var(--color-border-hover)] px-[16px] py-[14px]">
              <p className="text-[14px] font-medium text-foreground">Classroom programme</p>
              <p className="text-[13px] leading-[1.55] text-muted-foreground">
                NSSTA programmes don’t report progress online. Nomination is arranged through your division; your level is re-measured at your next assessment.
              </p>
            </div>
          )}
        </section>

        {/* Journey */}
        {tracked && (
          <section aria-labelledby="panel-steps" className="flex flex-col gap-[14px]">
            <h3 id="panel-steps" className="text-[13px] font-semibold text-foreground">From enrolment to a new level</h3>
            <ol className="relative flex flex-col gap-[16px]">
              <span className="absolute bottom-[10px] left-[8.5px] top-[10px] w-px bg-[color:var(--color-border-hover)]" aria-hidden />
              <Step state={enrolled ? "done" : "current"} title="Enrol on iGOT" body="Your current level is recorded as the baseline." />
              <Step
                state={item.status === "done" ? "done" : enrolled ? "current" : "todo"}
                title="Work through the course"
                body={enrolled && item.status !== "done" ? `${pct}% so far. Progress is pulled from iGOT when you sync.` : "Study at your own pace on iGOT Karmayogi."}
              />
              <Step state={item.status === "done" ? "done" : "todo"} title="Completion syncs back" body="The certificate counts as evidence for this competency." />
              <Step state={item.status === "done" ? "done" : "todo"} title="Your level is re-measured" body={`Your ${item.competencyName} score and gap are recomputed from the new evidence.`} />
            </ol>
          </section>
        )}

        {/* Gap */}
        <section aria-labelledby="panel-gap" className="flex flex-col gap-[12px]">
          <div className="flex items-baseline justify-between gap-[12px]">
            <h3 id="panel-gap" className="text-[13px] font-semibold text-foreground">Why it’s on your path</h3>
            <span className="num text-[12px] text-muted-foreground">L{item.currentLevel} → L{item.requiredLevel}</span>
          </div>
          <div className="rounded-[12px] bg-[color:var(--color-canvas)]/45 px-[16px] pb-[14px] pt-[16px]">
            <LevelScale size="lg" current={item.currentLevel} required={item.requiredLevel} severity={item.severity} label={item.competencyName} />
          </div>
          <p className="text-[13px] leading-[1.6] text-muted-foreground">
            It closes a {item.severity === "CRITICAL" ? "critical" : item.severity.toLowerCase()} gap in <span className="text-foreground">{item.competencyName}</span>
            {item.after.length > 0 ? <>, and is scheduled after <span className="text-foreground">{item.after.join(", ")}</span> because it builds on it.</> : "."}
          </p>
        </section>

        {/* About */}
        {item.description && (
          <section aria-labelledby="panel-about" className="flex flex-col gap-[8px]">
            <h3 id="panel-about" className="text-[13px] font-semibold text-foreground">About the course</h3>
            <p className="text-[14px] leading-[1.65] text-muted-foreground">{item.description}</p>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-[10px] border-t border-[color:var(--color-border-resting)] px-[28px] py-[16px]">
        {item.href && (
          <a href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-[6px] rounded-[10px] bg-[color:var(--color-ink)] px-[14px] py-[8px] text-[13px] font-medium text-[color:var(--color-canvas)] outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60">
            Open on {item.source === "IGOT" ? "iGOT" : "NSSTA"} <ArrowUpRight className="size-[14px]" aria-hidden />
          </a>
        )}
        <Link href={`/tutor/quiz?topic=${encodeURIComponent(item.competencyName)}`} className="inline-flex items-center rounded-[10px] border border-[color:var(--color-border-hover)] px-[14px] py-[8px] text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-[color:var(--color-canvas)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60">
          Check yourself
        </Link>
        <span className="ml-auto hidden text-[12px] text-muted-foreground sm:inline">Esc to close</span>
      </div>
    </>
  );
}

/** Progress as a caliper rule: minor ticks every 5%, majors every 25%. */
function ProgressRule({ pct, done }: { pct: number; done: boolean }) {
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress" className="flex flex-col gap-[6px]">
      <div className="relative h-[10px] overflow-hidden rounded-[3px] bg-[color:var(--color-canvas)] ring-1 ring-inset ring-[color:var(--color-border-resting)]">
        <div
          className="path-seg absolute inset-y-0 left-0 rounded-[3px]"
          style={{ width: `${pct}%`, background: done ? "var(--color-grow)" : "var(--color-accent)", ["--d" as string]: "120ms" } as React.CSSProperties}
        />
      </div>
      <div className="relative h-[16px]" aria-hidden>
        {Array.from({ length: 21 }, (_, i) => i * 5).map((v) => {
          const major = v % 25 === 0;
          return (
            <span key={v} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${v}%` }}>
              <span className={cn("w-px", major ? "h-[5px] bg-[color:var(--color-ink-faint)]" : "h-[3px] bg-[color:var(--color-border-hover)]")} />
              {major && <span className="num mt-[1px] text-[10px] text-muted-foreground">{v}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Step({ state, title, body }: { state: "done" | "current" | "todo"; title: string; body: string }) {
  return (
    <li className="relative flex gap-[14px]">
      <span
        className={cn(
          "relative z-10 mt-[2px] grid size-[18px] shrink-0 place-items-center rounded-full",
          state === "done" && "bg-[color:var(--color-grow)]",
          state === "current" && "bg-[color:var(--color-surface-1)] ring-2 ring-[color:var(--color-accent)]",
          state === "todo" && "bg-[color:var(--color-surface-1)] ring-1 ring-[color:var(--color-border-hover)]",
        )}
        aria-hidden
      >
        {state === "done" && (
          <svg viewBox="0 0 18 18" className="size-[18px]"><path d="M5.5 9.2l2.2 2.2 4.8-4.8" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
        {state === "current" && <span className="size-[6px] rounded-full bg-[color:var(--color-accent)]" />}
      </span>
      <div className="flex flex-col gap-[2px]">
        <p className={cn("text-[14px] font-medium", state === "todo" ? "text-muted-foreground" : "text-foreground")}>
          {title}
          <span className="sr-only"> ({state === "done" ? "done" : state === "current" ? "in progress" : "not yet"})</span>
        </p>
        <p className="text-[13px] leading-[1.55] text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
