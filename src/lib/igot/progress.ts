import "server-only";

import { db } from "@/lib/db/client";
import type { IgotProgressState } from "@/components/igot/igot-course-action";

export interface CourseIgotState {
  synced: boolean;
  progress: IgotProgressState | null;
  enrolledAt: string | null;
  /** When progress was last pulled from iGOT. */
  syncedAt: string | null;
}

/** Per-course iGOT sync + enrolment state for one learner, for IgotCourseAction. */
export async function loadCourseIgotState(userId: string, courseIds: string[]): Promise<Map<string, CourseIgotState>> {
  const [courses, progress] = await Promise.all([
    db.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, externalId: true } }),
    db.learningProgress.findMany({ where: { userId, courseId: { in: courseIds } } }),
  ]);
  const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));
  return new Map(
    courses.map((c) => {
      const p = progressByCourse.get(c.id);
      return [
        c.id,
        {
          synced: Boolean(c.externalId),
          progress: p
            ? { status: p.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS", progressPct: Math.round(Number(p.progressPct)) }
            : null,
          enrolledAt: p?.enrolledAt?.toISOString() ?? null,
          syncedAt: p?.updatedAt.toISOString() ?? null,
        },
      ];
    }),
  );
}
