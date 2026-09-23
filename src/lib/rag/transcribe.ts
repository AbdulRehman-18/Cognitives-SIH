import "server-only";

import { createPartFromUri, createUserContent, FileState, GoogleGenAI } from "@google/genai";

// Media transcription — src/lib/rag/transcribe.ts
//
// Turns uploaded lecture audio/video into plain text so it can flow through
// the same chunk → embed → retrieve pipeline as documents. Uses Gemini's
// audio understanding via the Files API (handles files beyond the ~20 MB
// inline-request limit). The transcript is TEXT only — it never produces a
// score or judgment, so the engines' no-LLM-numbers rule is unaffected.

const TRANSCRIPTION_MODEL = "gemini-3.5-flash";
const FILE_READY_TIMEOUT_MS = 40_000;

export const MEDIA_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const isMediaType = (type: string) => MEDIA_MIME_TYPES.has(type.split(";")[0].trim().toLowerCase());

const PROMPT = `Transcribe the spoken content of this training recording verbatim, in the language spoken.
- Output plain text only, as paragraphs; start a new paragraph at each change of topic or slide.
- If slides or on-screen text are visible, include key on-screen text in [square brackets] where it appears.
- Do not summarise, add commentary, timestamps, or speaker guesses.`;

export async function transcribeMedia(buffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to transcribe audio/video uploads.");
  const ai = new GoogleGenAI({ apiKey });

  let uploaded = await ai.files.upload({
    file: new Blob([new Uint8Array(buffer)], { type: mimeType }),
    config: { mimeType },
  });
  try {
    // Video needs server-side processing before it can be referenced.
    const deadline = Date.now() + FILE_READY_TIMEOUT_MS;
    while (uploaded.state === FileState.PROCESSING) {
      if (Date.now() > deadline) throw new Error("The media file took too long to process — try a shorter recording.");
      await new Promise((r) => setTimeout(r, 2000));
      uploaded = await ai.files.get({ name: uploaded.name! });
    }
    if (uploaded.state === FileState.FAILED || !uploaded.uri) {
      throw new Error("The media file could not be processed for transcription.");
    }

    const response = await ai.models.generateContent({
      model: TRANSCRIPTION_MODEL,
      contents: createUserContent([createPartFromUri(uploaded.uri, uploaded.mimeType ?? mimeType), PROMPT]),
    });
    const text = response.text?.trim() ?? "";
    if (!text) throw new Error("No speech could be transcribed from this recording.");
    return text;
  } finally {
    if (uploaded.name) await ai.files.delete({ name: uploaded.name }).catch(() => {});
  }
}

/** Strips WebVTT/SRT cue numbers and timestamps, keeping caption text. */
export function captionsToText(raw: string): string {
  return raw
    .replace(/^WEBVTT.*$/m, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !/-->/.test(line) && !/^(NOTE|STYLE|REGION)\b/.test(line))
    .join(" ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
