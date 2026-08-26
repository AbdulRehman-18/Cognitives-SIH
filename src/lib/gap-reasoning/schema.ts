import { z } from "zod";

// The LLM writes one sentence per gap — never a number, never a severity
// judgment (PRD §2.5). Severity is already fixed by src/lib/engines/gap.ts
// before this schema is ever used; the model only explains it in plain
// language.

export const gapReasonSchema = z.object({
  /** One plain-language sentence naming the competency and the concrete gap. No invented numbers. */
  reason: z.string().min(10).max(400),
});

export type GapReason = z.infer<typeof gapReasonSchema>;

export const gapReasonBatchSchema = z.object({
  reasons: z
    .array(
      z.object({
        competencyId: z.string().min(1),
        reason: z.string().min(10).max(400),
      }),
    )
    .min(1),
});

export type GapReasonBatch = z.infer<typeof gapReasonBatchSchema>;
