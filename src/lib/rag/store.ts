import "server-only";

import pgvector from "pgvector";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { EMBEDDING_DIMENSIONS } from "@/lib/rag/embed";
import type { TextChunk } from "@/lib/rag/chunk";

// Storage — src/lib/rag/store.ts
//
// Prisma has no native `vector` type, so all vector I/O goes through raw
// queries, per docs/pgvector-prisma-notes.md rule #1: bind a STRING via
// pgvector.toSql([...]), never a raw JS array — an array binds as
// float8[]/text and Postgres refuses the implicit cast to `vector`.
//
// Originals (the uploaded file bytes) never touch this module or the
// relational DB at all — only extracted text + vectors are persisted here,
// via UploadThing for the object itself (PROJECT-SUMMARY.md architecture
// decisions).

export interface ChunkToStore extends TextChunk {
  embedding: number[];
}

function assertValidVector(vector: number[], context: string): void {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Refusing to store embedding for ${context}: expected ${EMBEDDING_DIMENSIONS} dims, got ${vector.length}.`,
    );
  }
  if (!vector.every((v) => Number.isFinite(v))) {
    throw new Error(`Refusing to store embedding for ${context}: contains non-finite values.`);
  }
}

// A real document can easily produce 50-300+ chunks. Inserting one row per
// chunk (one network round-trip each) inside a single interactive
// transaction was reliably blowing past Prisma's 5000ms default
// interactive-transaction timeout on anything but a tiny document — every
// upload of a normal-sized PDF failed at this stage. Batching rows into a
// single multi-row INSERT per batch keeps round-trips proportional to
// batch count, not chunk count, and stays well inside the timeout below.
const INSERT_BATCH_SIZE = 200;

/**
 * Persists a document's chunks + embeddings. Validates every vector's shape
 * before it ever reaches a query (validate, then interpolate — the
 * documented safe pattern in docs/pgvector-prisma-notes.md when going
 * through a driver adapter). Batched multi-row INSERTs inside a single
 * transaction (explicit generous timeout — see INSERT_BATCH_SIZE comment)
 * so a failure partway through doesn't leave a document half-indexed.
 */
export async function storeDocumentChunks(
  documentId: string,
  chunks: ChunkToStore[],
): Promise<void> {
  if (chunks.length === 0) return;

  for (const chunk of chunks) {
    assertValidVector(chunk.embedding, `chunk ${chunk.chunkIndex} of document ${documentId}`);
  }

  const batches: ChunkToStore[][] = [];
  for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
    batches.push(chunks.slice(i, i + INSERT_BATCH_SIZE));
  }

  await db.$transaction(
    async (tx) => {
      for (const batch of batches) {
        const rows = batch.map((chunk) => {
          const embeddingSql = pgvector.toSql(chunk.embedding); // string, never a JS array — rule #1
          const id = crypto.randomUUID();
          return Prisma.sql`(${id}, ${documentId}, ${chunk.content}, ${chunk.chunkIndex}, ${chunk.tokenCount}, ${embeddingSql}::vector, now())`;
        });

        await tx.$executeRaw`
          INSERT INTO "DocumentChunk" (id, "documentId", content, "chunkIndex", "tokenCount", embedding, "createdAt")
          VALUES ${Prisma.join(rows)}
        `;
      }

      await tx.document.update({
        where: { id: documentId },
        data: { chunkCount: chunks.length },
      });
    },
    // Explicit, generous timeout — well beyond Prisma's 5000ms default —
    // since even batched, a very large document can take a few batches.
    { timeout: 30_000, maxWait: 10_000 },
  );
}

