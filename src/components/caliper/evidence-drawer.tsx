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
import { cn } from "@/lib/utils";

export interface EvidenceRow {
  id: string;
  sourceType: "ASSESSMENT" | "PRIOR_TRAINING" | "COURSE_COMPLETION";
  sourceLabel: string;
  contribution: number;
  weight: number;
  createdAt: string;
}

export interface EvidenceDrawerProps {
  competencyName: string;
  /** null when there is no computed score yet. */
  currentScore: number | null;
  evidence: EvidenceRow[];
  trigger?: React.ReactNode;
}

const SOURCE_LABEL: Record<EvidenceRow["sourceType"], string> = {
  ASSESSMENT: "Assessment",
  PRIOR_TRAINING: "Prior training",
  COURSE_COMPLETION: "Course completion",
};

/**
 * The judge-facing feature. Opens from any score and shows the exact
 * CompetencyEvidence rows plus the literal formula that combined them —
 * so "how was that computed?" has a real, inspectable answer (PRD §4.3).
 */
export function EvidenceDrawer({
  competencyName,
  currentScore,
  evidence,
  trigger,
}: EvidenceDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button variant="outline" size="sm">
              View evidence
            </Button>
          )
        }
      />
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{competencyName}</SheetTitle>
          <SheetDescription>
            Every score is computed from queryable evidence — never invented.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              Current score
            </span>
            <div className="tabular-mono text-2xl font-semibold text-foreground">
              {currentScore === null ? (
                <span className="text-[color:var(--color-unmeasured)]">
                  Not yet assessed
                </span>
              ) : (
                currentScore.toFixed(1)
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Formula
            </h4>
            <pre className="tabular-mono overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground">
{`score = 100 × ( 0.60 · assessmentScore
              + 0.25 · priorTrainingScore
              + 0.15 · historyScore )
normalized by weights actually present`}
            </pre>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Evidence rows ({evidence.length})
            </h4>
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No evidence recorded yet. This competency will show &ldquo;Not
                yet assessed&rdquo; until a diagnostic, prior training record, or
                completed course contributes a row here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {evidence.map((row) => (
                  <li
                    key={row.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm",
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {SOURCE_LABEL[row.sourceType]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.sourceLabel} ·{" "}
                        {new Date(row.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="tabular-mono text-right text-xs text-muted-foreground">
                      <div>contrib {row.contribution.toFixed(2)}</div>
                      <div>weight {row.weight.toFixed(2)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
