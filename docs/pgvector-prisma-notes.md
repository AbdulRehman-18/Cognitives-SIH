# pgvector + Prisma 7 — Implementation Notes

Verified during planning (Aug 2026). **Read this before writing any vector code in Phase 4** — every item here is a bug someone else already hit.

## The four rules

Prisma has no native `vector` type, so all vector I/O goes through raw queries. Prisma binds tagged-template params with explicit Postgres types; a JS array binds as `float8[]`/`text` and Postgres refuses the implicit cast, producing `expected type vector`.

**1. Bind a string, never a JS array.** `pgvector.toSql([...])` produces the string `'[1,2,3]'`, which binds as `text` and casts cleanly:

```ts
import pgvector from 'pgvector';

const embedding = pgvector.toSql(vectorArray); // string, not array
await prisma.$executeRaw`
  INSERT INTO "DocumentChunk" (id, "documentId", content, "chunkIndex", embedding)
  VALUES (${id}, ${documentId}, ${content}, ${chunkIndex}, ${embedding}::vector)
`;
```

**2. Always select `embedding::text`, never the bare column.** Prisma cannot deserialize the `vector` type on the way back — it throws a Rust/Postgres type conversion error. Cast to text and parse client-side with `pgvector.fromSql()`.

**3. Declare dimensions everywhere.** Use `Unsupported("vector(1536)")` in the schema **and** `vector(1536)` in the migration SQL. [prisma#28867](https://github.com/prisma/prisma/issues/28867) — phantom migration drift on every `migrate dev` — is caused specifically by a migration declaring the column with *no* dimensions. That issue was closed Jan 2026 and fixed in 7.2.0 (we pin 7.10.0), but declaring dimensions explicitly avoids the class of problem entirely.

**4. Cast the parameter on both sides of a similarity query:**

```ts
const rows = await prisma.$queryRaw<{ id: string; content: string; similarity: number }[]>`
  SELECT id, content, 1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
  FROM "DocumentChunk"
  WHERE "documentId" = ${documentId}
  ORDER BY embedding <=> ${queryEmbedding}::vector
  LIMIT ${k}
`;
```

`<=>` is cosine distance; similarity = `1 - distance`. Match the operator class to the index — we create `vector_cosine_ops`, so use `<=>` and nothing else. Mixing `<->` (L2) against a cosine index silently skips the index.

## Other gotchas

- **`COUNT(*)` returns `BigInt`**, which does not serialize across the RSC boundary. Cast in SQL (`COUNT(*)::int`) or convert before returning from a server component.
- **Prisma Studio cannot open tables with vector columns.** Debug via `psql` instead. Not a bug in our code — don't chase it.
- **HNSW indexes cannot be expressed in the Prisma schema.** Hand-write them into the migration:
  ```sql
  CREATE INDEX document_chunk_embedding_idx ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
  ```
- **If a driver adapter (`@prisma/adapter-neon`) causes type-inference problems** ([prisma#24338](https://github.com/prisma/prisma/issues/24338)), fall back to `$queryRawUnsafe` with the vector interpolated directly. Safe **only** if you first validate the value is an array of finite numbers — validate, then interpolate.

## Embedding invariants

- `gemini-embedding-001`, `outputDimensionality: 1536`.
- **L2-normalize manually.** This model does *not* auto-normalize below 3072 dims. Skipping it makes cosine similarity subtly and silently wrong — the worst failure mode, because retrieval still returns plausible-looking results.
- `taskType: RETRIEVAL_DOCUMENT` when indexing, `RETRIEVAL_QUERY` when searching. Asymmetric on purpose.
- Max 2048 tokens per input; batch ≤100 inputs per request.
- Assert `vector.length === 1536` before every write. A dimension mismatch fails at the database, far from the cause.
