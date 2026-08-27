import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject as aiGenerateObject, streamText as aiStreamText } from "ai";
import type { AiProvider, GenerateObjectOptions, StreamTextOptions } from "@/lib/ai/types";
import { withAiErrorHandling, classifyAiError } from "@/lib/ai/errors";

// Vercel AI SDK v7 + @openrouter/ai-sdk-provider. Primary generation model is
// google/gemini-3.5-flash; the `models` array gives automatic provider
// failover on 5xx at no extra code cost (see plan "On live API only").
const PRIMARY_MODEL = "google/gemini-3.5-flash";
const FAILOVER_MODELS = [PRIMARY_MODEL, "google/gemini-2.5-flash", "openai/gpt-4o-mini"];

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
        maxOutputTokens: opts.maxOutputTokens,
      });
      return result.object as T;
    });
  },

  async *streamText(opts: StreamTextOptions): AsyncIterable<string> {
    const openrouter = getClient();
    try {
      const result = aiStreamText({
        // Same failover array as generateObject — OpenRouter tries each id
        // in order on provider failure.
        model: openrouter.chat(PRIMARY_MODEL, { models: FAILOVER_MODELS }),
        messages: [
          ...(opts.system ? ([{ role: "system" as const, content: opts.system }]) : []),
          ...opts.messages,
        ],
      });
      for await (const delta of result.textStream) {
        yield delta;
      }
    } catch (error) {
      throw classifyAiError(error);
    }
  },
};
