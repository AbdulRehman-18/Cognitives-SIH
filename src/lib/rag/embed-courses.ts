import type { PrismaClient } from "@prisma/client";
import pgvector from "pgvector";
import { embedDocumentChunks } from "./embed-core";

// Embeds every Course row with no embedding yet — shared by
// `pnpm db:embed-courses` (scripts/embed-courses.ts) and the iGOT catalog
// sync. Takes the client as a parameter (no "server-only") so the CLI script
// can pass its own. Same embedding path as the RAG pipeline (embed-core.ts).
export async function embedPendingCourses(db: PrismaClient): Promise<number> {
  // `embedding` is an Unsupported() column — invisible to the Prisma client,
  // including filters. Find un-embedded courses with a raw query instead.
  const pendingIds = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Course" WHERE embedding IS NULL
  `;
  if (pendingIds.length === 0) return 0;

  const courses = await db.course.findMany({
    where: { id: { in: pendingIds.map((row) => row.id) } },
    select: { id: true, title: true, description: true, competencies: true },
  });

  // Append human-readable competency names to the embedding text — Course.competencies
  // stores ids, but the semantic signal lives in the names.
  const competencies = await db.competency.findMany({ select: { id: true, name: true } });
  const nameById = new Map(competencies.map((c) => [c.id, c.name]));
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
  return vectors.length;
}
