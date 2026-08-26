"use client";

import Link from "next/link";
import { CaliperGauge } from "@/components/caliper/caliper-gauge";
import { ScoreReadout } from "@/components/caliper/score-readout";
import { EvidenceDrawerLive } from "@/components/caliper/evidence-drawer-live";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface CompetencyResult {
  competencyId: string;
  competencyName: string;
  domainName: string;
  current: number | null;
  level: number | null;
  confidence: number | null;
  confidenceBand: string | null;
  displayRange: number | null;
}

function confidenceLabel(result: CompetencyResult): string | undefined {
  if (result.current === null || result.displayRange === null) return undefined;
  return `± ${result.displayRange.toFixed(0)} pts · ${result.confidenceBand?.toLowerCase()} confidence`;
}

/**
 * Results screen: per-competency CaliperGauge + ScoreReadout, each backed by
 * a real EvidenceDrawer reading the CompetencyEvidence rows the submit route
 * just wrote. No bare-percentage headline — every number ships with its
 * confidence range (PRD §5.5), and a competency with zero contributing
 * evidence would show "Not yet assessed" rather than a fabricated 0.
 */
export function AssessmentResults({ results }: { results: CompetencyResult[] }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Your measured results</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Computed by a fixed formula from your answers — every score below
          shows the evidence that produced it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {results.map((r) => (
          <Card key={r.competencyId} className="rounded-md">
            <CardContent className="flex flex-col gap-4">
              <div>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {r.domainName}
                </span>
                <h3 className="text-base font-medium text-foreground">{r.competencyName}</h3>
              </div>

              <CaliperGauge
                value={r.current}
                min={0}
                max={100}
                srLabel={r.competencyName}
                unitLabel="of 100"
              />

              <ScoreReadout
                level={r.level}
                confidenceLabel={confidenceLabel(r)}
                label="Competency level"
              />

              <EvidenceDrawerLive
                competencyId={r.competencyId}
                competencyName={r.competencyName}
                currentScore={r.current}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
