import "server-only";

import { db } from "@/lib/db/client";
import { computeGapAnalysis, type GapInput } from "@/lib/engines/gap";
import { generateGapReasons, fallbackGapReason } from "@/lib/gap-reasoning/generate-reason";

// Assembles GapInput rows from the database for one user, runs them through
// the pure Skill Gap Engine, generates plain-language reasons for the
// resulting gaps (AFTER severity is fixed), and persists the result to
// SkillGap. This module is the bridge between the DB and the pure engine —
// it is NOT under src/lib/engines/ because it imports src/lib/ai/
// (transitively, via generate-reason.ts) and touches the database.

export interface GapDashboardData {
  gaps: Awaited<ReturnType<typeof computeGapAnalysis>>["gaps"];
  unknown: Awaited<ReturnType<typeof computeGapAnalysis>>["unknown"];
  reasons: Record<string, string>;
}

/**
 * Loads a user's role-target competency vector, their current measured
 * levels, and department priorities, then computes the gap analysis and
 * generates reasons. Returns null if the user has no assigned job role (a
 * role's RoleCompetency rows are what define "required level" — without a
 * role there is nothing to compare against).
 */
export async function loadGapAnalysis(userId: string): Promise<GapDashboardData | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { roleId: true, departmentId: true },
  });

  if (!user?.roleId) return null;

  const [roleCompetencies, userCompetencies, departmentPriorities] = await Promise.all([
    db.roleCompetency.findMany({
      where: { roleId: user.roleId },
      include: { competency: { include: { domain: true } } },
    }),
    db.userCompetency.findMany({ where: { userId } }),
    user.departmentId
      ? db.departmentPriority.findMany({ where: { departmentId: user.departmentId } })
      : Promise.resolve([]),
  ]);

  const userCompetencyByCompetencyId = new Map(userCompetencies.map((uc) => [uc.competencyId, uc]));
  const priorityByCompetencyId = new Map(departmentPriorities.map((dp) => [dp.competencyId, dp]));

  const inputs: GapInput[] = roleCompetencies.map((rc) => {
    const uc = userCompetencyByCompetencyId.get(rc.competencyId);
    const currentScore = uc?.currentScore != null ? Number(uc.currentScore) : null;
    const priority = priorityByCompetencyId.get(rc.competencyId);

    return {
      competencyId: rc.competencyId,
      competencyName: rc.competency.name,
      domainName: rc.competency.domain.name,
      // The engine works in 1-5 level units; currentScore is the 0-100 scale
      // scoreCompetency() produces. level = ceil(current / 20), matching
      // competency.ts exactly, applied here since we only have the persisted
      // 0-100 score in UserCompetency.
      currentLevel: currentScore === null ? null : Math.max(1, Math.min(5, Math.ceil(currentScore / 20))),
      requiredLevel: rc.requiredLevel,
      roleWeight: Number(rc.weight),
      departmentPriority: priority ? Number(priority.priority) : 0,
    };
  });

  const { gaps, unknown } = computeGapAnalysis(inputs);

  const reasonResults = await generateGapReasons(gaps);
  const reasons: Record<string, string> = {};
  for (const r of reasonResults) {
    reasons[r.competencyId] = r.reason;
  }

  await persistGaps(userId, gaps, reasons);

  return { gaps, unknown, reasons };
}

/**
 * Upserts each computed gap into SkillGap, keyed on (userId, competencyId).
 * Severity, gapSize, and priorityScore are exactly what the engine computed
 * — never recomputed or overridden by this persistence step. `reason` is the
 * LLM-authored (or deterministic-fallback) sentence, written only after
 * severity was already fixed.
 */
async function persistGaps(
  userId: string,
  gaps: Awaited<ReturnType<typeof computeGapAnalysis>>["gaps"],
  reasons: Record<string, string>,
): Promise<void> {
  await Promise.all(
    gaps.map((gap) => {
      const reason = reasons[gap.competencyId] ?? fallbackGapReason(gap);
      return db.skillGap.upsert({
        where: { userId_competencyId: { userId, competencyId: gap.competencyId } },
        create: {
          userId,
          competencyId: gap.competencyId,
          currentLevel: gap.currentLevel,
          requiredLevel: gap.requiredLevel,
          gapSize: gap.gapSize,
          severity: gap.severity,
          reason,
          priorityScore: gap.weighted,
        },
        update: {
          currentLevel: gap.currentLevel,
          requiredLevel: gap.requiredLevel,
          gapSize: gap.gapSize,
          severity: gap.severity,
          reason,
          priorityScore: gap.weighted,
        },
      });
    }),
  );
}
