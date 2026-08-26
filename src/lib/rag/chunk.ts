// Chunking — src/lib/rag/chunk.ts
//
// Splits extracted document text into ~500-token chunks with 15% overlap,
// preferring paragraph boundaries (RestPlan.md Phase 4 "Chunk"). This is
// plain text transformation, not a scoring decision, so it lives outside
// src/lib/engines/ without concern — nothing here ever becomes a
// competency score (PRD §2.5 only constrains numbers that measure a
// person, not document processing).
//
// Token counts use gpt-tokenizer's cl100k_base encoder as an approximation
// (Gemini has no public tokenizer in this stack) — good enough to hit the
// ~500-token budget; exactness isn't required, only consistency.

import { encode, decode, countTokens } from "gpt-tokenizer";

export const TARGET_CHUNK_TOKENS = 500;
export const CHUNK_OVERLAP_RATIO = 0.15;

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

function overlapTokenCount(): number {
  return Math.round(TARGET_CHUNK_TOKENS * CHUNK_OVERLAP_RATIO);
}

/** Returns the trailing `n`-token slice of `text`, decoded back to a string. */
function tailByTokens(text: string, n: number): string {
  if (n <= 0) return "";
  const tokens = encode(text);
  if (tokens.length <= n) return text;
  return decode(tokens.slice(tokens.length - n));
}

/**
 * Splits a single paragraph too large to fit in one chunk into sequential
 * token windows of TARGET_CHUNK_TOKENS with CHUNK_OVERLAP_RATIO overlap
 * between consecutive windows. Only reached for unusually long paragraphs
 * (e.g. a giant unbroken block of text) — everything else goes through
 * paragraph-boundary chunking below.
 */
function splitLargeParagraph(paragraph: string): string[] {
  const tokens = encode(paragraph);
  const overlap = overlapTokenCount();
  const step = Math.max(1, TARGET_CHUNK_TOKENS - overlap);
  const windows: string[] = [];
  for (let start = 0; start < tokens.length; start += step) {
    const end = Math.min(tokens.length, start + TARGET_CHUNK_TOKENS);
    windows.push(decode(tokens.slice(start, end)));
    if (end === tokens.length) break;
  }
  return windows;
}

/**
 * Chunks extracted document text into ~500-token pieces with 15% overlap,
 * splitting on paragraph boundaries where possible (RestPlan.md Phase 4).
 * Persist `chunkIndex` and `tokenCount` on every resulting DocumentChunk row.
 */
export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) return [];

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const contents: string[] = [];
  let currentParagraphs: string[] = [];
  let currentTokens = 0;

  function flush() {
    if (currentParagraphs.length === 0) return;
    contents.push(currentParagraphs.join("\n\n"));
  }

  for (const paragraph of paragraphs) {
    const paragraphTokens = countTokens(paragraph);

    if (paragraphTokens > TARGET_CHUNK_TOKENS) {
      flush();
      currentParagraphs = [];
      currentTokens = 0;
      contents.push(...splitLargeParagraph(paragraph));
      continue;
    }

    if (currentTokens + paragraphTokens > TARGET_CHUNK_TOKENS && currentParagraphs.length > 0) {
      flush();
      const joined = currentParagraphs.join("\n\n");
      const overlapText = tailByTokens(joined, overlapTokenCount());
      currentParagraphs = overlapText ? [overlapText] : [];
      currentTokens = overlapText ? countTokens(overlapText) : 0;
    }

    currentParagraphs.push(paragraph);
    currentTokens += paragraphTokens;
  }
  flush();

  return contents
    .filter((c) => c.trim().length > 0)
    .map((content, chunkIndex) => ({
      content,
      chunkIndex,
      tokenCount: countTokens(content),
    }));
}
