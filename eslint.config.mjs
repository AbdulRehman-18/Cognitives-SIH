import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ─────────────────────────────────────────────────────────────────────
  // The single most important rule in this codebase (PRD §2.5):
  // src/lib/engines/ is pure, deterministic scoring code. It must never
  // import the AI adapter — the LLM writes language, never a number that
  // lands in the database as a score. This is enforced as a build failure,
  // not a convention, and mirrored by tests/architecture/engines-boundary.test.ts.
  // ─────────────────────────────────────────────────────────────────────
  {
    files: ["src/lib/engines/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/ai", "@/lib/ai/*", "*/lib/ai/*", "**/lib/ai/**"],
              message:
                "src/lib/engines/ must stay pure and deterministic — it may never import src/lib/ai/. Scores are computed by formulas, never by the LLM (PRD §2.5).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent/tooling scratch directories — not part of the Next.js app.
    ".qoder/**",
    ".agents/**",
    ".cursor/**",
    ".gemini/**",
    ".kiro/**",
    ".impeccable/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
