import "server-only";

import { Prisma } from "@prisma/client";
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
 * Retrieves the top-`k` chunks visible to one user: every READY SHARED
 * document (trainer course material) plus that user's own PERSONAL uploads —
 * never another learner's personal material. Pass `documentId` to narrow to
 * one document (it must still pass the same visibility rule). Used by the AI
 * Tutor and the learner self-evaluation quiz. Cosine similarity, same rules
 * as above.
 */
export async function retrieveForUser(
  userId: string,
  query: string,
  k = 5,
  opts: { documentId?: string } = {},
): Promise<RetrievedChunk[]> {
  const queryVector = pgvector.toSql(await embedQuery(query));
  const documentFilter = opts.documentId ? Prisma.sql`AND d.id = ${opts.documentId}` : Prisma.empty;

  const rows = await db.$queryRaw<
    { id: string; content: string; chunkIndex: number; documentId: string; similarity: number }[]
  >`
    SELECT dc.id, dc.content, dc."chunkIndex", dc."documentId",
           1 - (dc.embedding <=> ${queryVector}::vector) AS similarity
    FROM "DocumentChunk" dc
    INNER JOIN "Document" d ON d.id = dc."documentId"
    WHERE d."processingStatus" = 'READY'
      AND (d.scope = 'SHARED' OR d."ownerId" = ${userId})
      ${documentFilter}
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

/**
 * Cosine similarity between `queryText` and every embedded Course row — the
 * semanticSimilarity term of the Recommendation Engine (engine-specifications
 * §3), computed HERE by the RAG layer and passed INTO the pure engine as an
 * argument (the engine itself never touches the DB or an embedding model).
 * Returns { courseId → similarity } for all embedded courses.
 */
export async function courseSimilarities(queryText: string): Promise<Map<string, number>> {
  const queryVector = pgvector.toSql(await embedQuery(queryText));

  const rows = await db.$queryRaw<{ id: string; similarity: number }[]>`
    SELECT id, 1 - (embedding <=> ${queryVector}::vector) AS similarity
    FROM "Course"
    WHERE embedding IS NOT NULL
  `;

  return new Map(rows.map((row) => [row.id, row.similarity]));
}
