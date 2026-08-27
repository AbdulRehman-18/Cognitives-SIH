"use client";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface ReasonFactor {
  key: string;
  label: string;
  value: number;
  weight: number;
}
export interface ReasonBreakdownProps {
  factors: ReasonFactor[];
  score: number;
  className?: string;
}

export function ReasonBreakdown({ factors, score, className }: ReasonBreakdownProps) {
  const [open, setOpen] = useState(false);
  const maxContrib = Math.max(...factors.map((f) => f.value * f.weight), 0.01);

  return (
    <div className={cn("rounded-[10px] border border-[color:var(--color-border-resting)] bg-transparent overflow-hidden", className)}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-[10px] py-[8px] hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition text-left">
        <span className="text-[10px] font-medium tracking-[0.08em] uppercase text-muted-foreground">Why this ranking</span>
        <span className="flex items-center gap-[8px]">
          <span className="num text-[11px] font-medium tabular-mono text-foreground">{score.toFixed(3)}</span>
          <span className={`size-5 rounded-full border grid place-items-center text-[10px] leading-none transition ${open ? "bg-foreground text-background border-foreground" : "border-[color:var(--color-border-resting)] text-muted-foreground"}`}>{open ? "−" : "+"}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-[color:var(--color-border-resting)] p-[12px] flex flex-col gap-[8px] bg-[color:var(--color-surface-1)]">
          {factors.map((f) => {
            const contrib = f.value * f.weight;
            return (
              <div key={f.key} className="flex flex-col gap-[4px]">
                <div className="flex items-baseline justify-between gap-[8px]">
                  <span className="text-[12px] font-medium leading-none">{f.label}</span>
                  <span className="num text-[11px] tabular-mono text-muted-foreground">{f.value.toFixed(2)} × {f.weight.toFixed(2)} = <b className="text-foreground">{contrib.toFixed(3)}</b></span>
                </div>
                <div className="h-[6px] rounded-full bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] overflow-hidden">
                  <div className="h-full rounded-full bg-[color:var(--color-ink)]" style={{ width: `${(contrib / maxContrib) * 100}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground mt-[4px]">Contributions sum to <b className="text-foreground tabular-mono">{score.toFixed(4)}</b> — every factor shown.</p>
        </div>
      )}
    </div>
  );
}
