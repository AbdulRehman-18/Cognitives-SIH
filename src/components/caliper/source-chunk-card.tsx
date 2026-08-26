import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SourceChunkCardProps {
  /** The originating chunk's own index within its document, for a human-readable citation. */
  chunkIndex: number;
  content: string;
  /** Cosine similarity to the retrieval query that surfaced this chunk, 0..1. */
  similarity?: number;
  className?: string;
}

/**
 * Shows the exact document chunk a generated question was grounded in,
 * beside the question itself. This is what makes "every question is
 * traceable to a source chunk" (PRD §4.7) visible, not merely a hidden
 * foreign key — a trainer reviewing a question can see, in the same
 * glance, whether it actually reflects the source text.
 */
export function SourceChunkCard({ chunkIndex, content, similarity, className }: SourceChunkCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <FileText className="size-3.5" aria-hidden />
          Source chunk #{chunkIndex}
        </div>
        {similarity !== undefined ? (
          <span className="tabular-mono text-[11px] text-muted-foreground">
            {(similarity * 100).toFixed(0)}% match
          </span>
        ) : null}
      </div>
      <p className="max-h-40 overflow-y-auto text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}
