import "server-only";

import type { AiProvider } from "@/lib/ai/types";
import { openrouterProvider } from "@/lib/ai/openrouter";
import { geminiProvider } from "@/lib/ai/gemini";

// Factory returning the configured provider. AI_PROVIDER=gemini selects the
// direct Gemini implementation; anything else (including unset) defaults to
// OpenRouter, matching .env.example. No mock provider exists — live API
// only, per the locked decision in the plan. A missing/invalid key surfaces
// as a typed AiError at call time (see src/lib/ai/errors.ts), not a crash
// at import time, so route handlers can render AiErrorState instead of 500ing.
export function getAiProvider(): AiProvider {
  const selected = process.env.AI_PROVIDER;
  if (selected === "gemini") {
    return geminiProvider;
  }
  return openrouterProvider;
}
