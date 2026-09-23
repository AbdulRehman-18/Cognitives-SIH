"use client";

import { useOptimistic, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setWeeklyBudgetAction } from "./actions";
import { PATH_BUDGET_OPTIONS } from "./budget";

// Re-paces the path: the server re-packs the same prerequisite order into
// weeks at the chosen budget.
export function BudgetControl({ value }: { value: number }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(value);

  return (
    <div className="flex items-center gap-[10px]">
      <span id="budget-label" className="text-[12px] text-muted-foreground">Study time</span>
      <div role="radiogroup" aria-labelledby="budget-label" aria-busy={pending} className={cn("flex rounded-[10px] bg-[color:var(--color-surface-1)] p-[3px] ring-1 ring-[color:var(--color-border-resting)] transition-opacity", pending && "opacity-70")}>
        {PATH_BUDGET_OPTIONS.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={optimistic === h}
            onClick={() => startTransition(async () => { setOptimistic(h); await setWeeklyBudgetAction(h); })}
            className={cn(
              "num rounded-[7px] px-[10px] py-[5px] text-[12px] outline-none transition-[color,background-color] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60",
              optimistic === h ? "bg-[color:var(--color-canvas)] font-medium text-foreground shadow-[0_0_0_1px_var(--color-border-hover)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {h}h
          </button>
        ))}
      </div>
      <span className="text-[12px] text-muted-foreground">per week</span>
    </div>
  );
}
