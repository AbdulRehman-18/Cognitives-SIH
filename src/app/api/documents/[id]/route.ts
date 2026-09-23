import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { UTApi } from "uploadthing/server";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";

// Lightweight status endpoint the trainer UI polls while a document is
// processing, so ProcessingState reflects the real Document.processingStatus
// rather than a client-side guess.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi(["TRAINER", "LEARNER"]);
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

// Owner-only delete: removes the stored original from UploadThing, then the
// Document row (its chunks cascade; questions citing them keep their text
// with the source link cleared).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi(["TRAINER", "LEARNER"]);
    const { id } = await params;

    const document = await db.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (document.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Not your document" }, { status: 403 });
    }

    try {
      await new UTApi().deleteFiles(document.uploadThingKey);
    } catch (error) {
      // The DB row is the source of truth for retrieval; an orphaned stored
      // file is harmless, so log and continue rather than block the delete.
      console.error(`[documents] UploadThing delete failed for ${id}`, error);
    }
    await db.document.delete({ where: { id } });
    await db.auditLog.create({
      data: { actorId: session.user.id, action: "DOCUMENT_DELETED", resourceType: "Document", resourceId: id, metadataJson: { scope: document.scope } },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
