/**
 * Demo cohort — synthetic officers for the admin analytics pages.
 *
 * Creates DEMO_COUNT officers (emails @cohort.skillforge.demo, no password —
 * they cannot sign in) spread across the seeded divisions and roles, with:
 *   - competency scores for their role's competencies (fixture values),
 *   - gaps computed by the REAL Gap Engine (loadGapAnalysis, no AI reasons),
 *   - six months of GapSnapshot history: emerging-technology gaps appear
 *     progressively, some statistical gaps close — so the forecast has a trend,
 *   - course enrolments/completions with enrolment-time baselines, so the
 *     training-effectiveness page has measured data.
 *
 * Deterministic (seeded PRNG) and idempotent: re-running deletes and
 * recreates the cohort. Never touches the three demo accounts or real users.
 *
 * Run with: pnpm db:seed-demo   (after pnpm db:seed)
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { loadGapAnalysis } from "@/lib/gap-reasoning/load-gap-analysis";
import { EMERGING_COMPETENCIES } from "@/lib/analytics/load-analytics";

const DEMO_COUNT = 40;
const DOMAIN = "cohort.skillforge.demo";
const HISTORY_MONTHS = 6;

const FIRST = ["Aarav", "Meera", "Rohan", "Kavya", "Arjun", "Divya", "Siddharth", "Nisha", "Karthik", "Pooja", "Manish", "Ritu"];
const LAST = ["Iyer", "Gupta", "Menon", "Das", "Reddy", "Joshi", "Bose", "Kulkarni", "Singh", "Pillai", "Chatterjee", "Verma"];

// Role → the division it most plausibly sits in.
const ROLE_DIVISION: Record<string, string> = {
  "Survey Statistician": "Survey Design & Methodology Division",
  "National Accounts Officer": "National Accounts Division",
  "Price Statistics Analyst": "Price Statistics Division",
  "Data Scientist (DIID)": "Data Informatics & Innovation Division (DIID)",
  "Training Coordinator (NSSTA)": "National Statistical Systems Training Academy (NSSTA)",
};

/** mulberry32 — small deterministic PRNG so every run produces the same cohort. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monthDay(monthsAgo: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 15));
}

async function main() {
  const rand = prng(26101);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

  // Idempotent reset of the previous cohort.
  const old = await db.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` } }, select: { id: true } });
  if (old.length) {
    const ids = old.map((u) => u.id);
    await db.gapSnapshot.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`Removed previous cohort (${old.length} officers).`);
  }

  const roles = await db.role.findMany({ include: { roleCompetencies: { include: { competency: { select: { id: true, name: true } } } } } });
  const departments = new Map((await db.department.findMany()).map((d) => [d.name, d.id]));
  const courses = await db.course.findMany({ select: { id: true, title: true, source: true, competencies: true, durationHours: true } });
  if (!roles.length || !courses.length) throw new Error("Run `pnpm db:seed` first — roles and the course catalog are required.");

  // Each course gets a stable "true effect" so effectiveness rankings are meaningful.
  const courseEffect = new Map(courses.map((c) => [c.id, 3 + rand() * 14]));

  let enrolments = 0;
  for (let i = 0; i < DEMO_COUNT; i++) {
    const role = roles[i % roles.length];
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`;
    const user = await db.user.create({
      data: {
        name,
        email: `officer${String(i + 1).padStart(2, "0")}@${DOMAIN}`,
        role: "LEARNER",
        roleId: role.id,
        departmentId: departments.get(ROLE_DIVISION[role.name] ?? "") ?? null,
        profile: { create: { designation: pick(["Junior Statistical Officer", "Senior Statistical Officer", "Assistant Director", "Deputy Director"]), jobRole: role.name, yearsExperience: 1 + Math.floor(rand() * 20), completeness: 60 } },
      },
    });

    // Fixture scores: ~80% of role competencies measured, skewed below target.
    const scores = new Map<string, number>();
    for (const rc of role.roleCompetencies) {
      if (rand() < 0.2) continue;
      const target = rc.requiredLevel * 20;
      const score = Math.max(8, Math.min(98, target - 35 + rand() * 50));
      scores.set(rc.competencyId, score);
      await db.userCompetency.create({
        data: {
          userId: user.id,
          competencyId: rc.competencyId,
          currentScore: new Prisma.Decimal(score.toFixed(2)),
          confidence: new Prisma.Decimal((0.4 + rand() * 0.5).toFixed(3)),
          lastComputedAt: new Date(),
          evidenceJson: { demoCohort: true },
        },
      });
    }

    // Current gaps via the real engine (also writes today's GapSnapshot).
    const analysis = await loadGapAnalysis(user.id, { withAiReasons: false });
    const gaps = analysis?.gaps ?? [];

    // Historical snapshots (months 5..1 ago).
    const history: Prisma.GapSnapshotCreateManyInput[] = [];
    for (const gap of gaps) {
      const emerging = EMERGING_COMPETENCIES.has(gap.competencyName);
      // Emerging gaps open progressively → rising series; others mostly long-standing.
      const openedMonthsAgo = emerging ? 1 + Math.floor(rand() * (HISTORY_MONTHS - 1)) : HISTORY_MONTHS - 1;
      for (let m = openedMonthsAgo; m >= 1; m--) {
        history.push({ day: monthDay(m), userId: user.id, departmentId: user.departmentId, competencyId: gap.competencyId, severity: gap.severity, gapSize: gap.gapSize });
      }
    }
    // Some role competencies without a current gap had one that closed → falling series.
    const gapIds = new Set(gaps.map((g) => g.competencyId));
    for (const rc of role.roleCompetencies) {
      if (gapIds.has(rc.competencyId) || EMERGING_COMPETENCIES.has(rc.competency.name) || rand() < 0.5) continue;
      const closedMonthsAgo = 1 + Math.floor(rand() * 3);
      for (let m = HISTORY_MONTHS - 1; m > closedMonthsAgo; m--) {
        history.push({ day: monthDay(m), userId: user.id, departmentId: user.departmentId, competencyId: rc.competencyId, severity: "MEDIUM", gapSize: 1 });
      }
    }
    if (history.length) await db.gapSnapshot.createMany({ data: history, skipDuplicates: true });

    // Enrolments on courses tagged with one of the officer's gaps (or role competencies).
    const targets = gaps.length ? gaps.map((g) => g.competencyId) : role.roleCompetencies.map((rc) => rc.competencyId);
    // Officers cluster on each competency's two most popular courses (as real
    // cohorts do), so several courses reach enough completions to be ranked.
    const chosen = new Set<string>();
    const n = rand() < 0.2 ? 0 : 1 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const competencyId = pick(targets);
      const popular = courses.filter((c) => c.competencies.includes(competencyId)).slice(0, 2);
      if (popular.length) chosen.add(pick(popular).id);
    }

    for (const courseId of chosen) {
      const course = courses.find((c) => c.id === courseId)!;
      const completed = rand() < 0.7;
      const effect = completed ? courseEffect.get(courseId)! + (rand() - 0.5) * 6 : 0;
      const baseline: Record<string, number | null> = {};
      for (const cid of course.competencies) {
        const now = scores.get(cid);
        baseline[cid] = now === undefined ? null : Math.max(0, now - effect);
      }
      const enrolledAt = monthDay(1 + Math.floor(rand() * 4));
      await db.learningProgress.create({
        data: {
          userId: user.id,
          courseId,
          status: completed ? "COMPLETED" : "IN_PROGRESS",
          progressPct: new Prisma.Decimal(completed ? 100 : 10 + Math.floor(rand() * 80)),
          enrolledAt,
          completedAt: completed ? new Date(enrolledAt.getTime() + 20 * 86_400_000) : null,
          baselineJson: baseline,
        },
      });
      enrolments++;
    }
  }

  console.log(`Demo cohort ready: ${DEMO_COUNT} officers, ${enrolments} enrolments, ${HISTORY_MONTHS} months of gap history.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
