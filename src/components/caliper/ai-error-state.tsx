import { AlertTriangle, Clock, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AiErrorKind = "RATE_LIMIT" | "TIMEOUT" | "INVALID_RESPONSE" | "NETWORK";

export interface AiErrorStateProps {
  kind: AiErrorKind;
  onRetry?: () => void;
  className?: string;
}

const ERROR_COPY: Record<
  AiErrorKind,
  { title: string; description: string; icon: typeof AlertTriangle }
> = {
  RATE_LIMIT: {
    title: "Generation is temporarily rate-limited",
    description:
      "The AI provider is throttling requests right now. Wait a moment and try again.",
    icon: Clock,
  },
  TIMEOUT: {
    title: "Generation took too long",
    description:
      "The request didn't complete in time. This is usually transient — try again.",
    icon: Clock,
  },
  INVALID_RESPONSE: {
    title: "Response didn't match the expected format",
    description:
      "The generated content failed validation, so nothing was saved. Retrying usually resolves this.",
    icon: AlertTriangle,
  },
  NETWORK: {
    title: "Couldn't reach the AI provider",
    description: "Check connectivity and try again.",
    icon: WifiOff,
  },
};

/**
 * Every AI surface renders this instead of a blank screen or a hung
 * spinner (PRD §4.11 Reliability). Never silently falls back to a guess.
 */
export function AiErrorState({ kind, onRetry, className }: AiErrorStateProps) {
  const copy = ERROR_COPY[kind];
  const Icon = copy.icon;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-md border border-[color:var(--color-critical)]/30 bg-[color-mix(in_oklch,var(--color-critical),transparent_94%)] p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[color:var(--color-critical)]" aria-hidden />
        <span className="text-sm font-medium text-foreground">{copy.title}</span>
      </div>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
