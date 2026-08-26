import "server-only";

import { getAiProvider } from "@/lib/ai/provider";
import {
  generatedMcqBatchSchema,
  type GeneratedMcqBatch,
  type DifficultyHint,
} from "@/lib/validation/questions";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

// RAG-grounded MCQ generation — src/lib/questions/generate-mcq.ts
//
// "Retrieve first, then generate" (RestPlan.md Phase 5): questions are
// written from the document's own retrieved chunks, never free-form from
// the model's general knowledge. Each question cites a `sourceChunkIndex`
// into the finite chunk list handed to the model — the caller
// (src/app/api/questions/generate/route.ts) maps that back to a real
// DocumentChunk.id and discards anything that doesn't resolve to one
// (PRD §4.7 traceability). The LLM never assigns a score or judges
// relevance — `difficulty` is a property of the question, not a
// competency judgment (PRD §2.5).

export interface GenerateMcqParams {
  competencyName: string;
  domainName: string;
  count: number;
  topic?: string;
  difficultyHint?: DifficultyHint;
  /** Retrieved chunks, in the exact order the model must cite by index. */
  chunks: RetrievedChunk[];
}

const DIFFICULTY_GUIDANCE: Record<DifficultyHint, string> = {
  EASY: "introductory recall — testing whether the reader retained a stated fact or definition",
  MEDIUM: "applied understanding — testing whether the reader can apply a concept from the text to a described scenario",
  HARD: "expert-level analysis — testing whether the reader can reason about edge cases, trade-offs, or exceptions described in the text",
};

function buildPrompt(params: GenerateMcqParams): string {
  const chunkList = params.chunks
    .map((chunk, i) => `[Chunk ${i}]\n${chunk.content}`)
    .join("\n\n---\n\n");

  const difficultyLine = params.difficultyHint
    ? `Target difficulty: ${params.difficultyHint} (${DIFFICULTY_GUIDANCE[params.difficultyHint]}).`
    : "Vary difficulty naturally across the set.";

  return `Write exactly ${params.count} multiple-choice question(s) for the competency "${params.competencyName}" (domain: ${params.domainName}), for MoSPI (Ministry of Statistics and Programme Implementation) statistical officers.${
    params.topic ? ` Focus specifically on this topic within the material: "${params.topic}".` : ""
  }

Ground every question EXCLUSIVELY in the numbered source chunks below — do not draw on outside knowledge, and do not invent facts not present in the text. Each chunk is delimited by "---" and labelled "[Chunk N]".

${chunkList}

Requirements for every question:
- "sourceChunkIndex" MUST be the integer N of the exact [Chunk N] the question's content and answer come from — copy the number verbatim, never invent one outside the range shown above.
- Exactly 4 answer options, plausible and mutually exclusive.
- "correctAnswer" must be copied verbatim from one of the 4 "options".
- "difficulty" is a number from 0 (introductory recall) to 1 (expert-level application) describing how hard the QUESTION is — a property of the question, never a judgment about any person.
- ${difficultyLine}
- "explanation" briefly states why the correct answer is right, referencing the source chunk's content.
- Do not include any numeric score, rating, or competency-level judgment anywhere in your output — you are writing questions only.`;
}

const SYSTEM_PROMPT = `You are an assessment-design assistant for SkillForge AI, a competency measurement platform for India's official statistical system. You write assessment QUESTIONS ONLY, grounded strictly in the source material you are given — never from general knowledge, and never inventing facts. You never assign scores, competency levels, or relevance judgments — those are computed separately by deterministic code. Follow the requested JSON schema exactly.`;

/**
 * Calls the configured AI provider to draft RAG-grounded MCQ questions.
 * Any question whose `sourceChunkIndex` doesn't resolve to a chunk actually
 * provided is discarded here (defense in depth beyond the Zod schema,
 * which can only check the shape, not the range) — never returned to the
 * caller as if it were traceable.
 */
export async function generateMcqQuestions(params: GenerateMcqParams): Promise<GeneratedMcqBatch> {
  if (params.chunks.length === 0) {
    throw new Error("Cannot generate RAG-grounded questions with zero retrieved chunks.");
  }

  const provider = getAiProvider();

  const result = await provider.generateObject({
    schema: generatedMcqBatchSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(params),
    schemaName: "GeneratedMcqBatch",
    schemaDescription:
      "A set of multiple-choice questions grounded in the provided source chunks, each citing its originating chunk by index.",
  });

  const validIndices = new Set(params.chunks.map((_, i) => i));
  const traceable = result.questions.filter((q) => validIndices.has(q.sourceChunkIndex));

  if (traceable.length === 0) {
    throw new Error(
      "No generated question could be traced back to a provided source chunk — nothing was saved.",
    );
  }

  return { questions: traceable };
}
