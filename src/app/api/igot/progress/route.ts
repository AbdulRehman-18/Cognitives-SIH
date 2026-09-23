import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth/rbac";
import { syncAllProgress, syncUserProgress } from "@/lib/igot/sync";
import { igotErrorResponse } from "../errors";

export const maxDuration = 60;

// Learner: pull my iGOT enrolment progress now.
export async function POST() {
  try {
    const session = await requireRoleApi("LEARNER");
    return NextResponse.json(await syncUserProgress(session.user.id));
  } catch (error) {
    return igotErrorResponse(error);
  }
}

// Vercel Cron (vercel.json): nightly sync for every learner with an open
// enrolment. Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await syncAllProgress());
}
