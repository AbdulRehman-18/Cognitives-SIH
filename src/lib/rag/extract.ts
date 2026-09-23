import "server-only";

import { parseOffice, type SupportedFileType } from "officeparser";
import { captionsToText, isMediaType, transcribeMedia } from "./transcribe";

// Extraction — src/lib/rag/extract.ts
//
// PDF, DOCX, and PPTX all go through officeparser's unified parser (it
// auto-detects zip-backed formats from magic bytes for docx/pptx, and PDF
// text extraction natively) rather than pdf-parse + mammoth as two separate
// libraries — one dependency, one code path, per RestPlan.md Phase 4
// "Extract". Audio/video recordings are transcribed (./transcribe.ts), and
// plain-text transcripts or captions (.txt/.vtt/.srt) are read directly.

const EXTENSION_TO_FILE_TYPE: Record<string, SupportedFileType> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
};

const MIME_TO_FILE_TYPE: Record<string, SupportedFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export class UnsupportedDocumentTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported document type for extraction: "${type}". Supported: PDF, DOCX, PPTX, audio/video, or a transcript (.txt/.vtt/.srt).`);
    this.name = "UnsupportedDocumentTypeError";
  }
}

/** Resolves a Document.type (mime type or bare extension) to officeparser's SupportedFileType. */
export function resolveFileType(type: string): SupportedFileType {
  const normalized = type.trim().toLowerCase();
  const byMime = MIME_TO_FILE_TYPE[normalized];
  if (byMime) return byMime;

  const ext = normalized.replace(/^\./, "").split(/[.;]/).pop() ?? normalized;
  const byExt = EXTENSION_TO_FILE_TYPE[ext];
  if (byExt) return byExt;

  throw new UnsupportedDocumentTypeError(type);
}

/**
 * Extracts plain text from a document buffer. Throws UnsupportedDocumentTypeError
 * for anything outside PDF/DOCX/PPTX, and a plain Error (surfaced by the
 * caller as Document.processingStatus = FAILED with the specific message)
 * for parser failures — a corrupt or scanned-image-only file must fail
 * loudly, never silently produce an empty document.
 */
export async function extractText(buffer: Buffer, type: string): Promise<string> {
  const mime = type.split(";")[0].trim().toLowerCase();
  if (isMediaType(mime)) return transcribeMedia(buffer, mime);
  if (mime === "text/plain" || mime === "text/vtt" || mime === "application/x-subrip" || mime === "text/srt") {
    const raw = buffer.toString("utf8");
    const text = mime === "text/plain" ? raw.trim() : captionsToText(raw);
    if (!text) throw new Error("The transcript file is empty.");
    return text;
  }

  const fileType = resolveFileType(type);
  const ast = await parseOffice(buffer, { fileType });
  const { value } = await ast.to("text");

  const text = typeof value === "string" ? value : "";
  if (text.trim().length === 0) {
    throw new Error(
      "No extractable text was found in this document (it may be a scanned image with no text layer).",
    );
  }
  return text;
}
