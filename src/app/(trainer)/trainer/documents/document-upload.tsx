"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadButton } from "@/lib/uploadthing";

/**
 * Uploads a source document (PDF/DOCX/PPTX) via UploadThing, then kicks off
 * the extract -> chunk -> embed pipeline for it. The process call is
 * fire-and-forget from this component's perspective — DocumentList polls
 * GET /api/documents for live status, which reflects the real
 * Document.processingStatus the pipeline writes stage-by-stage.
 */
export function DocumentUpload({ onUploaded }: { onUploaded?: () => void }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <UploadButton
        endpoint="documentUploader"
        onUploadBegin={() => setError(null)}
        onClientUploadComplete={(res) => {
          const documentId = res[0]?.serverData?.documentId;
          if (documentId) {
            void fetch(`/api/documents/${documentId}/process`, { method: "POST" });
          }
          router.refresh();
          onUploaded?.();
        }}
        onUploadError={(uploadError: Error) => {
          setError(uploadError.message);
        }}
        appearance={{
          button:
            "rounded-md bg-[color:var(--color-measure)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 data-[state=uploading]:opacity-60",
          container: "flex flex-col items-start gap-2",
          allowedContent: "text-xs text-muted-foreground",
        }}
        content={{
          button: "Upload document",
          allowedContent: "PDF, DOCX, or PPTX",
        }}
      />
      {error ? <p className="text-xs text-[color:var(--color-critical)]">{error}</p> : null}
    </div>
  );
}
