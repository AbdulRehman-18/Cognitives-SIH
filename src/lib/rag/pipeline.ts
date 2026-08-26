import "server-only";

import { db } from "@/lib/db/client";
import { extractText } from "@/lib/rag/extract";
import { chunkText } from "@/lib/rag/chunk";
import { embedDocumentChunks } from "@/lib/rag/embed";
import { storeDocumentChunks } from "@/lib/rag/store";

// Pipeline — src/lib/rag/pipeline.ts
//
// upload (UploadThing, already done by the time this runs) -> extract ->
// chunk -> embed -> store, per RestPlan.md Phase 4. Advances
// Document.processingStatus through each stage so the UI (ProcessingState)
// shows real progress, and on failure records the SPECIFIC stage that
// failed rather than a generic error.

export type PipelineStage = "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "READY";

export class DocumentProcessingError extends Error {
  readonly stage: PipelineStage;
  constructor(stage: PipelineStage, message: string, cause?: unknown) {
    super(message);
    this.name = "DocumentProcessingError";
    this.stage = stage;
    this.cause = cause;
  }
}

async function setStatus(
  documentId: string,
  status: "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "READY" | "FAILED",
  extra: { errorMessage?: string | null; chunkCount?: number } = {},
): Promise<void> {
  await db.document.update({
    where: { id: documentId },
    data: {
      processingStatus: status,
      errorMessage: extra.errorMessage ?? null,
      ...(extra.chunkCount !== undefined ? { chunkCount: extra.chunkCount } : {}),
    },
  });
}

/**
 * Runs the full document processing pipeline for an already-uploaded
 * document. Fetches the file bytes from its UploadThing URL (the original
 * never lives in Postgres — only the extracted text/vectors do), then
 * extracts, chunks, embeds, and stores.
 *
 * On any failure, the Document is left in FAILED with `errorMessage`
 * naming the stage that failed (e.g. "Failed while EXTRACTING: ...") so the
 * trainer UI can show an explicit failure stage rather than a generic error.
 */
export async function processDocument(documentId: string): Promise<void> {
  const document = await db.document.findUniqueOrThrow({ where: { id: documentId } });

  try {
    await setStatus(documentId, "EXTRACTING");
    const fileResponse = await fetch(document.uploadThingUrl);
    if (!fileResponse.ok) {
      throw new DocumentProcessingError(
        "EXTRACTING",
        `Could not download the uploaded file (HTTP ${fileResponse.status}).`,
      );
    }
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    let text: string;
    try {
      text = await extractText(buffer, document.type);
    } catch (error) {
      throw new DocumentProcessingError(
        "EXTRACTING",
        error instanceof Error ? error.message : "Text extraction failed.",
        error,
      );
    }

    await setStatus(documentId, "CHUNKING");
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new DocumentProcessingError("CHUNKING", "Document produced no usable chunks.");
    }

    await setStatus(documentId, "EMBEDDING");
    let embeddings: number[][];
    try {
      embeddings = await embedDocumentChunks(chunks.map((c) => c.content));
    } catch (error) {
      throw new DocumentProcessingError(
        "EMBEDDING",
        error instanceof Error ? error.message : "Embedding generation failed.",
        error,
      );
    }

    if (embeddings.length !== chunks.length) {
      throw new DocumentProcessingError(
        "EMBEDDING",
        `Embedding count (${embeddings.length}) did not match chunk count (${chunks.length}).`,
      );
    }

    await storeDocumentChunks(
      documentId,
      chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i] })),
    );

    await setStatus(documentId, "READY", { chunkCount: chunks.length });
  } catch (error) {
    const stage = error instanceof DocumentProcessingError ? error.stage : "EXTRACTING";
    const message = error instanceof Error ? error.message : "Unknown processing failure.";
    await setStatus(documentId, "FAILED", { errorMessage: `Failed while ${stage}: ${message}` });
    throw error;
  }
}
