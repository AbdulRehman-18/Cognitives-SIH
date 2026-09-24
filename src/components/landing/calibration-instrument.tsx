"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// The landing page's signature moment: four domain readouts start as the
// wide estimate a role profile gives, then narrow one by one to a measured
// range, and the gap to the role's target is marked last. Synthetic data,
// labelled as such on the instrument.

interface Domain {
  name: string;
  /** Measured range on the 1–5 scale; null = not yet assessed. */
  range: [number, number] | null;
  target: number;
}

const DOMAINS: Domain[] = [
  { name: "Statistical", range: [2.1, 2.7], target: 4 },
  { name: "Technical", range: [3.0, 3.5], target: 4 },
  { name: "Digital governance", range: [3.7, 4.2], target: 4 },
  { name: "Behavioural", range: null, target: 4 },
];

const pos = (level: number) => ((level - 1) / 4) * 100;
const STATUS = ["Estimating from your role profile", "Measuring · adaptive diagnostic", "Measured · 3 of 4 domains"];

export function CalibrationInstrument({ className }: { className?: string }) {
  // 0: role-profile estimate · 1: measuring · 2: settled
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Calibrate when the instrument is actually on screen (below the fold on phones).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setPhase(2));
      return () => cancelAnimationFrame(id);
    }
    const timers = [setTimeout(() => setPhase(1), 700), setTimeout(() => setPhase(2), 700 + DOMAINS.length * 380 + 900)];
    return () => timers.forEach(clearTimeout);
  }, [run, visible]);

  const measured = phase >= 1;
  const settled = phase === 2;

  return (
    <figure
      ref={ref}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[20px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-1)] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_64px_-24px_rgba(20,18,16,0.35)]",
        className,
      )}
      aria-label="Example domain readout calibrating from an estimate to measured ranges"
    >
      <div className="flex items-center justify-between gap-[12px] border-b border-[color:var(--color-border-resting)] px-[20px] py-[14px] sm:px-[24px]">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span className={cn("size-[7px] shrink-0 rounded-full transition-colors duration-500", settled ? "bg-[color:var(--color-grow)]" : "animate-pulse bg-[color:var(--color-accent)]")} aria-hidden />
          <p className="truncate text-[13px] font-medium text-foreground" aria-live="polite">{STATUS[phase]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-[6px]">
          <span className="rounded-[6px] border border-[color:var(--color-border-resting)] px-[6px] py-[1px] text-[11px] text-muted-foreground">Example</span>
          <button
            type="button"
            onClick={() => { setPhase(0); setRun((r) => r + 1); }}
            disabled={!settled}
            className="grid size-[28px] place-items-center rounded-[8px] text-muted-foreground outline-none transition-colors hover:bg-[color:var(--color-canvas)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60 disabled:opacity-30"
            aria-label="Run the calibration again"
          >
            <RotateCcw className="size-[14px]" aria-hidden />
          </button>
        </div>
      </div>

      <ul className="flex flex-col px-[20px] sm:px-[24px]">
        {DOMAINS.map((d, i) => {
          const lo = d.range ? pos(d.range[0]) : 0;
          const hi = d.range ? pos(d.range[1]) : 100;
          const t = pos(d.target);
          const met = d.range ? d.range[1] >= d.target : false;
          const unassessed = !d.range;
          const delay = `${i * 380}ms`;
          return (
            <li key={d.name} className="flex flex-col gap-[10px] border-b border-[color:var(--color-border-resting)] py-[18px] last:border-b-0">
              <div className="flex items-baseline justify-between gap-[12px]">
                <span className="text-[14px] font-medium text-foreground">{d.name}</span>
                <span className="num text-[12px] text-muted-foreground transition-opacity duration-500" style={{ opacity: measured ? 1 : 0.35, transitionDelay: measured ? `calc(${delay} + 600ms)` : "0ms" }}>
                  {unassessed ? (measured ? "Not yet assessed" : "L1–L5 est.") : measured ? (
                    <>
                      <span className="text-foreground">L{d.range![0].toFixed(1)}–{d.range![1].toFixed(1)}</span> · target L{d.target}
                    </>
                  ) : "L1–L5 est."}
                </span>
              </div>

              <div className="relative h-[22px]">
                {/* Rule */}
                <div className={cn("absolute inset-x-0 top-[10px] h-px", unassessed && measured ? "border-t border-dashed border-[color:var(--color-ink-faint)]" : "bg-[color:var(--color-border-hover)]")} />
                {Array.from({ length: 17 }, (_, k) => k).map((k) => {
                  const major = k % 4 === 0;
                  return (
                    <span key={k} className="absolute top-[10px] w-px -translate-x-1/2" style={{ left: `${(k / 16) * 100}%`, height: major ? 8 : 4, marginTop: major ? -4 : -2, background: major ? "var(--color-ink-faint)" : "var(--color-border-hover)" }} />
                  );
                })}

                {/* Gap to target */}
                {!unassessed && !met && (
                  <span
                    className="landing-hatch absolute top-[6px] h-[9px] rounded-[2px] transition-opacity duration-700"
                    style={{ left: `${hi}%`, width: `${t - hi}%`, opacity: settled ? 1 : 0, transitionDelay: settled ? `${i * 120}ms` : "0ms", ["--hatch" as string]: d.target - d.range![1] >= 1 ? "var(--color-critical)" : "var(--color-moderate)" } as React.CSSProperties}
                  />
                )}

                {/* Range band: the estimate narrowing to a measurement */}
                <span
                  className="absolute top-[4px] h-[13px] rounded-[3px] transition-[left,width,background-color,opacity] duration-[900ms] ease-[var(--ease-entrance)]"
                  style={{
                    left: `${measured ? lo : 0}%`,
                    width: `${measured ? Math.max(hi - lo, 1.5) : 100}%`,
                    background: measured ? (met ? "var(--color-grow)" : "var(--color-accent)") : "var(--color-accent-15)",
                    opacity: unassessed && measured ? 0 : 1,
                    transitionDelay: measured ? delay : "0ms",
                  }}
                />

                {/* Role target */}
                <span className="absolute top-0 h-[22px] -translate-x-1/2 border-l border-dashed border-[color:var(--color-ink)]" style={{ left: `${t}%` }} aria-hidden />
              </div>
            </li>
          );
        })}
      </ul>

      <figcaption
        className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/40 px-[20px] py-[14px] text-[13px] transition-opacity duration-700 sm:px-[24px]"
        style={{ opacity: settled ? 1 : 0.35 }}
      >
        <span className="text-muted-foreground">Largest gap</span>
        <span className="font-medium text-foreground">Survey Design</span>
        <span className="num text-muted-foreground">L2 → L4</span>
        <span className="text-muted-foreground" aria-hidden>→</span>
        <span className="text-foreground">routed to <span className="font-medium">Nuances of Data Collection</span></span>
        <span className="num text-muted-foreground">iGOT · 6h</span>
      </figcaption>
    </figure>
  );
}
