"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SEVERITY_THRESHOLDS, CRITICAL_OVERRIDE } from "@/lib/engines/gap";

/**
 * The judge-facing feature for the Skill Gap Engine — mirrors EvidenceDrawer.
 * Opens to show the literal severity rule from src/lib/engines/gap.ts, not a
 * paraphrase, so "how was that computed?" has a real, inspectable answer
 * (engine-specifications §2). The thresholds rendered here are imported
 * directly from the engine, so this disclosure can never drift out of sync
 * with the code that actually classifies gaps.
 */
export function SeverityFormulaDisclosure({ trigger }: { trigger?: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="outline" size="sm">
              How is this calculated?
            </Button>
          )
        }
      />
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>How severity is calculated</SheetTitle>
          <SheetDescription>
            A fixed formula, not a judgment call — every gap below is classified by this exact rule.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <div>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Step 1 — the gap size
            </h4>
            <pre className="tabular-mono overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground">
{`gapSize  = max(0, requiredLevel − currentLevel)
weighted = gapSize × roleWeight × departmentPriority`}
            </pre>
            <p className="mt-2 text-sm text-muted-foreground">
              <code className="tabular-mono">roleWeight</code> is how important this
              competency is to your job role (0–1). <code className="tabular-mono">departmentPriority</code>{" "}
              is how much your department currently prioritizes it (0–1).
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Step 2 — the severity thresholds
            </h4>
            <pre className="tabular-mono overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground">
{`CRITICAL  weighted ≥ ${SEVERITY_THRESHOLDS.CRITICAL.toFixed(1)}  OR  (gapSize ≥ ${CRITICAL_OVERRIDE.gapSize} AND roleWeight ≥ ${CRITICAL_OVERRIDE.roleWeight})
HIGH      weighted ≥ ${SEVERITY_THRESHOLDS.HIGH.toFixed(1)}
MEDIUM    weighted ≥ ${SEVERITY_THRESHOLDS.MEDIUM.toFixed(1)}
LOW       weighted >  0`}
            </pre>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              What &ldquo;Not yet assessed&rdquo; means
            </h4>
            <p className="text-sm text-muted-foreground">
              A competency with no measured level isn&rsquo;t treated as a gap at
              all — it&rsquo;s shown separately as unknown. Scoring it as a maximum
              gap would fabricate a shortage from missing data, so it never
              enters this formula until it&rsquo;s actually assessed.
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Ordering
            </h4>
            <p className="text-sm text-muted-foreground">
              Gaps are listed by severity first, then by the <code className="tabular-mono">weighted</code> value
              (highest first), then alphabetically by competency — the same
              order every time for the same underlying data.
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              The written reason
            </h4>
            <p className="text-sm text-muted-foreground">
              The one-sentence explanation on each card is written by an AI
              model after severity is already fixed — it explains the number,
              it never chooses it. If AI generation is unavailable, a
              plain template sentence built from the same numbers is shown
              instead, so a gap is never hidden for lack of a reason.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
