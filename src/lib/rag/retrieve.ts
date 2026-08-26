import "server-only";

import pgvector from "pgvector";
import { db } from "@/lib/db/client";
import { embedQuery } from "@/lib/rag/embed";

// Retrieval — src/lib/rag/retrieve.ts
//
// The single retrieval entry point consumed by BOTH Phase 5 (MCQ generator)
// and Phase 7 (AI Tutor) — built once here per RestPlan.md Phase 4's
// explicit warning against building this layer twice.
//
// docs/pgvector-prisma-notes.md rules, all four applied below:
// 1. Bind a string (pgvector.toSql), never a JS array.
// 2. SELECT embedding::text is unnecessary here because we never read the
//    embedding column back — only content + a computed similarity float,
//    which Prisma can deserialize natively.
// 3. Cast ${queryEmbedding}::vector on both sides of the similarity query.
// 4. Use <=> (cosine) only — matches the vector_cosine_ops HNSW index.
//
// COUNT(*) elsewhere in this file is cast to ::int — BigInt does not
// serialize across the RSC boundary (same notes doc, "Other gotchas").

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  similarity: number;
}

/**
 * Retrieves the top-`k` chunks from a single document by cosine similarity
 * to `query`. Embeds the query with taskType RETRIEVAL_QUERY (asymmetric
 * from RETRIEVAL_DOCUMENT used at index time, on purpose).
 */
export async function retrieveFromDocument(
  documentId: string,
  query: string,
  k = 5,
): Promise<RetrievedChunk[]> {
  const queryVector = pgvector.toSql(await embedQuery(query));

  const rows = await db.$queryRaw<
    { id: string; content: string; chunkIndex: number; documentId: string; similarity: number }[]
  >`
    SELECT id, content, "chunkIndex", "documentId",
           1 - (embedding <=> ${queryVector}::vector) AS similarity
    FROM "DocumentChunk"
    WHERE "documentId" = ${documentId}
    ORDER BY embedding <=> ${queryVector}::vector
    LIMIT ${k}
  `;

  return rows;
}

/**
 * Retrieves the top-`k` chunks across every READY document platform-wide
 * (used by the AI Tutor in Phase 7 — course material is trainer-uploaded
 * and shared, not owned per-learner, so there is no owner filter here).
 * Cosine similarity, same rules as above.
 */
export async function retrieveAcrossAllDocuments(
  query: string,
  k = 5,
): Promise<RetrievedChunk[]> {
  const queryVector = pgvector.toSql(await embedQuery(query));

  const rows = await db.$queryRaw<
    { id: string; content: string; chunkIndex: number; documentId: string; similarity: number }[]
  >`
    SELECT dc.id, dc.content, dc."chunkIndex", dc."documentId",
           1 - (dc.embedding <=> ${queryVector}::vector) AS similarity
    FROM "DocumentChunk" dc
    INNER JOIN "Document" d ON d.id = dc."documentId"
    WHERE d."processingStatus" = 'READY'
    ORDER BY dc.embedding <=> ${queryVector}::vector
    LIMIT ${k}
  `;

  return rows;
}

/** Number of chunks currently stored for a document. Cast to ::int — BigInt doesn't cross the RSC boundary. */
export async function countChunksForDocument(documentId: string): Promise<number> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM "DocumentChunk" WHERE "documentId" = ${documentId}
  `;
  return rows[0]?.count ?? 0;
}
