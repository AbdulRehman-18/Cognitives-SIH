// Skill Gap Engine — src/lib/engines/gap.ts
//
// Normative reference: docs/engine-specifications.md §2. This file is pure:
// structured input in, number/classification out. No `import` from
// src/lib/ai/ (enforced by eslint.config.mjs + tests/architecture), no
// network calls, no Date.now() inside the math.
//
// PRD §2.5: the LLM never decides a number. Severity is fully computed here,
// before any language is generated. The LLM only writes a plain-language
// `reason` afterward, over the already-fixed numbers (see
// src/lib/gap-reasoning/ — deliberately NOT under lib/engines/).

// ─────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────

export interface GapInput {
  competencyId: string;
  competencyName: string;
  domainName: string;
  /** 1..5, or null when the Competency Engine has zero evidence ("Not yet assessed"). */
  currentLevel: number | null;
  /** 1..5 — the role's target level for this competency (RoleCompetency.requiredLevel). */
  requiredLevel: number;
  /** 0..1 — RoleCompetency.weight, how important this competency is to the role. */
  roleWeight: number;
  /** 0..1 — DepartmentPriority.priority for this competency. */
  departmentPriority: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Severity thresholds (exported so a judge can be shown the literal rule)
// ─────────────────────────────────────────────────────────────────────────

export const SEVERITY_THRESHOLDS = { CRITICAL: 3.0, HIGH: 2.0, MEDIUM: 1.0 } as const;

/** The (gapSize >= 2 AND roleWeight >= 0.9) override that also forces CRITICAL. */
export const CRITICAL_OVERRIDE = { gapSize: 2, roleWeight: 0.9 } as const;

export type GapSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SEVERITY_RANK: Record<GapSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

// ─────────────────────────────────────────────────────────────────────────
// Outputs
// ─────────────────────────────────────────────────────────────────────────

export interface ComputedGap {
  competencyId: string;
  competencyName: string;
  domainName: string;
  currentLevel: number;
  requiredLevel: number;
  roleWeight: number;
  departmentPriority: number;
  gapSize: number;
  /** gapSize × roleWeight × departmentPriority — the number severity is derived from. */
  weighted: number;
  severity: GapSeverity;
  /** True only when the CRITICAL override path fired (weighted alone did not reach 3.0). */
  criticalOverride: boolean;
}

export interface UnknownCompetency {
  competencyId: string;
  competencyName: string;
  domainName: string;
  currentLevel: null;
  requiredLevel: number;
  roleWeight: number;
  departmentPriority: number;
  /** Always "UNKNOWN" — not a gap, not a severity. Surfaced as "Assess this to find out." */
  status: "UNKNOWN";
}

export interface GapAnalysisResult {
  /** Sorted: severity rank asc, then weighted desc, then competencyId asc. */
  gaps: ComputedGap[];
  /** currentLevel === null entries — never scored, never a fabricated gap. */
  unknown: UnknownCompetency[];
}

// ─────────────────────────────────────────────────────────────────────────
// Core formula
// ─────────────────────────────────────────────────────────────────────────

/** max(0, requiredLevel − currentLevel), in level units. */
export function computeGapSize(currentLevel: number, requiredLevel: number): number {
  return Math.max(0, requiredLevel - currentLevel);
}

/** gapSize × roleWeight × departmentPriority. */
export function computeWeighted(
  gapSize: number,
  roleWeight: number,
  departmentPriority: number,
): number {
  return gapSize * roleWeight * departmentPriority;
}

/**
 * Classifies a computed `weighted` value (plus the raw gapSize/roleWeight,
 * needed for the CRITICAL override path) into a GapSeverity.
 *
 * CRITICAL  weighted >= 3.0  OR (gapSize >= 2 AND roleWeight >= 0.9)
 * HIGH      weighted >= 2.0
 * MEDIUM    weighted >= 1.0
 * LOW       weighted >  0
 *
 * A weighted of exactly 0 (gapSize 0, i.e. currentLevel already meets or
 * exceeds requiredLevel) never reaches this function's LOW branch in
 * practice, because computeGapAnalysis() only classifies entries with
 * gapSize > 0 — see the "no gap" short-circuit there.
 */
export function classifySeverity(
  weighted: number,
  gapSize: number,
  roleWeight: number,
): { severity: GapSeverity; criticalOverride: boolean } {
  const overrideFires = gapSize >= CRITICAL_OVERRIDE.gapSize && roleWeight >= CRITICAL_OVERRIDE.roleWeight;

  if (weighted >= SEVERITY_THRESHOLDS.CRITICAL) {
    return { severity: "CRITICAL", criticalOverride: false };
  }
  if (overrideFires) {
    return { severity: "CRITICAL", criticalOverride: true };
  }
  if (weighted >= SEVERITY_THRESHOLDS.HIGH) {
    return { severity: "HIGH", criticalOverride: false };
  }
  if (weighted >= SEVERITY_THRESHOLDS.MEDIUM) {
    return { severity: "MEDIUM", criticalOverride: false };
  }
  return { severity: "LOW", criticalOverride: false };
}

// ─────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────

/**
 * The Skill Gap Engine's single entry point. Pure function: same input
 * always produces byte-identical output (see tests/engines/gap.test.ts).
 *
 * `currentLevel === null` is NOT a gap — it's an unknown. Treating
 * unmeasured as a maximum gap would fabricate a critical shortage from
 * missing data (engine-specifications §2), so those entries are routed to
 * `unknown` instead of being scored at all.
 *
 * `gaps` is ordered by severity rank, then `weighted` desc, then
 * `competencyId` asc — the final tiebreak keeps ordering stable across
 * identical inputs supplied in different array orders, which is required
 * for the determinism tests.
 */
export function computeGapAnalysis(inputs: GapInput[]): GapAnalysisResult {
  const gaps: ComputedGap[] = [];
  const unknown: UnknownCompetency[] = [];

  for (const input of inputs) {
    if (input.currentLevel === null) {
      unknown.push({
        competencyId: input.competencyId,
        competencyName: input.competencyName,
        domainName: input.domainName,
        currentLevel: null,
        requiredLevel: input.requiredLevel,
        roleWeight: input.roleWeight,
        departmentPriority: input.departmentPriority,
        status: "UNKNOWN",
      });
      continue;
    }

    const gapSize = computeGapSize(input.currentLevel, input.requiredLevel);
    // gapSize 0 means currentLevel already meets/exceeds the role target —
    // there is nothing to flag. Not included in `gaps` at all (not even as
    // a LOW-severity zero), since a zero-size gap is not a gap.
    if (gapSize === 0) continue;

    const weighted = computeWeighted(gapSize, input.roleWeight, input.departmentPriority);
    const { severity, criticalOverride } = classifySeverity(weighted, gapSize, input.roleWeight);

    gaps.push({
      competencyId: input.competencyId,
      competencyName: input.competencyName,
      domainName: input.domainName,
      currentLevel: input.currentLevel,
      requiredLevel: input.requiredLevel,
      roleWeight: input.roleWeight,
      departmentPriority: input.departmentPriority,
      gapSize,
      weighted,
      severity,
      criticalOverride,
    });
  }

  gaps.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    if (b.weighted !== a.weighted) return b.weighted - a.weighted;
    return a.competencyId < b.competencyId ? -1 : a.competencyId > b.competencyId ? 1 : 0;
  });

  unknown.sort((a, b) => (a.competencyId < b.competencyId ? -1 : a.competencyId > b.competencyId ? 1 : 0));

  return { gaps, unknown };
}
