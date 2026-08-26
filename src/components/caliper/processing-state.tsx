import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProcessingStage {
  key: string;
  label: string;
}

export type ProcessingStatus = "pending" | "active" | "done" | "failed";

export interface ProcessingStateProps {
  stages: ProcessingStage[];
  /** Key of the currently active/failed stage. Stages before it are "done". */
  currentStageKey: string;
  failed?: boolean;
  errorMessage?: string;
  className?: string;
}

function statusFor(
  stages: ProcessingStage[],
  currentIndex: number,
  index: number,
  failed: boolean,
): ProcessingStatus {
  if (index < currentIndex) return "done";
  if (index === currentIndex) return failed ? "failed" : "active";
  return "pending";
}

/**
 * Real staged progress for document processing (upload -> extract -> chunk
 * -> embed -> ready), with an explicit failure stage rather than a generic
 * spinner (PRD §4.6 / §4.11).
 */
export function ProcessingState({
  stages,
  currentStageKey,
  failed = false,
  errorMessage,
  className,
}: ProcessingStateProps) {
  const currentIndex = Math.max(
    0,
    stages.findIndex((s) => s.key === currentStageKey),
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ol className="flex flex-col gap-2">
        {stages.map((stage, i) => {
          const status = statusFor(stages, currentIndex, i, failed);
          return (
            <li key={stage.key} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  status === "done" &&
                    "border-[color:var(--color-target)] bg-[color:var(--color-target)] text-white",
                  status === "active" &&
                    "border-[color:var(--color-measure)] text-[color:var(--color-measure)]",
                  status === "failed" &&
                    "border-[color:var(--color-critical)] bg-[color:var(--color-critical)] text-white",
                  status === "pending" && "border-border text-muted-foreground",
                )}
              >
                {status === "done" ? (
                  <Check className="size-3" aria-hidden />
                ) : status === "failed" ? (
                  <X className="size-3" aria-hidden />
                ) : status === "active" ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-sm",
                  status === "pending" ? "text-muted-foreground" : "text-foreground",
                  status === "failed" && "font-medium text-[color:var(--color-critical)]",
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
      {failed && errorMessage ? (
        <p className="rounded-md border border-[color:var(--color-critical)]/30 bg-[color-mix(in_oklch,var(--color-critical),transparent_94%)] p-2.5 text-xs text-[color:var(--color-critical)]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
