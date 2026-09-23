import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireRoleApi } from "@/lib/auth/rbac";
import { getIgotClient, igotMode, MockIgotClient } from "@/lib/igot";
import { syncUserProgress } from "@/lib/igot/sync";
import { igotErrorResponse } from "../errors";

const bodySchema = z.object({ courseId: z.string().min(1), progressPct: z.number().min(0).max(100) });

export const maxDuration = 60;

// MOCK MODE ONLY: advance progress on the simulated iGOT side, then run the
// real progress sync — the same path live iGOT data takes. 404s in live mode.
export async function POST(request: Request) {
  try {
    const session = await requireRoleApi("LEARNER");
    const client = getIgotClient();
    if (igotMode() !== "mock" || !(client instanceof MockIgotClient)) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "courseId and progressPct are required" }, { status: 400 });

    const [course, profile] = await Promise.all([
      db.course.findUnique({ where: { id: parsed.data.courseId }, select: { externalId: true } }),
      db.officerProfile.findUnique({ where: { userId: session.user.id }, select: { igotUserId: true } }),
    ]);
    if (!course?.externalId) return NextResponse.json({ error: "Not an iGOT course" }, { status: 400 });

    await client.simulateProgress(profile?.igotUserId ?? session.user.id, course.externalId, parsed.data.progressPct);
    return NextResponse.json(await syncUserProgress(session.user.id));
  } catch (error) {
    return igotErrorResponse(error);
  }
}
