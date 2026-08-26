import { PathTimeline } from "@/components/caliper/path-timeline";
import { buildLearningPath } from "@/lib/engines/learning-path";

// Dev fixture — PathTimeline rendered from REAL engine output (Kahn's order +
// bin-packing over typed fixtures), mirroring /dev/gaps.

const ITEMS = [
  { itemId: "r1", competencyId: "Sampling", priorityRank: 0, hours: 30 }, // NSSTA 5-day programme
  { itemId: "r2", competencyId: "Survey Design", priorityRank: 0, hours: 6 },
  { itemId: "r3", competencyId: "Data Visualization", priorityRank: 1, hours: 3 },
  { itemId: "r4", competencyId: "Python", priorityRank: 1, hours: 30 },
];

const EDGES = [
  { competencyId: "Sampling", prerequisiteId: "Survey Design" },
  { competencyId: "Data Visualization", prerequisiteId: "Python" },
];

export default function DevPathPage() {
  const scheduled = buildLearningPath(ITEMS, EDGES);
  const meta = new Map([
    ["r1", { title: "Sampling Techniques & Large Scale Sample Surveys", source: "NSSTA · 30h" }],
    ["r2", { title: "Nuances of Data Collection", source: "NSSTA · 6h" }],
    ["r3", { title: "Data Analytics & Visualization", source: "NSSTA · 3h" }],
    ["r4", { title: "Foundation Course on Machine Learning using Python", source: "NSSTA · 30h" }],
  ]);

  const weeks = [...new Set(scheduled.map((s) => s.weekNumber))].sort((a, b) => a - b).map((weekNumber) => {
    const weekItems = scheduled.filter((s) => s.weekNumber === weekNumber);
    return {
      weekNumber,
      hours: weekItems.reduce((sum, s) => sum + (ITEMS.find((i) => i.itemId === s.itemId)?.hours ?? 0), 0),
      items: weekItems.map((s) => ({
        id: s.itemId,
        title: meta.get(s.itemId)?.title ?? s.itemId,
        meta: meta.get(s.itemId)?.source,
        rationale: `Scheduled after its prerequisites (order ${s.order}).`,
      })),
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-lg font-semibold text-foreground">dev / path</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Engine-computed schedule: Survey Design → Sampling (prereq chain), Python → Data Visualization.
      </p>
      <PathTimeline weeks={weeks} maxWeeklyHours={5} />
    </div>
  );
}
