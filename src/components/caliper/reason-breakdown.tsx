import { cn } from "@/lib/utils";

// ReasonBreakdown — src/components/caliper/reason-breakdown.tsx
//
// PRD §4.5 acceptance criterion: every recommendation shows its COMPUTED
// per-factor breakdown — real values from Recommendation.reasonsJson, never a
// hand-written justification or paraphrase. This primitive renders exactly
// what the engine emitted: factor value × weight = contribution, summing to
// the displayed score.

export interface ReasonFactor {
  key: string;
  label: string;
  /** The raw factor value, 0..1 (e.g. similarity 0.82). */
  value: number;
  /** The weight the formula applied to this factor (e.g. 0.35). */
  weight: number;
}

export interface ReasonBreakdownProps {
  factors: ReasonFactor[];
  /** The engine's final score — contributions must sum to this. */
  score: number;
  className?: string;
}

export function ReasonBreakdown({ factors, score, className }: ReasonBreakdownProps) {
  const total = factors.reduce((sum, f) => sum + f.value * f.weight, 0);

  return (
    <div className={cn("rounded-md border border-border bg-card", className)}>
      <div className="border-b border-border px-3 py-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Why this ranking
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {factors.map((factor) => {
            const contribution = factor.value * factor.weight;
            return (
              <tr key={factor.key} className="border-b border-border/50 last:border-b-0">
                <td className="px-3 py-1.5 text-muted-foreground">{factor.label}</td>
                <td className="px-2 py-1.5 text-right tabular-mono text-muted-foreground">
                  {factor.value.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-mono text-muted-foreground">
                  ×{factor.weight.toFixed(2)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-mono text-foreground">
                  {contribution.toFixed(4)}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-border bg-[color-mix(in_oklch,var(--color-measure),transparent_94%)]">
            <td className="px-3 py-1.5 font-medium" colSpan={3}>
              Score
            </td>
            <td className="px-3 py-1.5 text-right font-medium tabular-mono">
              {score.toFixed(4)}
            </td>
          </tr>
        </tbody>
      </table>
      {/* Structural honesty check: if these ever disagree, something is wrong
          with the persisted reasonsJson — surface it rather than hide it. */}
      {Math.abs(total - score) > 1e-6 ? (
        <p className="border-t border-border px-3 py-1.5 text-xs text-[color:var(--color-gap)]">
          Breakdown sums to {total.toFixed(4)} but the stored score is {score.toFixed(4)}.
        </p>
      ) : null}
    </div>
  );
}
