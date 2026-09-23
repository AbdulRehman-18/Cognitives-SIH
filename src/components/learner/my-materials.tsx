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
    <section className={cn("flex flex-col gap-[10px]", className)}>
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex flex-col gap-[2px]">
          <h2 className="text-[13px] font-semibold text-foreground">Your study material</h2>
          <p className="text-[12px] leading-[1.5] text-muted-foreground">Private to you. Used alongside your trainers’ course documents.</p>
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
              "h-[28px] w-auto rounded-[8px] border border-[color:var(--color-border-hover)] bg-transparent px-[10px] text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-surface-1)] focus-within:ring-2 focus-within:ring-[color:var(--color-accent)]/30 data-[state=uploading]:opacity-60 after:bg-[color:var(--color-accent)]/15",
            container: "shrink-0",
            allowedContent: "hidden",
          }}
          content={{ button: "Upload" }}
        />
      </div>

      {error && <p className="text-[12px] text-[color:var(--color-critical)]" role="alert">{error}</p>}

      {documents.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[color:var(--color-border-hover)] px-[12px] py-[10px] text-[12px] leading-[1.5] text-muted-foreground">
          Add notes, slides or transcripts — PDF, DOCX, PPTX, audio or video.
        </p>
      ) : (
        <ul className="flex flex-col">
          {documents.map((d) => (
            <li key={d.id} className="group flex items-center gap-[10px] border-b border-[color:var(--color-border-resting)] py-[8px] last:border-b-0">
              <FileText className="size-[14px] shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">{d.fileName ?? "Untitled document"}</p>
                <p className="flex items-center gap-[6px] text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "size-[5px] rounded-full",
                      d.processingStatus === "READY" && "bg-[color:var(--color-grow)]",
                      d.processingStatus === "FAILED" && "bg-[color:var(--color-critical)]",
                      IN_FLIGHT.has(d.processingStatus) && "animate-pulse bg-[color:var(--color-ink-faint)]",
                    )}
                    aria-hidden
                  />
                  <span className={cn(d.processingStatus === "FAILED" && "text-[color:var(--color-critical)]")}>
                    {STATUS_LABEL[d.processingStatus]}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="num">
                    {d.processingStatus === "READY" ? `${d.chunkCount} passages` : formatDate(d.createdAt)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(d.id)}
                disabled={deleting === d.id}
                aria-label={`Delete ${d.fileName ?? "document"}`}
                className="rounded-[6px] p-[5px] text-muted-foreground opacity-60 transition-[opacity,color,background-color] hover:bg-[color:var(--color-surface-1)] hover:text-[color:var(--color-critical)] hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
              >
                <Trash2 className="size-[14px]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
