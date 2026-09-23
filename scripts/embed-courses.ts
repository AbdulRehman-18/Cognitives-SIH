/**
 * Embeds every Course row that has no embedding yet (Phase 6).
 *
 * Uses the exact same embedding code path as the RAG pipeline
 * (src/lib/rag/embed-core.ts): gemini-embedding-001 @ 1536 dims, manual L2
 * normalization (this model does not auto-normalize below 3072 dims),
 * RETRIEVAL_DOCUMENT task type, dimension asserted before every write.
 *
 * Requires GEMINI_API_KEY and DATABASE_URL in .env. Idempotent — run again
 * after re-seeding and it fills only the gaps.
 *
 * Run with: pnpm db:embed-courses
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { embedPendingCourses } from "../src/lib/rag/embed-courses";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const count = await embedPendingCourses(db);
  console.log(count === 0 ? "All courses already have embeddings. Nothing to do." : `Done — ${count} course embeddings written.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
