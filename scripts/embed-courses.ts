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
import pgvector from "pgvector";
import { embedDocumentChunks } from "../src/lib/rag/embed-core";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  // `embedding` is an Unsupported() column — invisible to the Prisma client,
  // including filters. Find un-embedded courses with a raw query instead.
  const pendingIds = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Course" WHERE embedding IS NULL
  `;
  if (pendingIds.length === 0) {
    console.log("All courses already have embeddings. Nothing to do.");
    return;
  }
  const idList = pendingIds.map((row) => row.id);
  const courses = await db.course.findMany({
    where: { id: { in: idList } },
    select: { id: true, title: true, description: true, competencies: true },
  });

  // Append human-readable competency names to the embedding text — Course.competencies
  // stores ids, but the semantic signal lives in the names.
  const competencies = await db.competency.findMany({ select: { id: true, name: true } });
  const nameById = new Map(competencies.map((c) => [c.id, c.name]));

  console.log(`Embedding ${courses.length} courses…`);
  const texts = courses.map((course) => {
    const names = course.competencies.map((id) => nameById.get(id)).filter(Boolean);
    return `${course.title}\n${course.description}\nCompetencies: ${names.join(", ")}`;
  });

  const vectors = await embedDocumentChunks(texts);

  for (let i = 0; i < courses.length; i++) {
    await db.$executeRaw`
      UPDATE "Course"
      SET embedding = ${pgvector.toSql(vectors[i])}::vector
      WHERE id = ${courses[i].id}
    `;
  }

  console.log(`Done — ${vectors.length} course embeddings written.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
