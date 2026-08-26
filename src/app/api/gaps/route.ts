import { NextResponse } from "next/server";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { loadGapAnalysis } from "@/lib/gap-reasoning/load-gap-analysis";

// Backs the learner gap dashboard with real, freshly computed SkillGap rows.
// Severity, gapSize, and ordering come straight from the pure Skill Gap
// Engine (src/lib/engines/gap.ts); the `reason` string is LLM-authored (or a
// deterministic fallback on AI failure) and generated only after severity
// was already fixed. Recomputes and upserts on every GET so the dashboard
// always reflects the latest measured competency levels.
export async function GET() {
  try {
    const session = await requireRoleApi(["LEARNER", "TRAINER", "ADMIN"]);

    const data = await loadGapAnalysis(session.user.id);
    if (!data) {
      return NextResponse.json(
        { error: "No job role assigned — gap analysis requires a role's target competency vector." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      gaps: data.gaps.map((g) => ({
        competencyId: g.competencyId,
        competencyName: g.competencyName,
        domainName: g.domainName,
        currentLevel: g.currentLevel,
        requiredLevel: g.requiredLevel,
        gapSize: g.gapSize,
        weighted: g.weighted,
        severity: g.severity,
        criticalOverride: g.criticalOverride,
        reason: data.reasons[g.competencyId],
      })),
      unknown: data.unknown.map((u) => ({
        competencyId: u.competencyId,
        competencyName: u.competencyName,
        domainName: u.domainName,
        requiredLevel: u.requiredLevel,
      })),
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
