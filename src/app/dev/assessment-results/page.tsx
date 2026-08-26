import { AssessmentResults } from "@/app/(learner)/assessment/[id]/assessment-results";
import { ThemeToggle } from "@/components/theme-toggle";

// Dev-only: renders the real AssessmentResults component against typed
// fixture results, with no database. EvidenceDrawerLive's fetch to
// /api/competencies/[id]/evidence will fail without a live DB/session —
// this exercises its graceful empty-state fallback, not the API route.
const FIXTURE_RESULTS = [
  {
    competencyId: "c-survey-design",
    competencyName: "Survey Design",
    domainName: "Statistical",
    current: 74.2,
    level: 4,
    confidence: 0.82,
    confidenceBand: "HIGH",
    displayRange: 3,
  },
  {
    competencyId: "c-sql",
    competencyName: "SQL",
    domainName: "Technical",
    current: 38.5,
    level: 2,
    confidence: 0.4,
    confidenceBand: "MEDIUM",
    displayRange: 7,
  },
  {
    competencyId: "c-data-privacy",
    competencyName: "Data Privacy",
    domainName: "Digital Governance",
    current: null,
    level: null,
    confidence: null,
    confidenceBand: null,
    displayRange: null,
  },
];

export default function AssessmentResultsDevPage() {
  return (
    <div className="min-h-full bg-background">
      <div className="flex justify-end px-6 pt-4">
        <ThemeToggle />
      </div>
      <AssessmentResults results={FIXTURE_RESULTS} />
    </div>
  );
}
