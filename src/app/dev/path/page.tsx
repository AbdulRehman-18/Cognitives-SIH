import { buildLearningPath } from "@/lib/engines/learning-path";
import { LearningPathView, type PathViewItem } from "@/components/learner/learning-path-view";

// Dev fixture — the learning path rendered from REAL engine output (Kahn's
// order + bin-packing over typed fixtures), with a mix of progress states.

const BUDGET = 5;

const ITEMS = [
  { itemId: "r1", competencyId: "Sampling Methods", priorityRank: 0, hours: 12 },
  { itemId: "r2", competencyId: "Survey Design", priorityRank: 0, hours: 6 },
  { itemId: "r3", competencyId: "Data Visualization", priorityRank: 1, hours: 3 },
  { itemId: "r4", competencyId: "Python for Data", priorityRank: 1, hours: 8 },
  { itemId: "r5", competencyId: "Data Protection (DPDPA)", priorityRank: 2, hours: 2 },
];

const EDGES = [
  { competencyId: "Sampling Methods", prerequisiteId: "Survey Design" },
  { competencyId: "Data Visualization", prerequisiteId: "Python for Data" },
];

const META: Record<string, Omit<PathViewItem, "id" | "weekNumber" | "order" | "hours" | "competencyName" | "after">> = {
  r1: { title: "Sampling Techniques & Large Scale Sample Surveys", source: "NSSTA", href: null, severity: "CRITICAL", currentLevel: 2, requiredLevel: 4, status: "untracked", pct: 0 },
  r2: { title: "Nuances of Data Collection and Questionnaire Design", source: "IGOT", href: "https://igotkarmayogi.gov.in", severity: "CRITICAL", currentLevel: 1, requiredLevel: 4, status: "done", pct: 100 },
  r3: { title: "Data Analytics & Visualization", source: "IGOT", href: "https://igotkarmayogi.gov.in", severity: "HIGH", currentLevel: 2, requiredLevel: 3, status: "todo", pct: 0 },
  r4: { title: "Foundation Course on Python for Official Statistics", source: "IGOT", href: "https://igotkarmayogi.gov.in", severity: "HIGH", currentLevel: 2, requiredLevel: 4, status: "active", pct: 45 },
  r5: { title: "Digital Personal Data Protection Act, 2023 — Essentials", source: "IGOT", href: "https://igotkarmayogi.gov.in", severity: "MEDIUM", currentLevel: 3, requiredLevel: 4, status: "todo", pct: 0 },
};

export default function DevPathPage() {
  const scheduled = buildLearningPath(ITEMS, EDGES, { maxWeeklyHours: BUDGET });
  const items: PathViewItem[] = scheduled.map((s) => ({
    ...META[s.itemId],
    id: s.itemId,
    order: s.order,
    weekNumber: s.weekNumber,
    hours: ITEMS.find((i) => i.itemId === s.itemId)!.hours,
    competencyName: s.competencyId,
    after: EDGES.filter((e) => e.competencyId === s.competencyId).map((e) => e.prerequisiteId),
    action: META[s.itemId].status === "active" ? <span className="text-[12px] text-muted-foreground">[iGOT progress control]</span> : <span className="rounded-[8px] bg-[color:var(--color-accent)] px-[12px] py-[6px] text-[13px] font-medium text-white">Enrol on iGOT</span>,
    controls: (
      <div className="flex flex-wrap gap-[6px] text-[13px]">
        <span className="rounded-[8px] border border-[color:var(--color-border-hover)] px-[12px] py-[6px]">Sync progress</span>
        <span className="rounded-[8px] border border-dashed border-[color:var(--color-border-hover)] px-[12px] py-[6px] text-muted-foreground">Simulate +50%</span>
      </div>
    ),
    description: "A practical introduction to Python for statistical work: data frames with pandas, cleaning survey microdata, weighted estimates and reproducible analysis notebooks, using NSS unit-level data as the running example.",
    courseLevel: 2,
    enrolledAt: "2026-09-10T09:00:00.000Z",
    syncedAt: "2026-09-24T08:00:00.000Z",
    mockMode: true,
  }));

  return (
    <div className="page-shell flex max-w-[1080px] flex-col gap-[32px] py-[36px]">
      <h1 className="text-[28px] font-[650] tracking-[-0.025em]">dev / path</h1>
      <LearningPathView items={items} budget={BUDGET} />
    </div>
  );
}
