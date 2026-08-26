import "server-only";

import { getAiProvider } from "@/lib/ai/provider";
import { gapReasonBatchSchema } from "@/lib/gap-reasoning/schema";
import type { ComputedGap } from "@/lib/engines/gap";

// Gap reasoning — generated AFTER severity is fixed. Deliberately NOT under
// src/lib/engines/: this module imports src/lib/ai/, which the engines
// boundary forbids (engine-specifications §2, PRD §2.5). It takes
// already-computed ComputedGap rows and asks the LLM for one specific
// sentence each, explaining the gap in plain, non-judgmental language.
// Nothing produced here ever feeds back into severity, ordering, or any
// other number — those are already final by the time this module runs.

const SYSTEM_PROMPT = `You are a plain-language writing assistant for SkillForge AI, a competency measurement platform for India's official statistical system (MoSPI). You write ONE short, specific, non-judgmental sentence per skill gap, explaining why it was flagged, using ONLY the numbers given to you. You never invent a number, never state a score or gap size that wasn't provided, and never use judgmental language ("weak", "poor", "failing", "deficient"). Frame every gap as an opportunity — "room to grow" — never a failure. Follow the requested JSON schema exactly.`;

function buildPrompt(gaps: ComputedGap[]): string {
  const rows = gaps
    .map(
      (g) =>
        `- competencyId: ${g.competencyId} | competency: "${g.competencyName}" (${g.domainName}) | current level: ${g.currentLevel}/5 | required level: ${g.requiredLevel}/5 | gap size: ${g.gapSize} level(s) | severity: ${g.severity}`,
    )
    .join("\n");

  return `Write one plain-language sentence for EACH of the following skill gaps, explaining why it was flagged at its given severity. Use ONLY the numbers provided below — do not calculate, estimate, or invent any number, percentage, or score of your own.

${rows}

Requirements for every sentence:
- Name the competency by its given name.
- Reference the concrete gap (e.g. "you're at level 2 against a target of level 4") using only the numbers given.
- Keep it to one sentence, professional and encouraging in tone — this is "room to grow", never a deficiency or failure.
- Do not mention the word "severity" or restate the severity label itself; explain the practical reason instead.
- "competencyId" in your response must be copied verbatim from the input — do not invent ids.`;
}

/**
 * A deterministic, non-LLM fallback sentence. Used whenever AI generation
 * fails for any reason — a missing reason must never block a gap from
 * displaying (engine-specifications §2). Built entirely from already-computed
 * numbers, so it never contradicts the fixed severity.
 */
export function fallbackGapReason(gap: ComputedGap): string {
  return `${gap.competencyName} is currently at level ${gap.currentLevel} of 5, against a target of level ${gap.requiredLevel} for your role — closing this ${gap.gapSize}-level gap is room to grow.`;
}

export interface GapReasonResult {
  competencyId: string;
  reason: string;
  /** False when the fallback template was used instead of a live AI response. */
  aiGenerated: boolean;
}

/**
 * Generates one reason sentence per gap via the configured AI provider, in a
 * single batched call. On ANY failure (network, rate limit, schema
 * violation, missing key), falls back to the deterministic template for
 * every gap in the batch rather than letting the whole dashboard fail —
 * this matters more than usual because the product is live-API-only with no
 * mock provider (plan "On live API only").
 */
export async function generateGapReasons(gaps: ComputedGap[]): Promise<GapReasonResult[]> {
  if (gaps.length === 0) return [];

  try {
    const provider = getAiProvider();
    const result = await provider.generateObject({
      schema: gapReasonBatchSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(gaps),
      schemaName: "GapReasonBatch",
      schemaDescription: "One plain-language reason sentence per requested skill gap.",
    });

    const byId = new Map(result.reasons.map((r) => [r.competencyId, r.reason]));
    const requestedIds = new Set(gaps.map((g) => g.competencyId));

    return gaps.map((gap) => {
      const reason = byId.get(gap.competencyId);
      // Defense in depth: only trust a reason if the model echoed back an id
      // we actually asked about — an invented id, or a missing entry, falls
      // back to the deterministic template for that gap alone.
      if (reason && requestedIds.has(gap.competencyId)) {
        return { competencyId: gap.competencyId, reason, aiGenerated: true };
      }
      return { competencyId: gap.competencyId, reason: fallbackGapReason(gap), aiGenerated: false };
    });
  } catch {
    // Any AI failure (typed AiError or otherwise) — fall back for the whole
    // batch. A missing reason must never block a gap from displaying.
    return gaps.map((gap) => ({
      competencyId: gap.competencyId,
      reason: fallbackGapReason(gap),
      aiGenerated: false,
    }));
  }
}

/** Single-gap convenience wrapper over generateGapReasons(). */
export async function generateGapReason(gap: ComputedGap): Promise<GapReasonResult> {
  const [result] = await generateGapReasons([gap]);
  return result;
}
