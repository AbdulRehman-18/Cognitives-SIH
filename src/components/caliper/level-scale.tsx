"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface LevelScaleProps {
  /** Measured level, 1–5. */
  current: number;
  /** Level the role requires, 1–5. */
  required: number;
  severity?: "CRITICAL" | "HIGH" | string;
  size?: "sm" | "lg";
  /** viewBox width for the small scale; match it to the rendered width so strokes stay hairline. */
  width?: number;
  label?: string;
  className?: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "var(--color-critical)",
  HIGH: "var(--color-moderate)",
};

/**
 * A five-level caliper: the jaw sits at the measured level, the dashed
 * stop at what the role requires, and the hatched span between them is
 * the gap a tutoring session is working to close.
 */
export function LevelScale({ current, required, severity, size = "sm", width = 120, label, className }: LevelScaleProps) {
  const id = useId().replace(/:/g, "");
  const lg = size === "lg";
  const W = lg ? 320 : width;
  const H = lg ? 58 : 18;
  const pad = lg ? 14 : 4;
  const y = lg ? 32 : 10;
  const x = (level: number) => pad + ((Math.min(5, Math.max(1, level)) - 1) / 4) * (W - pad * 2);
  const color = SEVERITY_COLOR[severity ?? ""] ?? "var(--color-moderate)";
  const cx = x(current);
  const rx = x(required);
  const minor = Array.from({ length: 17 }, (_, i) => 1 + i / 4);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label ?? "Competency"}: measured level ${current} of 5, role requires ${required}`}
      className={cn("block w-full overflow-visible", className)}
    >
      <defs>
        <pattern id={`hatch-${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={color} strokeWidth="1.4" />
        </pattern>
      </defs>

      <line x1={pad} x2={W - pad} y1={y} y2={y} stroke="var(--color-border-hover)" strokeWidth={1} />
      {minor.map((v) => {
        const major = Number.isInteger(v);
        const h = lg ? (major ? 7 : 3) : major ? 4 : 0;
        return h ? <line key={v} x1={x(v)} x2={x(v)} y1={y - h} y2={y + h} stroke={major ? "var(--color-ink-faint)" : "var(--color-border-hover)"} strokeWidth={1} /> : null;
      })}

      {rx > cx && (
        <g className="level-scale-band" style={{ transformOrigin: `${cx}px ${y}px` }}>
          <rect x={cx} y={y - (lg ? 5 : 3)} width={rx - cx} height={lg ? 10 : 6} fill={color} opacity={0.12} />
          <rect x={cx} y={y - (lg ? 5 : 3)} width={rx - cx} height={lg ? 10 : 6} fill={`url(#hatch-${id})`} opacity={0.55} />
        </g>
      )}

      {/* Required stop */}
      <line x1={rx} x2={rx} y1={y - (lg ? 13 : 7)} y2={y + (lg ? 13 : 7)} stroke="var(--color-ink)" strokeWidth={1.25} strokeDasharray="2 2" />
      {/* Measured jaw */}
      <rect x={cx - (lg ? 1.5 : 1)} y={y - (lg ? 13 : 7)} width={lg ? 3 : 2} height={lg ? 26 : 14} rx={1} fill="var(--color-accent)" />
      <circle cx={cx} cy={y} r={lg ? 4.5 : 2.75} fill="var(--color-accent)" stroke="var(--color-surface-1)" strokeWidth={lg ? 2 : 1.5} />

      {lg && (
        <g style={{ fontFamily: "var(--font-mono)" }} fontSize={9.5}>
          {[1, 2, 3, 4, 5].map((l) => (
            <text key={l} x={x(l)} y={H - 1} textAnchor="middle" fill={l === current || l === required ? "var(--color-ink)" : "var(--color-ink-faint)"}>
              L{l}
            </text>
          ))}
          <text x={cx} y={8} textAnchor="middle" fill="var(--color-accent-ink)" letterSpacing="0.06em">NOW</text>
          {rx !== cx && <text x={rx} y={8} textAnchor="middle" fill="var(--color-ink-muted)" letterSpacing="0.06em">ROLE</text>}
        </g>
      )}
    </svg>
  );
}
