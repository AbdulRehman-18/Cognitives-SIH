import "server-only";

import { getAiProvider } from "@/lib/ai/provider";
import {
  generatedAssessmentSchema,
  type GeneratedAssessment,
} from "@/lib/validation/assessment";

// Diagnostic generation — the LLM writes questions only. It never assigns a
// score or judges relevance; each question carries a `difficulty` value the
// deterministic Competency Engine uses to weight correctness, but nothing
// here decides how "good" an officer is (PRD §2.5).

export interface CompetencyBrief {
  id: string;
  name: string;
  domainName: string;
  description?: string | null;
  /** The role's required level for this competency, 1-5 — gives the model a difficulty anchor. */
  requiredLevel: number;
}

export interface GenerateDiagnosticParams {
  roleName: string;
  competencies: CompetencyBrief[];
  questionsPerCompetency: number;
}

function buildPrompt(params: GenerateDiagnosticParams): string {
  const competencyList = params.competencies
    .map(
      (c) =>
        `- id: ${c.id} | name: "${c.name}" | domain: ${c.domainName} | target level: ${c.requiredLevel}/5${
          c.description ? ` | context: ${c.description}` : ""
        }`,
    )
    .join("\n");

  return `Write a diagnostic assessment for a MoSPI (Ministry of Statistics and Programme Implementation) statistical officer applying for or working in the role of "${params.roleName}".

Generate exactly ${params.questionsPerCompetency} multiple-choice question(s) for EACH of the following competencies:
${competencyList}

Requirements for every question:
- Exactly 4 answer options, plausible and mutually exclusive.
- "correctAnswer" must be copied verbatim from one of the 4 "options".
- "competencyId" must be exactly one of the ids listed above — do not invent ids.
- "difficulty" is a number from 0 (introductory recall) to 1 (expert-level application) reflecting how hard the QUESTION is to answer correctly — this is a property of the question, not a judgment about any person.
- "explanation" briefly states why the correct answer is right, in plain professional language.
- Questions should be scenario-grounded in real statistical-office work where possible (survey design, data quality, government data systems), not abstract trivia.
- Do not include any numeric score, rating, or competency-level judgment anywhere in your output — you are writing questions only.`;
}

const SYSTEM_PROMPT = `You are an assessment-design assistant for SkillForge AI, a competency measurement platform for India's official statistical system. You write assessment QUESTIONS ONLY. You never assign scores, competency levels, or relevance judgments — those are computed separately by deterministic code. Follow the requested JSON schema exactly.`;

/**
 * Calls the configured AI provider to draft a diagnostic assessment.
 * Throws a typed AiError (via the provider's withAiErrorHandling) on any
 * failure, including schema validation failures — never returns malformed
 * or partially-validated data.
 */
export async function generateDiagnosticQuestions(
  params: GenerateDiagnosticParams,
): Promise<GeneratedAssessment> {
  const provider = getAiProvider();

  const result = await provider.generateObject({
    schema: generatedAssessmentSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(params),
    schemaName: "DiagnosticAssessment",
    schemaDescription:
      "A diagnostic assessment: one or more multiple-choice questions per requested competency.",
  });

  // Defense in depth: even though generateObject validates against the Zod
  // schema, re-assert that every competencyId the model used was actually
  // one we asked for. A model that invents an id would otherwise silently
  // produce a Question row pointing at a non-existent competency.
  const requestedIds = new Set(params.competencies.map((c) => c.id));
  const unknownIds = result.questions
    .map((q) => q.competencyId)
    .filter((id) => !requestedIds.has(id));

  if (unknownIds.length > 0) {
    throw new Error(
      `Generated assessment referenced unknown competency ids: ${[...new Set(unknownIds)].join(", ")}`,
    );
  }

  return result;
}
