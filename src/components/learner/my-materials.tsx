"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { UploadButton } from "@/lib/uploadthing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MaterialRow {
  id: string;
  fileName: string | null;
  processingStatus: "PENDING" | "EXTRACTING" | "CHUNKING" | "EMBEDDING" | "READY" | "FAILED";
  chunkCount: number;
  createdAt: string;
}

const IN_FLIGHT = new Set(["PENDING", "EXTRACTING", "CHUNKING", "EMBEDDING"]);
const STATUS_LABEL: Record<MaterialRow["processingStatus"], string> = {
  PENDING: "Queued",
  EXTRACTING: "Reading",
  CHUNKING: "Splitting",
  EMBEDDING: "Indexing",
  READY: "Ready",
  FAILED: "Failed",
};

// A learner's private study uploads. Only the owner can retrieve from them
// (tutor + self-evaluation quiz); trainers and other learners never see them.
export function MyMaterials({ initialDocuments, className }: { initialDocuments: MaterialRow[]; className?: string }) {
  const router = useRouter();
  const [documents, setDocuments] = React.useState(initialDocuments);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const refreshList = React.useCallback(async () => {
    const res = await fetch("/api/documents", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { documents: (MaterialRow & { scope: string; createdAt: string })[] };
    setDocuments(data.documents.filter((d) => d.scope === "PERSONAL"));
  }, []);

  // Poll only while something is still processing.
  const processing = documents.some((d) => IN_FLIGHT.has(d.processingStatus));
  React.useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void refreshList(), 2500);
    return () => clearInterval(timer);
  }, [processing, refreshList]);

  async function remove(id: string) {
    setDeleting(id);
    setError(null);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) {
      setError("Couldn't delete that document — try again.");
      return;
    }
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    router.refresh();
  }

  return (
    <section className={cn("rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[16px] flex flex-col gap-[12px]", className)}>
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <h2 className="text-[13px] font-semibold">My study material</h2>
          <p className="text-[12px] text-muted-foreground mt-[2px] max-w-[52ch]">Private to you. The tutor and your self-evaluation quizzes can draw on these alongside your trainers’ course material.</p>
        </div>
        <UploadButton
          endpoint="learnerDocument"
          onUploadBegin={() => setError(null)}
          onClientUploadComplete={async (res) => {
            const documentId = res[0]?.serverData?.documentId;
            await refreshList();
            if (documentId) {
              // Processing takes a while; the list polls for its status.
              void fetch(`/api/documents/${documentId}/process`, { method: "POST" }).finally(() => {
                void refreshList();
                router.refresh();
              });
            }
          }}
          onUploadError={(uploadError: Error) => setError(uploadError.message)}
          appearance={{
            button:
              "rounded-full bg-[color:var(--color-accent)] px-[14px] py-[7px] text-[12px] font-semibold text-white hover:brightness-105 data-[state=uploading]:opacity-60",
            container: "flex flex-col items-end gap-[4px]",
            allowedContent: "text-[11px] text-muted-foreground",
          }}
          content={{ button: "Upload notes", allowedContent: "PDF, DOCX, PPTX, audio/video or transcript" }}
        />
      </div>

      {error && <p className="text-[12px] text-[color:var(--color-critical)]" role="alert">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No personal material yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--color-border-resting)]">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-[10px] py-[8px]">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{d.fileName ?? "Untitled document"}</p>
                <p className="text-[11px] tabular-mono text-muted-foreground">
                  {formatDate(d.createdAt)}
                  {d.processingStatus === "READY" ? ` · ${d.chunkCount} sections indexed` : ""}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-[8px] py-[3px] text-[11px] font-medium",
                  d.processingStatus === "READY" && "border-[#12B76A]/25 bg-[#12B76A]/10 text-[#0E7A4B]",
                  d.processingStatus === "FAILED" && "border-[rgba(240,68,56,0.2)] bg-[rgba(240,68,56,0.1)] text-[#C9190B]",
                  IN_FLIGHT.has(d.processingStatus) && "border-[color:var(--color-border-resting)] text-muted-foreground animate-pulse",
                )}
              >
                {STATUS_LABEL[d.processingStatus]}
              </span>
              <button
                type="button"
                onClick={() => void remove(d.id)}
                disabled={deleting === d.id}
                aria-label={`Delete ${d.fileName ?? "document"}`}
                className="rounded-full p-[6px] text-muted-foreground hover:bg-[color:var(--color-canvas)] hover:text-foreground disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
