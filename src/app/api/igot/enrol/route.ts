import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireRoleApi } from "@/lib/auth/rbac";
import { enrolInCourse } from "@/lib/igot/sync";
import { igotErrorResponse } from "../errors";

const bodySchema = z.object({ courseId: z.string().min(1) });

// Learner: enrol on a recommended iGOT course; mirrored into LearningProgress.
export async function POST(request: Request) {
  try {
    const session = await requireRoleApi("LEARNER");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "courseId is required" }, { status: 400 });

    const progress = await enrolInCourse(session.user.id, parsed.data.courseId);
    await db.auditLog.create({
      data: { actorId: session.user.id, action: "IGOT_ENROLLED", resourceType: "Course", resourceId: parsed.data.courseId },
    });
    return NextResponse.json({ status: progress.status, progressPct: Number(progress.progressPct) });
  } catch (error) {
    return igotErrorResponse(error);
  }
}
