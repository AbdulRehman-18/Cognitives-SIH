import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { AiProvider, GenerateObjectOptions, StreamTextOptions } from "@/lib/ai/types";
import { AiError, withAiErrorHandling } from "@/lib/ai/errors";

// Direct Gemini implementation of AiProvider, selected by AI_PROVIDER=gemini.
// Same generateObject contract as openrouter.ts: Zod schema in, validated
// object out, never free-text parsing. Structured output uses Gemini's
// native responseSchema/responseMimeType JSON mode.
const GENERATION_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const geminiProvider: AiProvider = {
  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<T> {
    return withAiErrorHandling(async () => {
      const ai = getClient();
      const jsonSchema = z.toJSONSchema(opts.schema, { target: "draft-7" });
      // Gemini's responseSchema rejects a top-level $schema key.
      delete (jsonSchema as { $schema?: string }).$schema;

      const contents = opts.system
        ? `${opts.system}\n\n${opts.prompt}`
        : opts.prompt;

      const response = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents,
        config: {
          responseMimeType: "application/json",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseSchema: jsonSchema as any,
        },
      });

      const text = response.text;
      if (!text) {
        throw new AiError("INVALID_RESPONSE", "Gemini returned an empty response.");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch (parseError) {
        throw new AiError(
          "INVALID_RESPONSE",
          "Gemini's response was not valid JSON.",
          parseError,
        );
      }

      const validated = opts.schema.safeParse(parsedJson);
      if (!validated.success) {
        throw new AiError(
          "INVALID_RESPONSE",
          "Gemini's response didn't match the expected schema.",
          validated.error,
        );
      }

      return validated.data;
    });
  },

  async *streamText(opts: StreamTextOptions): AsyncIterable<string> {
    void opts;
    throw new Error(
      "streamText is not implemented until Phase 7 (AI Tutor). geminiProvider.generateObject is the only Phase 2 entry point.",
    );
  },
};
