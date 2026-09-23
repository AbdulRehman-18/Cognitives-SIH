"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IgotProgressState {
  status: "IN_PROGRESS" | "COMPLETED";
  progressPct: number;
}

interface Props {
  courseId: string;
  source: "IGOT" | "NSSTA";
  /** False until the admin has synced the iGOT catalog (course has no externalId). */
  synced: boolean;
  progress: IgotProgressState | null;
  mockMode: boolean;
  className?: string;
}

// Enrol / progress / completion control for one course. All state changes go
// through the iGOT routes (src/app/api/igot/*); the page re-renders from the
// server afterwards so scores, gaps and the path reflect the new evidence.
export function IgotCourseAction({ courseId, source, synced, progress, mockMode, className }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (source === "NSSTA") {
    return <span className={cn("text-[12px] text-muted-foreground", className)}>NSSTA programme · nomination through your division</span>;
  }
  if (!synced) {
    return <span className={cn("text-[12px] text-muted-foreground", className)}>Enrolment opens once the iGOT catalogue is synced</span>;
  }

  async function call(path: string, body?: object) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "iGOT request failed");
        return;
      }
      if (Array.isArray(data.newlyCompleted) && data.newlyCompleted.length > 0) {
        setMessage(`Completion synced — ${data.recomputedCompetencies} competency score${data.recomputedCompetencies === 1 ? "" : "s"} updated.`);
      }
      startTransition(() => router.refresh());
    } catch {
      setMessage("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;
  const buttonClass =
    "rounded-[8px] px-[12px] py-[6px] text-[13px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={cn("flex flex-col gap-[8px]", className)}>
      {!progress ? (
        <button
          type="button"
          disabled={working}
          onClick={() => call("/api/igot/enrol", { courseId })}
          className={cn(buttonClass, "w-fit bg-[color:var(--color-accent)] text-white shadow-[var(--shadow-cta)] hover:brightness-110")}
        >
          {working ? "Enrolling…" : "Enrol on iGOT"}
        </button>
      ) : progress.status === "COMPLETED" ? (
        <span className="inline-flex w-fit items-center gap-[6px] rounded-[8px] bg-[color:var(--color-grow-bg)] px-[10px] py-[5px] text-[12px] font-medium text-[color:var(--color-grow)]">
          <Check className="size-[13px]" aria-hidden /> Completed on iGOT · counted as evidence
        </span>
      ) : (
        <>
          <div className="flex items-center gap-[10px]">
            <div className="h-[4px] flex-1 min-w-[120px] max-w-[240px] overflow-hidden rounded-full bg-[color:var(--color-border-resting)]" role="progressbar" aria-valuenow={progress.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="iGOT course progress">
              <div className="h-full rounded-full bg-[color:var(--color-accent)] transition-[width]" style={{ width: `${progress.progressPct}%` }} />
            </div>
            <span className="num text-[12px] text-muted-foreground">{progress.progressPct}%</span>
          </div>
          <div className="flex flex-wrap gap-[6px]">
            <button type="button" disabled={working} onClick={() => call("/api/igot/progress")} className={cn(buttonClass, "border border-[color:var(--color-border-hover)] text-foreground hover:bg-[color:var(--color-canvas)]")}>
              {working ? "Syncing…" : "Sync progress"}
            </button>
            {mockMode && (
              <>
                <button type="button" disabled={working} onClick={() => call("/api/igot/simulate", { courseId, progressPct: Math.min(100, progress.progressPct + 50) })} className={cn(buttonClass, "border border-dashed border-[color:var(--color-border-hover)] text-muted-foreground hover:text-foreground")} title="Mock iGOT only — advances simulated progress, then runs the real sync">
                  Simulate +50%
                </button>
                <button type="button" disabled={working} onClick={() => call("/api/igot/simulate", { courseId, progressPct: 100 })} className={cn(buttonClass, "border border-dashed border-[color:var(--color-border-hover)] text-muted-foreground hover:text-foreground")} title="Mock iGOT only — marks the simulated enrolment complete, then runs the real sync">
                  Simulate completion
                </button>
              </>
            )}
          </div>
        </>
      )}
      {message && <p className="text-[12px] text-muted-foreground" role="status">{message}</p>}
    </div>
  );
}
