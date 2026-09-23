import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { AiProvider, GenerateObjectOptions, StreamTextOptions } from "@/lib/ai/types";
import { AiError, withAiErrorHandling, classifyAiError } from "@/lib/ai/errors";

// Direct Gemini implementation of AiProvider, selected by AI_PROVIDER=gemini.
// Same generateObject contract as openrouter.ts: Zod schema in, validated
// object out, never free-text parsing. Structured output uses Gemini's
// native responseSchema/responseMimeType JSON mode.
//
// Failover: the direct API has no OpenRouter-style `models` array, so we walk
// GENERATION_MODELS ourselves when a model is overloaded (503), rate-limited
// (429) or retired (404). Popular flash models 503 under demand spikes.
const GENERATION_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

function isFailoverError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 404 || status === 429 || status === 500 || status === 503) return true;
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("resource_exhausted") ||
    message.includes("not found")
  );
}

async function withModelFailover<T>(call: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const model of GENERATION_MODELS) {
    try {
      return await call(model);
    } catch (error) {
      lastError = error;
      if (!isFailoverError(error)) throw error;
      console.warn(`[gemini] ${model} unavailable, failing over:`, error instanceof Error ? error.message.slice(0, 160) : error);
    }
  }
  throw lastError;
}

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
      // Convert Zod schema to JSON Schema (draft-7). The @google/genai SDK
      // (v1.9+) uses two separate fields:
      //   - responseSchema     → Gemini's native Schema type (limited keywords)
      //   - responseJsonSchema → full JSON Schema (minLength, minItems,
      //                          additionalProperties, etc. all honoured)
      // Passing our converted schema via responseSchema silently drops those
      // extra keywords, producing unconstrained output that then fails Zod
      // validation — the root cause of "Response didn't match the expected
      // format". We use responseJsonSchema directly so nothing is lost.
      const jsonSchema = z.toJSONSchema(opts.schema, { target: "draft-7" });

      const contents = opts.system
        ? `${opts.system}\n\n${opts.prompt}`
        : opts.prompt;

      const response = await withModelFailover((model) =>
        ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: "application/json",
            maxOutputTokens: opts.maxOutputTokens,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            responseJsonSchema: jsonSchema as any,
          },
        }),
      );

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
    let yielded = false;
    try {
      const ai = getClient();
      const contents = opts.messages.map((message) => ({
        role: message.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: message.content }],
      }));
      let lastError: unknown;
      for (const model of GENERATION_MODELS) {
        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents,
            config: { systemInstruction: opts.system },
          });
          for await (const chunk of stream) {
            const delta = chunk.text;
            if (delta) {
              yielded = true;
              yield delta;
            }
          }
          return;
        } catch (error) {
          lastError = error;
          // Once text reached the caller we can't restart on another model
          // without duplicating output — surface the failure instead.
          if (yielded || !isFailoverError(error)) throw error;
          console.warn(`[gemini] ${model} unavailable, failing over:`, error instanceof Error ? error.message.slice(0, 160) : error);
        }
      }
      throw lastError;
    } catch (error) {
      throw classifyAiError(error);
    }
  },
};
