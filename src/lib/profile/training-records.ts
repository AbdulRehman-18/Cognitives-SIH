import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { competenciesAffectedBy, recomputeUserCompetencies } from "@/lib/competency/recompute";
import { getIgotClient } from "@/lib/igot";
import type { PriorTrainingInput } from "@/lib/validation/onboarding";

// Training records — src/lib/profile/training-records.ts
//
// Self-declared prior trainings and iGOT history imports. Both only ADD
// source records; every score change still comes from the Competency Engine
// via recomputeUserCompetencies (training is the 0.25-weight, recency-decayed
// term — it can inform a score but never dominate an assessment).

/** "Postgraduate" + "Statistics" → "Postgraduate — Statistics". */
export function formatEducation(level?: string, field?: string): string | null {
  if (!level) return null;
  return field ? `${level} — ${field}` : level;
}

/** "YYYY-MM" → the 15th of that month (UTC), so month-precision dates never drift across a boundary. */
export function monthToDate(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15));
}

export async function recomputeForTaggedCompetencies(userId: string, competencyIds: string[]): Promise<number> {
  if (competencyIds.length === 0) return 0;
  const affected = await competenciesAffectedBy([...new Set(competencyIds)]);
  const results = await recomputeUserCompetencies(userId, affected);
  return results.filter((r) => r.result.current !== null).length;
}

export async function addPriorTrainings(userId: string, items: PriorTrainingInput[]): Promise<void> {
  if (items.length === 0) return;
  const valid = new Set(
    (await db.competency.findMany({ where: { id: { in: items.flatMap((i) => i.competencyIds) } }, select: { id: true } })).map((c) => c.id),
  );
  await db.priorTraining.createMany({
    data: items.map((item) => ({
      userId,
      title: item.title,
      provider: item.provider ?? null,
      completedAt: monthToDate(item.completedMonth),
      competencyIds: item.competencyIds.filter((id) => valid.has(id)),
      source: "SELF_DECLARED" as const,
    })),
  });
}

export interface IgotImportResult {
  imported: number;
  alreadyPresent: number;
  competencyIds: string[];
}

/**
 * Imports the officer's completed-course history from iGOT Karmayogi.
 * Courses that exist in the synced catalog become COMPLETED LearningProgress
 * rows (COURSE_COMPLETION evidence, and no longer recommended); anything
 * outside the catalog becomes a PriorTraining{source: IGOT}. Idempotent.
 */
export async function importIgotHistory(userId: string): Promise<IgotImportResult> {
  const profile = await getIgotClient().getUserProfile(userId);
  const result: IgotImportResult = { imported: 0, alreadyPresent: 0, competencyIds: [] };
  if (!profile) return result;

  await db.officerProfile.upsert({
    where: { userId },
    update: { igotUserId: profile.igotUserId },
    create: { userId, igotUserId: profile.igotUserId },
  });

  const competencies = await db.competency.findMany({ select: { id: true, name: true } });
  const idByName = new Map(competencies.map((c) => [c.name.toLowerCase(), c.id]));

  for (const course of profile.completedCourses) {
    const competencyIds = course.competencyNames.map((n) => idByName.get(n.toLowerCase())).filter((id): id is string => Boolean(id));
    const catalogCourse = await db.course.findUnique({ where: { externalId: course.externalId }, select: { id: true, competencies: true } });

    if (catalogCourse) {
      const existing = await db.learningProgress.findUnique({ where: { userId_courseId: { userId, courseId: catalogCourse.id } } });
      if (existing?.status === "COMPLETED") {
        result.alreadyPresent++;
        continue;
      }
      await db.learningProgress.upsert({
        where: { userId_courseId: { userId, courseId: catalogCourse.id } },
        create: { userId, courseId: catalogCourse.id, status: "COMPLETED", progressPct: new Prisma.Decimal(100), enrolledAt: course.completedAt, completedAt: course.completedAt },
        update: { status: "COMPLETED", progressPct: new Prisma.Decimal(100), completedAt: course.completedAt },
      });
      result.competencyIds.push(...catalogCourse.competencies);
    } else {
      const existing = await db.priorTraining.findFirst({ where: { userId, source: "IGOT", title: course.title } });
      if (existing) {
        result.alreadyPresent++;
        continue;
      }
      await db.priorTraining.create({
        data: { userId, title: course.title, provider: course.provider, completedAt: course.completedAt, competencyIds, source: "IGOT" },
      });
      result.competencyIds.push(...competencyIds);
    }
    result.imported++;
  }
  return result;
}

const COMPLETENESS_FIELDS = ["designation", "department", "jobRole", "education", "yearsExperience", "currentAssignment"] as const;

/** Share of profile fields filled, plus whether any training record exists — 0..100, drives enrichment prompts. */
export async function refreshProfileCompleteness(userId: string): Promise<number> {
  const [profile, trainings, completions] = await Promise.all([
    db.officerProfile.findUnique({ where: { userId } }),
    db.priorTraining.count({ where: { userId } }),
    db.learningProgress.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  if (!profile) return 0;
  const filled = COMPLETENESS_FIELDS.filter((f) => profile[f] !== null && profile[f] !== "").length + (trainings + completions > 0 ? 1 : 0);
  const completeness = Math.round((filled / (COMPLETENESS_FIELDS.length + 1)) * 100);
  await db.officerProfile.update({ where: { userId }, data: { completeness } });
  return completeness;
}
