import { AssessmentRunner } from "@/app/(learner)/assessment/[id]/assessment-runner";
import { ThemeToggle } from "@/components/theme-toggle";

// Dev-only: renders the real AssessmentRunner client component against
// typed fixture questions, with no database — lets the take-assessment flow
// be visually verified without a live DATABASE_URL. Submitting here will
// hit the real API route and fail (no DB), which is expected in this
// environment; the purpose is to verify the question-by-question UI itself.
const FIXTURE_QUESTIONS = [
  {
    id: "q1",
    stem: "In a stratified random sample, which of the following best describes the primary purpose of stratification?",
    options: [
      "To reduce the overall sample size required",
      "To ensure each subgroup is proportionally represented, reducing sampling error",
      "To eliminate the need for randomization within strata",
      "To simplify data collection logistics only",
    ],
    competencyId: "c-survey-design",
    competencyName: "Survey Design",
    domainName: "Statistical",
  },
  {
    id: "q2",
    stem: "Which SQL clause would you use to filter grouped results after an aggregate function has been applied?",
    options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"],
    competencyId: "c-sql",
    competencyName: "SQL",
    domainName: "Technical",
  },
  {
    id: "q3",
    stem: "Under India's DPDPA 2023, what is the primary obligation of a data fiduciary before processing personal data for a new purpose?",
    options: [
      "Notify the Data Protection Board only",
      "Obtain fresh, informed consent from the data principal",
      "Anonymize all previously collected data",
      "No additional obligation is required",
    ],
    competencyId: "c-data-privacy",
    competencyName: "Data Privacy",
    domainName: "Digital Governance",
  },
];

export default function AssessmentRunnerDevPage() {
  return (
    <div className="min-h-full bg-background">
      <div className="flex justify-end px-6 pt-4">
        <ThemeToggle />
      </div>
      <AssessmentRunner assessmentId="dev-fixture" questions={FIXTURE_QUESTIONS} />
    </div>
  );
}
