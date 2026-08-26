import { computeGapAnalysis, type GapInput } from "@/lib/engines/gap";
import { fallbackGapReason } from "@/lib/gap-reasoning/generate-reason";
import { GapDashboard, type DashboardGap } from "@/components/caliper/gap-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";

// Dev-only: runs typed fixture input through the REAL Skill Gap Engine (no
// database, no AI call — reasons use the deterministic fallback template,
// same one shown to real users when AI generation fails) so the dashboard
// can be visually verified end-to-end without a live DATABASE_URL or API
// key. Mirrors the /dev/caliper and /dev/assessment pattern.

const FIXTURE_INPUTS: GapInput[] = [
  // CRITICAL via weighted >= 3.0
  {
    competencyId: "c-python",
    competencyName: "Python for Data Analysis",
    domainName: "Technical",
    currentLevel: 1,
    requiredLevel: 5,
    roleWeight: 1.0,
    departmentPriority: 0.9,
  },
  // CRITICAL via the (gapSize >= 2 AND roleWeight >= 0.9) override, weighted alone stays well under 3.0
  {
    competencyId: "c-data-privacy",
    competencyName: "Data Privacy & DPDPA Compliance",
    domainName: "Digital Governance",
    currentLevel: 1,
    requiredLevel: 3,
    roleWeight: 0.95,
    departmentPriority: 0.35,
  },
  // HIGH (gapSize 3, weighted = 3 x 0.75 x 0.9 = 2.025)
  {
    competencyId: "c-survey-design",
    competencyName: "Survey Design",
    domainName: "Statistical",
    currentLevel: 1,
    requiredLevel: 4,
    roleWeight: 0.75,
    departmentPriority: 0.9,
  },
  // MEDIUM (gapSize 2, weighted = 2 x 0.75 x 0.7 = 1.05)
  {
    competencyId: "c-sql",
    competencyName: "SQL",
    domainName: "Technical",
    currentLevel: 2,
    requiredLevel: 4,
    roleWeight: 0.75,
    departmentPriority: 0.7,
  },
  // LOW
  {
    competencyId: "c-communication",
    competencyName: "Communication",
    domainName: "Behavioural",
    currentLevel: 3,
    requiredLevel: 4,
    roleWeight: 0.4,
    departmentPriority: 0.5,
  },
  // No gap — already meets target, should not appear at all
  {
    competencyId: "c-ethics",
    competencyName: "Statistical Ethics",
    domainName: "Behavioural",
    currentLevel: 5,
    requiredLevel: 4,
    roleWeight: 0.6,
    departmentPriority: 0.6,
  },
  // Not yet assessed — must render as "unknown", never a fabricated gap
  {
    competencyId: "c-gis",
    competencyName: "GIS & Spatial Data",
    domainName: "Technical",
    currentLevel: null,
    requiredLevel: 4,
    roleWeight: 0.7,
    departmentPriority: 0.6,
  },
  {
    competencyId: "c-cloud",
    competencyName: "Cloud Computing",
    domainName: "Technical",
    currentLevel: null,
    requiredLevel: 3,
    roleWeight: 0.5,
    departmentPriority: 0.4,
  },
];

export default function DevGapsPage() {
  const { gaps, unknown } = computeGapAnalysis(FIXTURE_INPUTS);

  const dashboardGaps: DashboardGap[] = gaps.map((g) => ({
    ...g,
    reason: fallbackGapReason(g),
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gap dashboard — component review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dev-only route. Fixture input run through the real Skill Gap
            Engine — severities and ordering below are computed, not
            hand-typed. Reasons use the deterministic fallback template
            (no AI call in this environment).
          </p>
        </div>
        <ThemeToggle />
      </header>

      <GapDashboard gaps={dashboardGaps} unknown={unknown} />
    </div>
  );
}
