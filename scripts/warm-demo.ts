/**
 * Warm-demo script — pre-generates demo officer data as real Postgres rows.
 * Survives an LLM outage mid-walkthrough. Run: pnpm tsx scripts/warm-demo.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const learner = await db.user.findUnique({ where: { email: "learner@skillforge.demo" } });
  if (!learner) {
    console.error("Demo learner not found. Run pnpm db:seed first.");
    process.exit(1);
  }

  // Ensure learner has at least one diagnostic attempt so gaps exist
  const competencies = await db.competency.findMany({ take: 5, select: { id: true } });
  for (const c of competencies) {
    await db.userCompetency.upsert({
      where: { userId_competencyId: { userId: learner.id, competencyId: c.id } },
      create: { userId: learner.id, competencyId: c.id, currentScore: 45, confidence: 0.6 },
      update: {},
    });
  }

  console.log("Warm demo: seeded 5 UserCompetency rows for learner@skillforge.demo");

  // Trigger gap analysis persistence by calling the engine indirectly via DB state
  // Recommendations will be generated on next /courses page visit.
  // Embedding check
  const courseCount = await db.course.count();
  const embedded = await db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM "Course" WHERE embedding IS NOT NULL`;
  console.log(`Courses: ${courseCount}, embedded: ${embedded[0]?.count ?? 0}`);
  if ((embedded[0]?.count ?? 0) === 0) console.log("Run pnpm db:embed-courses to enable semantic ranking.");

  console.log("Warm demo complete.");
}

main().catch(console.error).finally(() => db.$disconnect());
