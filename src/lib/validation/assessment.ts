import { z } from "zod";

// The LLM writes questions only — never a score, never a relevance judgment
// (PRD §2.5). This schema is the entire contract the model must satisfy;
// generateObject rejects anything that doesn't validate, and that rejection
// becomes a typed AiError (INVALID_RESPONSE), not a crash.

export const generatedQuestionSchema = z.object({
  competencyId: z.string().min(1),
  stem: z.string().min(10, "Question stem is too short."),
  options: z
    .array(z.string().min(1))
    .length(4, "Every question must have exactly 4 options."),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(5),
  /** 0..1 — how hard this item is. Feeds the engine's assessmentScore weighting; never a score itself. */
  difficulty: z.coerce.number().min(0).max(5),
});

export const generatedAssessmentSchema = z.object({
  questions: z
    .array(generatedQuestionSchema)
    .min(1)
    .refine(
      (questions) => questions.every((q) => q.options.includes(q.correctAnswer)),
      { message: "Each question's correctAnswer must be one of its options." },
    ),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedAssessment = z.infer<typeof generatedAssessmentSchema>;

// ── Request-side validation for the generate route ─────────────────────────

export const generateDiagnosticRequestSchema = z.object({
  /** Competency ids to cover. If omitted, the route derives them from the caller's role. */
  competencyIds: z.array(z.string().min(1)).min(1).max(20).optional(),
  /** Questions per competency, default 2 (mirrors a ~10-question diagnostic across ~5 competencies).
   * Max raised to 8 to support the single-domain onboarding diagnostic (PRD §5.4: 5-8 questions
   * for the one highest-weighted competency, rather than a handful spread across many). */
  questionsPerCompetency: z.number().int().min(1).max(8).default(2),
});

export type GenerateDiagnosticRequest = z.infer<typeof generateDiagnosticRequestSchema>;

// ── Submission-side validation ──────────────────────────────────────────────

export const submitAssessmentSchema = z.object({
  hintsUsed: z.record(z.string(), z.number().int().min(0).max(4)).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedAnswer: z.string().min(1),
      }),
    )
    .min(1),
});

export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;
