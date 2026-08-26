import "server-only";

import type { ZodType } from "zod";

// The single interface every provider implements. Generation is language and
// content only — see PRD §2.5. No function in src/lib/engines/ may import
// from this module, and no provider here may return a value that becomes a
// score without passing through a deterministic engine first.

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateObjectOptions<T> {
  schema: ZodType<T>;
  prompt: string;
  system?: string;
  /** Keep provider requests within account output-token limits. */
  maxOutputTokens?: number;
  /** Optional name surfaced to the provider as extra guidance. */
  schemaName?: string;
  schemaDescription?: string;
}

export interface StreamTextOptions {
  messages: Message[];
  system?: string;
}

export interface AiProvider {
  generateObject<T>(opts: GenerateObjectOptions<T>): Promise<T>;
  streamText(opts: StreamTextOptions): AsyncIterable<string>;
}
