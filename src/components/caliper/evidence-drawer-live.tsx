"use client";

import * as React from "react";
import { EvidenceDrawer, type EvidenceRow } from "@/components/caliper/evidence-drawer";
import { Button } from "@/components/ui/button";

interface EvidenceResponse {
  competencyName: string;
  currentScore: number | null;
  evidence: EvidenceRow[];
}

/**
 * Wires EvidenceDrawer to real CompetencyEvidence rows via
 * GET /api/competencies/[id]/evidence, fetched lazily on first open. Phase 1
 * shipped EvidenceDrawer against fixture data; this is the real-data wiring
 * for Phase 2 — the formula it displays matches exactly what
 * src/lib/engines/competency.ts computed, because the API route returns the
 * persisted CompetencyEvidence rows verbatim (never recomputed).
 */
export function EvidenceDrawerLive({
  competencyId,
  competencyName,
  currentScore,
  trigger,
}: {
  competencyId: string;
  competencyName: string;
  currentScore: number | null;
  trigger?: React.ReactNode;
}) {
  const [data, setData] = React.useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const fetchedRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/competencies/${competencyId}/evidence`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [competencyId]);

  return (
    <div onPointerDown={load} onFocus={load}>
      <EvidenceDrawer
        competencyName={competencyName}
        currentScore={data?.currentScore ?? currentScore}
        evidence={data?.evidence ?? []}
        trigger={
          trigger ?? (
            <Button variant="outline" size="sm">
              {loading ? "Loading evidence…" : "View evidence"}
            </Button>
          )
        }
      />
    </div>
  );
}
