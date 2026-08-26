import "server-only";

// Embeddings — src/lib/rag/embed.ts
//
// Thin server-only wrapper over src/lib/rag/embed-core.ts (which holds the
// actual implementation so standalone scripts can reuse the exact same code
// path). App/server code must import from HERE, never from embed-core
// directly.
//
// ⚠️ OpenRouter serves ZERO embedding models (verified against its live
// /api/v1/models catalog, PROJECT-SUMMARY.md §3C). Embeddings ALWAYS call
// Gemini directly, regardless of AI_PROVIDER — never route this through
// src/lib/ai/provider.ts's OpenRouter path.
//
// docs/pgvector-prisma-notes.md "Embedding invariants" (enforced in core):
// - model gemini-embedding-001, outputDimensionality 1536 (MTEB parity with
//   3072 at half the storage).
// - MUST manually L2-normalize every vector — this model does not
//   auto-normalize below 3072 dims. Skipping this makes cosine similarity
//   silently wrong while still returning plausible-looking results.
// - taskType RETRIEVAL_DOCUMENT when indexing, RETRIEVAL_QUERY when
//   searching — asymmetric on purpose.
// - Max 2048 tokens per input; batch <= 100 inputs per request.
// - Assert vector.length === 1536 before every write.

export {
  embedTexts,
  embedDocumentChunks,
  embedQuery,
  EMBEDDING_DIMENSIONS,
  type EmbeddingTaskType,
} from "@/lib/rag/embed-core";
