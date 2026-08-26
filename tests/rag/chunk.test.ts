import { describe, expect, it } from "vitest";
import { countTokens } from "gpt-tokenizer";
import { chunkText, TARGET_CHUNK_TOKENS } from "@/lib/rag/chunk";

function paragraph(words: number, seed: string): string {
  return Array.from({ length: words }, (_, i) => `${seed}${i}`).join(" ");
}

describe("chunkText", () => {
  it("returns an empty array for empty/whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const text = "This is a short paragraph.\n\nAnd a second one.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toContain("short paragraph");
    expect(chunks[0].tokenCount).toBe(countTokens(chunks[0].content));
  });

  it("assigns sequential zero-based chunkIndex values", () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => paragraph(80, `p${i}_`));
    const chunks = chunkText(paragraphs.join("\n\n"));
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it("keeps every chunk at or near the target token budget (never wildly over)", () => {
    const paragraphs = Array.from({ length: 30 }, (_, i) => paragraph(60, `w${i}_`));
    const chunks = chunkText(paragraphs.join("\n\n"));
    for (const chunk of chunks) {
      // A single oversized paragraph can slightly exceed the budget before
      // the overlap carry-forward starts a new chunk — but never by more
      // than one paragraph's worth in this fixture (60 words).
      expect(chunk.tokenCount).toBeLessThanOrEqual(TARGET_CHUNK_TOKENS + 120);
    }
  });

  it("carries a non-empty overlap into the next chunk when text spans multiple chunks", () => {
    const paragraphs = Array.from({ length: 25 }, (_, i) => paragraph(70, `x${i}_`));
    const chunks = chunkText(paragraphs.join("\n\n"));
    expect(chunks.length).toBeGreaterThan(1);

    // The start of chunk[1] should reuse some trailing content from
    // chunk[0] (15% token overlap on paragraph boundaries) rather than
    // starting completely fresh.
    const firstWordOfSecondChunk = chunks[1].content.trim().split(/\s+/)[0];
    expect(chunks[0].content).toContain(firstWordOfSecondChunk);
  });

  it("splits a single paragraph larger than the token budget into multiple windows", () => {
    const hugeParagraph = paragraph(2000, "z");
    const chunks = chunkText(hugeParagraph);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(TARGET_CHUNK_TOKENS);
    }
  });

  it("is deterministic across repeated runs on identical input", () => {
    const text = Array.from({ length: 15 }, (_, i) => paragraph(90, `d${i}_`)).join("\n\n");
    const first = chunkText(text);
    for (let i = 0; i < 20; i++) {
      expect(chunkText(text)).toEqual(first);
    }
  });

  it("never returns a chunk consisting only of whitespace", () => {
    const text = "Paragraph one.\n\n\n\n   \n\nParagraph two.";
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });
});
