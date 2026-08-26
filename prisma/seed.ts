/**
 * SkillForge AI — seed data.
 *
 * The competency framework is seed data, never invented at request time
 * (PRD §5.3). This script is idempotent (upserts) so it can be re-run
 * safely against a dev database.
 *
 * Run with: pnpm db:seed
 */
import "dotenv/config";
import { PrismaClient, type DomainCode } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { COURSE_CATALOG } from "./course-catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────────
// 1. Domains (PRD §5.3 — the four fixed domains)
// ─────────────────────────────────────────────────────────────────────────

const DOMAINS: { code: DomainCode; name: string; description: string }[] = [
  {
    code: "STATISTICAL",
    name: "Statistical",
    description: "Core statistical methodology and domain-specific statistics.",
  },
  {
    code: "TECHNICAL",
    name: "Technical",
    description: "Tools, languages, and platforms used to produce and publish statistics.",
  },
  {
    code: "DIGITAL_GOVERNANCE",
    name: "Digital Governance",
    description: "Security, privacy, and digital public infrastructure obligations.",
  },
  {
    code: "BEHAVIOURAL",
    name: "Behavioural",
    description: "Managerial and interpersonal capabilities for effective public service delivery.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 2. Competencies — all 33, from SIH Planning Draft §5.3
//    Statistical: 10, Technical: 12, Digital Governance: 5, Behavioural: 6
// ─────────────────────────────────────────────────────────────────────────

const COMPETENCIES: Record<DomainCode, string[]> = {
  STATISTICAL: [
    "Survey Design",
    "Sampling",
    "National Accounts",
    "Price Statistics",
    "Labour Statistics",
    "Agricultural Statistics",
    "Industrial Statistics",
    "SDG Indicators",
    "Metadata Standards",
    "Data Quality Frameworks",
  ],
  TECHNICAL: [
    "Python",
    "R",
    "SQL",
    "Stata",
    "SPSS",
    "SAS",
    "GIS",
    "Data Visualization",
    "AI/ML",
    "Cloud Computing",
    "APIs",
    "Open Data",
  ],
  DIGITAL_GOVERNANCE: [
    "Cybersecurity",
    "Data Privacy",
    "Digital Signatures",
    "Government Cloud",
    "Digital Public Infrastructure",
  ],
  BEHAVIOURAL: [
    "Leadership",
    "Communication",
    "Project Management",
    "Ethics",
    "Decision Making",
    "Change Management",
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// 3. Prerequisite DAG (competency name -> prerequisite competency names)
//    Deliberately acyclic — Phase 6's topological sort depends on this.
// ─────────────────────────────────────────────────────────────────────────

const PREREQUISITES: Record<string, string[]> = {
  // Technical chain: Python/R/SQL are foundational for Data Visualization,
  // AI/ML, Cloud Computing.
  "Data Visualization": ["Python", "SQL"],
  "AI/ML": ["Python", "Data Visualization"],
  "Cloud Computing": ["SQL"],
  APIs: ["Cloud Computing"],
  "Open Data": ["APIs", "Data Privacy"],
  GIS: ["Data Visualization"],

  // Statistical chain: Sampling depends on Survey Design; downstream
  // domain statistics depend on Sampling + National Accounts basics.
  Sampling: ["Survey Design"],
  "National Accounts": ["Sampling"],
  "Price Statistics": ["Sampling"],
  "Labour Statistics": ["Sampling"],
  "Agricultural Statistics": ["Sampling"],
  "Industrial Statistics": ["Sampling"],
  "SDG Indicators": ["National Accounts", "Data Quality Frameworks"],
  "Data Quality Frameworks": ["Metadata Standards"],

  // Digital governance: DPI builds on Cybersecurity + Data Privacy.
  "Digital Public Infrastructure": ["Cybersecurity", "Data Privacy"],
  "Government Cloud": ["Cybersecurity"],
  "Digital Signatures": ["Data Privacy"],

  // Behavioural: Change Management and Decision Making build on Leadership;
  // Project Management builds on Communication.
  "Project Management": ["Communication"],
  "Decision Making": ["Leadership"],
  "Change Management": ["Leadership", "Decision Making"],
};

// ─────────────────────────────────────────────────────────────────────────
// 4. Departments + priorities
// ─────────────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { name: "Survey Design & Methodology Division", description: "Designs survey instruments and sampling frames." },
  { name: "National Accounts Division", description: "Compiles GDP and national income aggregates." },
  { name: "Price Statistics Division", description: "Produces CPI/WPI and related price indices." },
  { name: "Data Informatics & Innovation Division (DIID)", description: "Digital systems, data platforms, and analytics tooling." },
  { name: "National Statistical Systems Training Academy (NSSTA)", description: "Training design and delivery for MoSPI officers." },
];

// Department -> [{ competency, priority (0..1), futureDemand (0..1) }]
const DEPARTMENT_PRIORITIES: Record<string, { competency: string; priority: number; futureDemand: number }[]> = {
  "Survey Design & Methodology Division": [
    { competency: "Survey Design", priority: 1.0, futureDemand: 0.9 },
    { competency: "Sampling", priority: 0.95, futureDemand: 0.9 },
    { competency: "Data Quality Frameworks", priority: 0.7, futureDemand: 0.6 },
  ],
  "National Accounts Division": [
    { competency: "National Accounts", priority: 1.0, futureDemand: 0.85 },
    { competency: "SDG Indicators", priority: 0.6, futureDemand: 0.7 },
    { competency: "SQL", priority: 0.55, futureDemand: 0.6 },
  ],
  "Price Statistics Division": [
    { competency: "Price Statistics", priority: 1.0, futureDemand: 0.8 },
    { competency: "Data Visualization", priority: 0.5, futureDemand: 0.55 },
  ],
  "Data Informatics & Innovation Division (DIID)": [
    { competency: "Python", priority: 0.9, futureDemand: 0.95 },
    { competency: "Cloud Computing", priority: 0.85, futureDemand: 0.95 },
    { competency: "AI/ML", priority: 0.8, futureDemand: 0.97 },
    { competency: "Cybersecurity", priority: 0.75, futureDemand: 0.85 },
    { competency: "Digital Public Infrastructure", priority: 0.7, futureDemand: 0.9 },
  ],
  "National Statistical Systems Training Academy (NSSTA)": [
    { competency: "Communication", priority: 0.9, futureDemand: 0.6 },
    { competency: "Project Management", priority: 0.7, futureDemand: 0.6 },
    { competency: "Change Management", priority: 0.6, futureDemand: 0.55 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// 5. Roles — 5 representative MoSPI roles, each with a genuinely different
//    target vector (requiredLevel 1-5, weight 0..1). Acceptance: two roles
//    must produce visibly different required profiles.
// ─────────────────────────────────────────────────────────────────────────

interface RoleSpec {
  name: string;
  description: string;
  targets: { competency: string; requiredLevel: number; weight: number }[];
}

const ROLES: RoleSpec[] = [
  {
    name: "Survey Statistician",
    description: "Designs and fields large-scale household and establishment surveys.",
    targets: [
      { competency: "Survey Design", requiredLevel: 5, weight: 1.0 },
      { competency: "Sampling", requiredLevel: 5, weight: 0.95 },
      { competency: "Data Quality Frameworks", requiredLevel: 4, weight: 0.8 },
      { competency: "SQL", requiredLevel: 3, weight: 0.6 },
      { competency: "R", requiredLevel: 3, weight: 0.55 },
      { competency: "Communication", requiredLevel: 3, weight: 0.5 },
      { competency: "Ethics", requiredLevel: 3, weight: 0.5 },
      { competency: "Data Privacy", requiredLevel: 2, weight: 0.4 },
    ],
  },
  {
    name: "National Accounts Officer",
    description: "Compiles GDP, GVA, and macroeconomic aggregates from source data.",
    targets: [
      { competency: "National Accounts", requiredLevel: 5, weight: 1.0 },
      { competency: "SDG Indicators", requiredLevel: 3, weight: 0.6 },
      { competency: "SQL", requiredLevel: 4, weight: 0.75 },
      { competency: "Stata", requiredLevel: 3, weight: 0.55 },
      { competency: "Data Quality Frameworks", requiredLevel: 3, weight: 0.55 },
      { competency: "Decision Making", requiredLevel: 3, weight: 0.5 },
      { competency: "Metadata Standards", requiredLevel: 3, weight: 0.45 },
    ],
  },
  {
    name: "Data Scientist (DIID)",
    description: "Builds analytics platforms, dashboards, and predictive tooling for MoSPI data.",
    targets: [
      { competency: "Python", requiredLevel: 5, weight: 1.0 },
      { competency: "AI/ML", requiredLevel: 4, weight: 0.9 },
      { competency: "Cloud Computing", requiredLevel: 4, weight: 0.85 },
      { competency: "SQL", requiredLevel: 5, weight: 0.85 },
      { competency: "APIs", requiredLevel: 4, weight: 0.7 },
      { competency: "Data Visualization", requiredLevel: 4, weight: 0.7 },
      { competency: "Cybersecurity", requiredLevel: 3, weight: 0.55 },
      { competency: "Open Data", requiredLevel: 3, weight: 0.5 },
    ],
  },
  {
    name: "Price Statistics Analyst",
    description: "Produces consumer and wholesale price indices.",
    targets: [
      { competency: "Price Statistics", requiredLevel: 5, weight: 1.0 },
      { competency: "Sampling", requiredLevel: 3, weight: 0.6 },
      { competency: "SPSS", requiredLevel: 3, weight: 0.55 },
      { competency: "Data Visualization", requiredLevel: 3, weight: 0.5 },
      { competency: "Data Quality Frameworks", requiredLevel: 3, weight: 0.5 },
      { competency: "Communication", requiredLevel: 2, weight: 0.35 },
    ],
  },
  {
    name: "Training Coordinator (NSSTA)",
    description: "Designs and delivers capacity-building programs for statistical officers.",
    targets: [
      { competency: "Communication", requiredLevel: 5, weight: 1.0 },
      { competency: "Project Management", requiredLevel: 4, weight: 0.85 },
      { competency: "Leadership", requiredLevel: 4, weight: 0.8 },
      { competency: "Change Management", requiredLevel: 3, weight: 0.65 },
      { competency: "Decision Making", requiredLevel: 3, weight: 0.55 },
      { competency: "Ethics", requiredLevel: 3, weight: 0.5 },
      { competency: "Data Visualization", requiredLevel: 2, weight: 0.35 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 6. Demo users
// ─────────────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = "SkillForge!2026";

async function main() {
  console.log("Seeding domains…");
  const domainByCode = new Map<DomainCode, string>();
  for (const d of DOMAINS) {
    const row = await db.domain.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description },
      create: d,
    });
    domainByCode.set(d.code, row.id);
  }

  console.log("Seeding competencies…");
  const competencyIdByName = new Map<string, string>();
  for (const [code, names] of Object.entries(COMPETENCIES) as [DomainCode, string[]][]) {
    const domainId = domainByCode.get(code)!;
    for (const name of names) {
      const row = await db.competency.upsert({
        where: { domainId_name: { domainId, name } },
        update: {},
        create: { name, domainId, maxLevel: 5 },
      });
      competencyIdByName.set(name, row.id);
    }
  }

  const totalExpected = Object.values(COMPETENCIES).reduce((n, arr) => n + arr.length, 0);
  if (competencyIdByName.size !== totalExpected) {
    throw new Error(
      `Expected ${totalExpected} competencies, seeded ${competencyIdByName.size}. Check for duplicate names across domains.`,
    );
  }
  console.log(`  ${competencyIdByName.size} competencies seeded.`);

  console.log("Seeding prerequisite DAG…");
  assertAcyclic(PREREQUISITES);
  for (const [competencyName, prereqs] of Object.entries(PREREQUISITES)) {
    const competencyId = competencyIdByName.get(competencyName);
    if (!competencyId) throw new Error(`Unknown competency in prerequisites: ${competencyName}`);
    for (const prereqName of prereqs) {
      const prerequisiteId = competencyIdByName.get(prereqName);
      if (!prerequisiteId) throw new Error(`Unknown prerequisite: ${prereqName}`);
      await db.competencyPrerequisite.upsert({
        where: { competencyId_prerequisiteId: { competencyId, prerequisiteId } },
        update: {},
        create: { competencyId, prerequisiteId },
      });
    }
  }

  console.log("Seeding departments…");
  const departmentIdByName = new Map<string, string>();
  for (const dep of DEPARTMENTS) {
    const row = await db.department.upsert({
      where: { name: dep.name },
      update: { description: dep.description },
      create: dep,
    });
    departmentIdByName.set(dep.name, row.id);
  }

  console.log("Seeding department priorities…");
  for (const [depName, priorities] of Object.entries(DEPARTMENT_PRIORITIES)) {
    const departmentId = departmentIdByName.get(depName)!;
    for (const p of priorities) {
      const competencyId = competencyIdByName.get(p.competency);
      if (!competencyId) throw new Error(`Unknown competency in dept priorities: ${p.competency}`);
      await db.departmentPriority.upsert({
        where: { departmentId_competencyId: { departmentId, competencyId } },
        update: { priority: p.priority, futureDemand: p.futureDemand },
        create: { departmentId, competencyId, priority: p.priority, futureDemand: p.futureDemand },
      });
    }
  }

  console.log("Seeding roles + target vectors…");
  const roleIdByName = new Map<string, string>();
  for (const role of ROLES) {
    const row = await db.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roleIdByName.set(role.name, row.id);

    for (const t of role.targets) {
      const competencyId = competencyIdByName.get(t.competency);
      if (!competencyId) throw new Error(`Unknown competency in role targets: ${t.competency}`);
      await db.roleCompetency.upsert({
        where: { roleId_competencyId: { roleId: row.id, competencyId } },
        update: { requiredLevel: t.requiredLevel, weight: t.weight },
        create: { roleId: row.id, competencyId, requiredLevel: t.requiredLevel, weight: t.weight },
      });
    }
  }

  console.log("Seeding demo users…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const learnerDept = departmentIdByName.get("Survey Design & Methodology Division")!;
  const learnerRole = roleIdByName.get("Survey Statistician")!;

  await db.user.upsert({
    where: { email: "learner@skillforge.demo" },
    update: {},
    create: {
      name: "Anjali Rao",
      email: "learner@skillforge.demo",
      passwordHash,
      role: "LEARNER",
      departmentId: learnerDept,
      roleId: learnerRole,
      profile: {
        create: {
          designation: "Statistical Officer, Grade II",
          department: "Survey Design & Methodology Division",
          jobRole: "Survey Statistician",
          completeness: 30,
        },
      },
    },
  });

  await db.user.upsert({
    where: { email: "trainer@skillforge.demo" },
    update: {},
    create: {
      name: "Vikram Nair",
      email: "trainer@skillforge.demo",
      passwordHash,
      role: "TRAINER",
      departmentId: departmentIdByName.get("National Statistical Systems Training Academy (NSSTA)"),
    },
  });

  await db.user.upsert({
    where: { email: "admin@skillforge.demo" },
    update: {},
    create: {
      name: "Priya Sharma",
      email: "admin@skillforge.demo",
      passwordHash,
      role: "ADMIN",
      departmentId: departmentIdByName.get("Data Informatics & Innovation Division (DIID)"),
    },
  });

  console.log("\nSeeding course catalog (real iGOT / NSSTA data)…");
  // Validate every referenced competency name against the taxonomy BEFORE
  // writing anything — a typo'd name must fail loudly, not silently narrow
  // the catalog.
  for (const course of COURSE_CATALOG) {
    for (const competencyName of course.competencies) {
      if (!competencyIdByName.has(competencyName)) {
        throw new Error(
          `Course "${course.title}" references unknown competency "${competencyName}". Fix prisma/course-catalog.ts.`,
        );
      }
    }
  }
  for (const course of COURSE_CATALOG) {
    const existing = await db.course.findFirst({
      where: { source: course.source, title: course.title },
      select: { id: true },
    });
    if (existing) {
      await db.course.update({
        where: { id: existing.id },
        data: {
          description: course.description,
          competencies: course.competencies.map((name) => competencyIdByName.get(name)!),
          level: course.level,
          durationHours: course.durationHours,
          externalUrl: course.externalUrl ?? null,
        },
      });
    } else {
      await db.course.create({
        data: {
          source: course.source,
          title: course.title,
          description: course.description,
          competencies: course.competencies.map((name) => competencyIdByName.get(name)!),
          level: course.level,
          durationHours: course.durationHours,
          externalUrl: course.externalUrl ?? null,
        },
      });
    }
  }
  console.log(`  ${COURSE_CATALOG.length} courses seeded.`);
  console.log("  (Run `pnpm db:embed-courses` to embed them for semantic ranking.)");

  console.log("\nSeed complete.");
  console.log("Demo accounts (password for all: " + DEMO_PASSWORD + "):");
  console.log("  learner@skillforge.demo  (LEARNER, Survey Statistician)");
  console.log("  trainer@skillforge.demo  (TRAINER)");
  console.log("  admin@skillforge.demo    (ADMIN)");
}

/** Kahn's-algorithm-style cycle check over the seed DAG before it ever hits the DB. */
function assertAcyclic(graph: Record<string, string[]>) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(node: string, path: string[]) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      throw new Error(`Cycle detected in prerequisite DAG: ${[...path, node].join(" -> ")}`);
    }
    visiting.add(node);
    for (const dep of graph[node] ?? []) {
      visit(dep, [...path, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of Object.keys(graph)) {
    visit(node, []);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
