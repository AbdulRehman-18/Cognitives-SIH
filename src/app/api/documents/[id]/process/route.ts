import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { processDocument } from "@/lib/rag/pipeline";

// Kicks off the extract -> chunk -> embed -> store pipeline for an
// already-uploaded document. RestPlan.md Phase 4: target the full pipeline
// within a 60s budget — the embedding calls dominate, so maxDuration gives
// them headroom (PRD §4.11 performance budgets apply to the interactive
// generation paths; document processing is explicitly given more room).
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi("TRAINER");
    const { id: documentId } = await params;

    const document = await db.document.findUnique({ where: { id: documentId } });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if (document.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Not your document" }, { status: 403 });
    }
    if (document.processingStatus === "READY") {
      return NextResponse.json({ status: "READY", chunkCount: document.chunkCount });
    }

    try {
      await processDocument(documentId);
    } catch (error) {
      // processDocument already persisted Document.processingStatus = FAILED
      // with a stage-specific errorMessage before rethrowing — surface that
      // to the caller rather than a generic 500.
      const message = error instanceof Error ? error.message : "Processing failed.";
      return NextResponse.json({ error: message, status: "FAILED" }, { status: 502 });
    }

    const updated = await db.document.findUnique({ where: { id: documentId } });

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DOCUMENT_PROCESSED",
        resourceType: "Document",
        resourceId: documentId,
        metadataJson: { chunkCount: updated?.chunkCount ?? 0 },
      },
    });

    return NextResponse.json({ status: updated?.processingStatus, chunkCount: updated?.chunkCount });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
