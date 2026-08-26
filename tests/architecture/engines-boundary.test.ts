import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// PRD §2.5, encoded as a build failure: nothing under src/lib/engines/ may
// import from src/lib/ai/. The scoring engines are pure and deterministic —
// this is the entire defensibility of the product. The ESLint rule in
// eslint.config.mjs enforces the same thing at lint time; this test is an
// independent, harder-to-bypass enforcement that runs in CI regardless of
// whether lint was skipped.

const ENGINES_DIR = path.resolve(__dirname, "../../src/lib/engines");

function collectSourceFiles(dir: string): string[] {
  let results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry === ".gitkeep") continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

const AI_IMPORT_PATTERN = /from\s+["'](?:@\/lib\/ai|\.\.?\/.*\/ai\/|\.\.?\/ai\/)/;

describe("architecture boundary: lib/engines never imports lib/ai", () => {
  const files = collectSourceFiles(ENGINES_DIR);

  it("finds the engines directory", () => {
    expect(path.basename(ENGINES_DIR)).toBe("engines");
  });

  if (files.length === 0) {
    it.skip("no engine source files yet (Phase 1 — engines land in Phase 2)", () => {});
  }

  for (const file of files) {
    const relative = path.relative(process.cwd(), file);
    it(`${relative} does not import from lib/ai`, () => {
      const contents = readFileSync(file, "utf-8");
      expect(contents).not.toMatch(AI_IMPORT_PATTERN);
    });
  }
});
