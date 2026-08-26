import "server-only";

import { GoogleGenAI } from "@google/genai";

// Embeddings — src/lib/rag/embed.ts
//
// ⚠️ OpenRouter serves ZERO embedding models (verified against its live
// /api/v1/models catalog, PROJECT-SUMMARY.md §3C). Embeddings ALWAYS call
// Gemini directly, regardless of AI_PROVIDER — never route this through
// src/lib/ai/provider.ts's OpenRouter path.
//
// docs/pgvector-prisma-notes.md "Embedding invariants":
// - model gemini-embedding-001, outputDimensionality 1536 (MTEB parity with
//   3072 at half the storage).
// - MUST manually L2-normalize every vector — this model does not
//   auto-normalize below 3072 dims. Skipping this makes cosine similarity
//   silently wrong while still returning plausible-looking results.
// - taskType RETRIEVAL_DOCUMENT when indexing, RETRIEVAL_QUERY when
//   searching — asymmetric on purpose.
// - Max 2048 tokens per input; batch <= 100 inputs per request.
// - Assert vector.length === 1536 before every write.

const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 100;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured — embeddings must call Gemini directly, OpenRouter has no embedding models.",
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** L2-normalizes a vector in place-equivalent (returns a new array). Required — see module header. */
function l2Normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

function assertDimensions(vector: number[], context: string): void {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch for ${context}: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}.`,
    );
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Embeds a batch of texts with the given task type, in <=100-input requests.
 * Every returned vector is L2-normalized and asserted to be exactly 1536-dim
 * before being handed back — never write an un-normalized or wrong-length
 * vector to Postgres.
 */
export async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const ai = getClient();
  const results: number[][] = [];

  for (const batch of chunkArray(texts, MAX_BATCH_SIZE)) {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
      config: {
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding batch mismatch: requested ${batch.length} texts, got ${embeddings.length} embeddings back.`,
      );
    }

    for (let i = 0; i < embeddings.length; i++) {
      const values = embeddings[i]?.values;
      if (!values) {
        throw new Error(`Embedding response missing values for batch item ${i}.`);
      }
      const normalized = l2Normalize(values);
      assertDimensions(normalized, `batch item ${i}`);
      results.push(normalized);
    }
  }

  return results;
}

/** Convenience wrapper for embedding document chunks at index time. */
export async function embedDocumentChunks(texts: string[]): Promise<number[][]> {
  return embedTexts(texts, "RETRIEVAL_DOCUMENT");
}

/** Convenience wrapper for embedding a single search query — asymmetric task type, on purpose. */
export async function embedQuery(query: string): Promise<number[]> {
  const [vector] = await embedTexts([query], "RETRIEVAL_QUERY");
  return vector;
}
