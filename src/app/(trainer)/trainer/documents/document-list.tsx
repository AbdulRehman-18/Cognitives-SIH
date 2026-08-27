"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { ProcessingState, type ProcessingStage } from "@/components/caliper/processing-state";
import { FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DocumentSummary {
  id: string;
  type: string;
  processingStatus: "PENDING" | "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "READY" | "FAILED";
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
}

const STAGES: ProcessingStage[] = [
  { key: "EXTRACTING", label: "Extracting text" },
  { key: "CHUNKING", label: "Splitting into chunks" },
  { key: "EMBEDDING", label: "Generating embeddings" },
  { key: "READY", label: "Ready for question generation" },
];

const IN_PROGRESS_STATUSES = new Set(["PENDING", "EXTRACTING", "CHUNKING", "EMBEDDING"]);
const POLL_INTERVAL_MS = 2000;

function stageKeyFor(status: DocumentSummary["processingStatus"]): string {
  // PENDING hasn't started extraction yet, but there's no dedicated
  // "queued" visual in ProcessingState — showing it as the active
  // EXTRACTING stage is accurate (that's the very next stage) and matches
  // what happens within seconds of upload.
  if (status === "PENDING") return "EXTRACTING";
  if (status === "FAILED") return "EXTRACTING"; // overridden per-row below using the persisted stage from errorMessage
  return status;
}

function friendlyType(type: string): string {
  if (type.includes("pdf")) return "PDF";
  if (type.includes("wordprocessing")) return "DOCX";
  if (type.includes("presentation")) return "PPTX";
  return type;
}

/** Extracts the failed stage key from a pipeline error message like "Failed while EMBEDDING: ...". */
function failedStageFrom(errorMessage: string | null): string {
  const match = errorMessage?.match(/Failed while (\w+):/);
  return match?.[1] ?? "EXTRACTING";
}

/**
 * Live document list — polls GET /api/documents while any document is
 * still processing, so ProcessingState reflects the pipeline's real,
 * stage-by-stage Document.processingStatus rather than a client-side guess.
 */
export function DocumentList({ initialDocuments }: { initialDocuments: DocumentSummary[] }) {
  const [documents, setDocuments] = React.useState(initialDocuments);
  const [retrying, setRetrying] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const hasInFlight = documents.some((d) => IN_PROGRESS_STATUSES.has(d.processingStatus));
    if (!hasInFlight) return;

    const interval = setInterval(async () => {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = (await res.json()) as { documents: DocumentSummary[] };
        setDocuments(data.documents);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [documents]);

  const retry = React.useCallback(async (id: string) => {
    setRetrying((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/documents/${id}/process`, { method: "POST" });
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = (await res.json()) as { documents: DocumentSummary[] };
        setDocuments(data.documents);
      }
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  if (documents.length === 0) {
    return (
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>No documents yet</CardTitle>
          <CardDescription>
            Upload source material above to generate RAG-grounded assessment questions from it.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {documents.map((doc) => {
        const failed = doc.processingStatus === "FAILED";
        const currentStageKey = failed ? failedStageFrom(doc.errorMessage) : stageKeyFor(doc.processingStatus);

        return (
          <Card key={doc.id} className="rounded-md">
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium text-foreground">
                    {friendlyType(doc.type)} document
                  </span>
                  <span className="tabular-mono text-xs text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {doc.processingStatus === "READY" ? (
                    <>
                      <span
                        className={cn(
                          "tabular-mono rounded-full border border-[color:var(--color-target)]/40 px-2 py-0.5 text-xs text-[color:var(--color-target)]",
                        )}
                      >
                        {doc.chunkCount} chunks
                      </span>
                      <Link href="/trainer/assessments" className={cn(buttonVariants({ size: "sm" }), "h-7 text-xs")}>
                        Generate questions
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>

              {doc.processingStatus !== "READY" ? (
                <ProcessingState
                  stages={STAGES}
                  currentStageKey={currentStageKey}
                  failed={failed}
                  errorMessage={doc.errorMessage ?? undefined}
                />
              ) : null}

              {failed ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retry(doc.id)}
                  disabled={retrying.has(doc.id)}
                  className="self-start"
                >
                  <RefreshCw className={cn("size-3.5", retrying.has(doc.id) && "animate-spin")} aria-hidden />
                  Retry processing
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
