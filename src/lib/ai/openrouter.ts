import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject as aiGenerateObject } from "ai";
import type { AiProvider, GenerateObjectOptions, StreamTextOptions } from "@/lib/ai/types";
import { withAiErrorHandling } from "@/lib/ai/errors";

// Vercel AI SDK v7 + @openrouter/ai-sdk-provider. Primary generation model is
// google/gemini-3.7-flash; the `models` array gives automatic provider
// failover on 5xx at no extra code cost (see plan "On live API only").
const PRIMARY_MODEL = "google/gemini-3.7-flash";
const FAILOVER_MODELS = [PRIMARY_MODEL, "google/gemini-2.5-flash", "google/gemini-2.0-flash-001"];

function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return createOpenRouter({ apiKey });
}

export const openrouterProvider: AiProvider = {
  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<T> {
    return withAiErrorHandling(async () => {
      const openrouter = getClient();
      const result = await aiGenerateObject({
        // `models` failover: OpenRouter tries each id in order on failure.
        model: openrouter.chat(PRIMARY_MODEL, { models: FAILOVER_MODELS }),
        schema: opts.schema,
        schemaName: opts.schemaName,
        schemaDescription: opts.schemaDescription,
        prompt: opts.prompt,
        system: opts.system,
      });
      return result.object as T;
    });
  },

  async *streamText(opts: StreamTextOptions): AsyncIterable<string> {
    void opts;
    throw new Error(
      "streamText is not implemented until Phase 7 (AI Tutor). openrouterProvider.generateObject is the only Phase 2 entry point.",
    );
  },
};
