import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";

// Lists the caller's own documents, most recent first. Used by the trainer
// documents UI to poll for live processing status across the whole list
// without a full page reload.
export async function GET() {
  try {
    const session = await requireRoleApi("TRAINER");

    const documents = await db.document.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
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
