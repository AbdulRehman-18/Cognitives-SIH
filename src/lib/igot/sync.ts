import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { competenciesAffectedBy, recomputeUserCompetencies } from "@/lib/competency/recompute";
import { loadGapAnalysis } from "@/lib/gap-reasoning/load-gap-analysis";
import { embedPendingCourses } from "@/lib/rag/embed-courses";
import { getIgotClient, IgotError } from "./index";

// iGOT Karmayogi sync — src/lib/igot/sync.ts
//
// Three flows, all going through the IgotClient interface (mock or live):
//   1. syncCatalog     — upsert iGOT courses into Course, embed new ones.
//   2. enrolInCourse   — enrol on iGOT, mirror as LearningProgress.
//   3. syncUserProgress — pull enrolment progress into LearningProgress; each
//      NEW completion triggers a Competency Engine recompute (the course
//      becomes COURSE_COMPLETION evidence) and a gap refresh.
// No LLM is involved in any number written here.

export interface CatalogSyncResult {
  added: number;
  updated: number;
  skipped: string[];
  embedded: number;
  embedError: string | null;
}

export async function syncCatalog(): Promise<CatalogSyncResult> {
  const client = getIgotClient();
  const [remote, competencies] = await Promise.all([
    client.listCourses(),
    db.competency.findMany({ select: { id: true, name: true } }),
  ]);
  const competencyIdByName = new Map(competencies.map((c) => [c.name.toLowerCase(), c.id]));
  const now = new Date();
  const result: CatalogSyncResult = { added: 0, updated: 0, skipped: [], embedded: 0, embedError: null };

  for (const course of remote) {
    const competencyIds = course.competencyNames
      .map((n) => competencyIdByName.get(n.toLowerCase()))
      .filter((id): id is string => Boolean(id));
    // A course that maps to no framework competency can't close any gap —
    // skip rather than store an unrecommendable row.
    if (competencyIds.length === 0) {
      result.skipped.push(course.title);
      continue;
    }
    const data = {
      title: course.title,
      description: course.description,
      competencies: competencyIds,
      level: course.level,
      durationHours: new Prisma.Decimal(course.durationHours),
      externalUrl: course.url,
      language: course.language,
      lastSyncedAt: now,
    };
    // Match by externalId first; fall back to the seeded row with the same
    // title so the first sync adopts it instead of duplicating it.
    const existing =
      (await db.course.findUnique({ where: { externalId: course.externalId }, select: { id: true, title: true, description: true } })) ??
      (await db.course.findFirst({ where: { source: "IGOT", title: course.title, externalId: null }, select: { id: true, title: true, description: true } }));
    if (existing) {
      const textChanged = existing.title !== course.title || existing.description !== course.description;
      await db.course.update({ where: { id: existing.id }, data: { ...data, externalId: course.externalId } });
      // Changed text invalidates the embedding; clear it so it's re-embedded.
      if (textChanged) await db.$executeRaw`UPDATE "Course" SET embedding = NULL WHERE id = ${existing.id}`;
      result.updated++;
    } else {
      await db.course.create({ data: { ...data, source: "IGOT", externalId: course.externalId } });
      result.added++;
    }
  }

  try {
    result.embedded = await embedPendingCourses(db);
  } catch (error) {
    // Catalog rows are still valid without embeddings (semantic similarity
    // term falls back); report rather than fail the whole sync.
    result.embedError = error instanceof Error ? error.message : String(error);
  }
  return result;
}

/** The learner's current score on each competency, captured as the effectiveness baseline. */
async function baselineFor(userId: string, competencyIds: string[]): Promise<Record<string, number | null>> {
  const rows = await db.userCompetency.findMany({
    where: { userId, competencyId: { in: competencyIds } },
    select: { competencyId: true, currentScore: true },
  });
  const byId = new Map(rows.map((r) => [r.competencyId, r.currentScore === null ? null : Number(r.currentScore)]));
  return Object.fromEntries(competencyIds.map((id) => [id, byId.get(id) ?? null]));
}

async function igotUserIdFor(userId: string): Promise<string> {
  const profile = await db.officerProfile.findUnique({ where: { userId }, select: { igotUserId: true } });
  return profile?.igotUserId ?? userId;
}

export async function enrolInCourse(userId: string, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, source: true, externalId: true, competencies: true } });
  if (!course) throw new IgotError("Course not found", 404);
  if (course.source !== "IGOT" || !course.externalId) {
    throw new IgotError("Only iGOT Karmayogi courses can be enrolled here. Sync the iGOT catalog first.", 400);
  }
  const { enrolmentId } = await getIgotClient().enrol(await igotUserIdFor(userId), course.externalId);
  return db.learningProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      status: "IN_PROGRESS",
      enrolledAt: new Date(),
      externalEnrolmentId: enrolmentId,
      baselineJson: await baselineFor(userId, course.competencies),
    },
    update: { externalEnrolmentId: enrolmentId },
  });
}

export interface ProgressSyncResult {
  updated: number;
  newlyCompleted: string[];
  recomputedCompetencies: number;
}

export async function syncUserProgress(userId: string): Promise<ProgressSyncResult> {
  const enrolments = await getIgotClient().getEnrolments(await igotUserIdFor(userId));
  const courses = await db.course.findMany({
    where: { externalId: { in: enrolments.map((e) => e.courseExternalId) } },
    select: { id: true, externalId: true, title: true, competencies: true },
  });
  const courseByExternalId = new Map(courses.map((c) => [c.externalId!, c]));
  const existing = await db.learningProgress.findMany({ where: { userId, courseId: { in: courses.map((c) => c.id) } } });
  const existingByCourseId = new Map(existing.map((p) => [p.courseId, p]));

  const result: ProgressSyncResult = { updated: 0, newlyCompleted: [], recomputedCompetencies: 0 };
  const touchedCompetencies: string[] = [];

  for (const enrolment of enrolments) {
    const course = courseByExternalId.get(enrolment.courseExternalId);
    if (!course) continue; // enrolled on a course outside the synced catalog
    const completed = enrolment.completedAt !== null || enrolment.progressPct >= 100;
    const status = completed ? "COMPLETED" : "IN_PROGRESS";
    const prior = existingByCourseId.get(course.id);
    const data = {
      status,
      progressPct: new Prisma.Decimal(completed ? 100 : enrolment.progressPct),
      completedAt: completed ? (enrolment.completedAt ?? new Date()) : null,
      externalEnrolmentId: enrolment.enrolmentId,
    };
    await db.learningProgress.upsert({
      where: { userId_courseId: { userId, courseId: course.id } },
      // First seen via sync (enrolled directly on iGOT): baseline is today's score.
      create: { userId, courseId: course.id, enrolledAt: new Date(), baselineJson: prior ? undefined : await baselineFor(userId, course.competencies), ...data },
      update: data,
    });
    result.updated++;
    if (completed && prior?.status !== "COMPLETED") {
      result.newlyCompleted.push(course.title);
      touchedCompetencies.push(...course.competencies);
    }
  }

  if (touchedCompetencies.length > 0) {
    const affected = await competenciesAffectedBy(touchedCompetencies);
    const recomputed = await recomputeUserCompetencies(userId, affected);
    result.recomputedCompetencies = recomputed.filter((r) => r.result.current !== null).length;
    // Refresh stored gaps now (deterministic reason text) so admin analytics
    // see the change without waiting for the learner's next page view.
    await loadGapAnalysis(userId, { withAiReasons: false });
    await db.auditLog.create({
      data: {
        actorId: userId,
        action: "IGOT_COMPLETION_SYNCED",
        resourceType: "LearningProgress",
        resourceId: userId,
        metadataJson: { courses: result.newlyCompleted, competencies: affected },
      },
    });
  }
  return result;
}

/** Cron entry point: syncs every learner with an open iGOT enrolment. */
export async function syncAllProgress(): Promise<{ users: number; newlyCompleted: number; failed: number }> {
  const rows = await db.learningProgress.findMany({
    where: { status: { not: "COMPLETED" }, externalEnrolmentId: { not: null } },
    distinct: ["userId"],
    select: { userId: true },
  });
  let newlyCompleted = 0;
  let failed = 0;
  for (const { userId } of rows) {
    try {
      newlyCompleted += (await syncUserProgress(userId)).newlyCompleted.length;
    } catch (error) {
      failed++;
      console.error(`[igot] progress sync failed for ${userId}`, error);
    }
  }
  return { users: rows.length, newlyCompleted, failed };
}
