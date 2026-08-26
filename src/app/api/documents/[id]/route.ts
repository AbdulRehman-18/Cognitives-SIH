import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";

// Lightweight status endpoint the trainer UI polls while a document is
// processing, so ProcessingState reflects the real Document.processingStatus
// rather than a client-side guess.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi("TRAINER");
    const { id } = await params;

    const document = await db.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (document.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Not your document" }, { status: 403 });
    }

    return NextResponse.json({
      id: document.id,
      processingStatus: document.processingStatus,
      chunkCount: document.chunkCount,
      errorMessage: document.errorMessage,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
