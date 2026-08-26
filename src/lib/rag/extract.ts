import "server-only";

import { parseOffice, type SupportedFileType } from "officeparser";

// Extraction — src/lib/rag/extract.ts
//
// PDF, DOCX, and PPTX all go through officeparser's unified parser (it
// auto-detects zip-backed formats from magic bytes for docx/pptx, and PDF
// text extraction natively) rather than pdf-parse + mammoth as two separate
// libraries — one dependency, one code path, per RestPlan.md Phase 4
// "Extract". Video/audio transcription is explicitly out of scope (P2).

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
    super(`Unsupported document type for extraction: "${type}". Supported: PDF, DOCX, PPTX.`);
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
