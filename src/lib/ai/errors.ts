import "server-only";

// Typed AI errors — matches the four AiErrorState variants in
// src/components/caliper/ai-error-state.tsx exactly. Every AI surface
// renders one of these instead of a blank screen or a hung spinner
// (PRD §4.11 Reliability). A schema violation is a typed error, not a crash.

export type AiErrorKind = "RATE_LIMIT" | "TIMEOUT" | "INVALID_RESPONSE" | "NETWORK";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly cause?: unknown;

  constructor(kind: AiErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.cause = cause;
  }
}

/**
 * Wraps a provider call, classifying any failure into one of the four typed
 * AiError kinds the UI knows how to render. Never lets a raw provider error
 * (or a Zod validation error) escape as an unclassified exception.
 */
export async function withAiErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw classifyAiError(error);
  }
}

export function classifyAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const status = extractStatusCode(error);

  // Zod schema validation failures (from generateObject / the caller's own
  // z.parse of an already-typed provider response) — the response text was
  // received, but didn't match the contract we handed the model.
  if (
    (error as { name?: string } | undefined)?.name === "ZodError" ||
    lower.includes("no object generated") ||
    lower.includes("invalid_type") ||
    lower.includes("failed to parse") ||
    lower.includes("schema")
  ) {
    return new AiError("INVALID_RESPONSE", "The AI response didn't match the expected format.", error);
  }

  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return new AiError("RATE_LIMIT", "The AI provider is rate-limiting requests.", error);
  }

  if (
    status === 408 ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    (error as { name?: string } | undefined)?.name === "AbortError"
  ) {
    return new AiError("TIMEOUT", "The AI request took too long to complete.", error);
  }

  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    (typeof status === "number" && status >= 500)
  ) {
    return new AiError("NETWORK", "Couldn't reach the AI provider.", error);
  }

  // Default: treat unclassified failures as network-class so the UI always
  // gets a typed, retryable error rather than an unhandled exception.
  return new AiError("NETWORK", "Couldn't reach the AI provider.", error);
}

function extractStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.statusCode === "number") return candidate.statusCode;
  return undefined;
}
