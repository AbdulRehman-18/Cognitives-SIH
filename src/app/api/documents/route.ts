import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";

// Lists the caller's own documents, most recent first — trainers see their
// shared course material, learners their personal study uploads. Polled by
// both upload UIs for live processing status without a full page reload.
export async function GET() {
  try {
    const session = await requireRoleApi(["TRAINER", "LEARNER"]);

    const documents = await db.document.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        fileName: true,
        scope: true,
        processingStatus: true,
        errorMessage: true,
        chunkCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
