import { ReasonBreakdown, type ReasonFactor } from "@/components/caliper/reason-breakdown";
import { recommendCoursesForGap, RECOMMENDATION_WEIGHTS, type RankedRecommendation, type RecommendationCandidate } from "@/lib/engines/recommendation";

// Dev fixture — recommendations UI without a DB or embeddings. The ranking
// below is computed by the REAL engine over typed fixtures (same pattern as
// /dev/gaps); only similarity values are hand-set since those come from
// pgvector in production.

const EDGES = [
  { competencyId: "dv", prerequisiteId: "python" },
  { competencyId: "ml", prerequisiteId: "dv" },
];

const CANDIDATES: RecommendationCandidate[] = [
  { courseId: "igot-1", competencyIds: ["dv", "python"], level: 3, semanticSimilarity: 0.82 },
  { courseId: "nssta-1", competencyIds: ["dv"], level: 5, semanticSimilarity: 0.74 },
  { courseId: "igot-2", competencyIds: ["sql"], level: 4, semanticSimilarity: 0.41 },
];

function factorsFor(rec: RankedRecommendation): ReasonFactor[] {
  return [
    { key: "semantic", label: "Semantic match", value: rec.factors.semanticSimilarity, weight: RECOMMENDATION_WEIGHTS.semanticSimilarity },
    { key: "severity", label: "Gap priority", value: rec.factors.gapSeverityWeight, weight: RECOMMENDATION_WEIGHTS.gapSeverityWeight },
    { key: "roleRelevance", label: "Role relevance", value: rec.factors.roleRelevance, weight: RECOMMENDATION_WEIGHTS.roleRelevance },
    { key: "prereqs", label: "Prerequisite readiness", value: rec.factors.prerequisiteReadiness, weight: RECOMMENDATION_WEIGHTS.prerequisiteReadiness },
    { key: "difficulty", label: "Difficulty fit", value: rec.factors.difficultyFit, weight: RECOMMENDATION_WEIGHTS.difficultyFit },
    { key: "deptPriority", label: "Department priority", value: rec.factors.departmentPriority, weight: RECOMMENDATION_WEIGHTS.departmentPriority },
  ];
}

export default function DevRecommendationsPage() {
  // Strong-match scenario: top candidate clears the minimum score floor.
  const ranked = recommendCoursesForGap({
    context: { severity: "CRITICAL", currentLevel: 2, roleTargetCompetencyIds: ["dv", "python"], departmentPriority: 0.9 },
    candidates: CANDIDATES,
    prerequisiteEdges: EDGES,
    learnerLevels: { python: 3 },
  });

  // Weak-match scenario: nothing clears the floor → closest-match caveat path.
  const weakRanked = recommendCoursesForGap({
    context: { severity: "LOW", currentLevel: 2, roleTargetCompetencyIds: [], departmentPriority: 0.1 },
    candidates: [
      { courseId: "weak-a", competencyIds: [], level: 1, semanticSimilarity: 0.08 },
      { courseId: "weak-b", competencyIds: [], level: 1, semanticSimilarity: 0.05 },
    ],
    prerequisiteEdges: [],
    learnerLevels: {},
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-lg font-semibold text-foreground">dev / recommendations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real engine output over fixtures — strong match above, closest-match caveat below.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {ranked.map((rec, i) => (
          <article key={rec.courseId} className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
            <span className="tabular-mono text-xs text-muted-foreground">#{i + 1}</span>
            <h2 className="text-sm font-medium text-foreground">Fixture course {rec.courseId}</h2>
            <ReasonBreakdown factors={factorsFor(rec)} score={rec.score} />
          </article>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-medium text-foreground">Weak-match caveat path</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {weakRanked.map((rec) => (
          <article key={rec.courseId} className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
            {rec.isClosestMatch ? (
              <span className="w-fit rounded-sm bg-[color-mix(in_oklch,var(--color-unmeasured),transparent_85%)] px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Closest available match
              </span>
            ) : null}
            <h3 className="text-sm font-medium text-foreground">{rec.courseId}</h3>
            <ReasonBreakdown factors={factorsFor(rec)} score={rec.score} />
          </article>
        ))}
      </div>
    </div>
  );
}
