import { z } from "zod";

// RAG-grounded MCQ generation — the LLM writes questions only, grounded in
// retrieved document chunks, never a score (PRD §2.5). The model cites a
// `sourceChunkIndex` into the finite list of chunks it was given (never a
// free-form id it could invent) — the route maps that index back to a real
// DocumentChunk.id before persisting. PRD §4.7: every generated question
// must be traceable to a specific source chunk; anything that can't be
// tied to one of the provided indices is discarded, never persisted with a
// null sourceChunkId.

export const generatedMcqQuestionSchema = z.object({
  /** Index into the chunk list handed to the model — never a free-form id. */
  sourceChunkIndex: z.number().int().min(0),
  stem: z.string().min(10, "Question stem is too short."),
  options: z
    .array(z.string().min(1))
    .length(4, "Every question must have exactly 4 options."),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(5),
  /** 0..1 — how hard this item is, a property of the question, not a judgment. */
  difficulty: z.number().min(0).max(1),
});

export const generatedMcqBatchSchema = z.object({
  questions: z
    .array(generatedMcqQuestionSchema)
    .min(1)
    .refine(
      (questions) => questions.every((q) => q.options.includes(q.correctAnswer)),
      { message: "Each question's correctAnswer must be one of its options." },
    ),
});

export type GeneratedMcqQuestion = z.infer<typeof generatedMcqQuestionSchema>;
export type GeneratedMcqBatch = z.infer<typeof generatedMcqBatchSchema>;

// ── Request-side validation ─────────────────────────────────────────────────

export const difficultyHintSchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export type DifficultyHint = z.infer<typeof difficultyHintSchema>;

export const generateMcqRequestSchema = z.object({
  documentId: z.string().min(1),
  competencyId: z.string().min(1),
  /** Number of questions to generate, default 5. */
  count: z.number().int().min(1).max(10).default(5),
  /** Optional guidance to the model — not a stored score, purely a prompt hint. */
  difficulty: difficultyHintSchema.optional(),
  /** Optional narrower topic within the document/competency to focus retrieval on. */
  topic: z.string().min(1).max(200).optional(),
});

export type GenerateMcqRequest = z.infer<typeof generateMcqRequestSchema>;

// ── Trainer review/edit ─────────────────────────────────────────────────────

export const updateQuestionSchema = z.object({
  stem: z.string().min(10).optional(),
  options: z.array(z.string().min(1)).length(4).optional(),
  correctAnswer: z.string().min(1).optional(),
  explanation: z.string().min(5).optional(),
  reviewStatus: z.enum(["DRAFT", "APPROVED", "REJECTED"]).optional(),
});

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
