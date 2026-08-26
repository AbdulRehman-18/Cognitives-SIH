"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CaliperGaugeProps {
  /** Current measured value, 0-100. `null` renders the "Not yet assessed" state. */
  value: number | null;
  /** Target/required value, 0-100. Omit to hide the target marker. */
  target?: number;
  /** Domain minimum/maximum for the scale — defaults to a 0-100 measured range. */
  min?: number;
  max?: number;
  /** Severity tint for the gap band, if this gauge represents a tracked gap. */
  severity?: "critical" | "high" | "medium" | "low" | "none";
  label?: string;
  /**
   * Overrides the name used in the SVG's aria-label when no visible `label`
   * is rendered (e.g. when a parent component already shows the name as a
   * heading). Falls back to `label`, then "Competency".
   */
  srLabel?: string;
  /** Accessible unit description, e.g. "competency level, 1 to 5". */
  unitLabel?: string;
  className?: string;
  size?: "default" | "compact";
}

const SEVERITY_COLOR: Record<
  NonNullable<CaliperGaugeProps["severity"]>,
  string
> = {
  critical: "var(--color-critical)",
  high: "var(--color-gap)",
  medium: "var(--color-gap)",
  low: "var(--color-target)",
  none: "var(--color-measure)",
};

const VIEW_W = 320;
const VIEW_H = 64;
const TRACK_Y = 34;
const TRACK_X0 = 12;
const TRACK_X1 = VIEW_W - 12;

function toX(v: number, min: number, max: number) {
  const clamped = Math.min(max, Math.max(min, v));
  const pct = (clamped - min) / (max - min || 1);
  return TRACK_X0 + pct * (TRACK_X1 - TRACK_X0);
}

/**
 * The signature Caliper element: a horizontal instrument scale with
 * calibration ticks, a "jaw" marking the current measured value, an
 * optional target marker, and a shaded band for the gap between them.
 *
 * Zero evidence renders a dashed "Not yet assessed" state — never a
 * fabricated 0 (PRD §4.3 acceptance criterion).
 */
export function CaliperGauge({
  value,
  target,
  min = 0,
  max = 100,
  severity = "none",
  label,
  srLabel,
  unitLabel,
  className,
  size = "default",
}: CaliperGaugeProps) {
  const reduceMotion = usePrefersReducedMotion();
  const ticks = React.useMemo(() => {
    const count = 10;
    return Array.from({ length: count + 1 }, (_, i) => min + (i * (max - min)) / count);
  }, [min, max]);

  const isUnmeasured = value === null;
  const valueX = isUnmeasured ? null : toX(value, min, max);
  const targetX = target !== undefined ? toX(target, min, max) : null;

  const gapBand =
    valueX !== null && targetX !== null && targetX > valueX
      ? { x: valueX, width: targetX - valueX }
      : null;

  const accentColor = SEVERITY_COLOR[severity];

  return (
    <div className={cn("w-full", size === "compact" ? "max-w-[240px]" : "", className)}>
      {label ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {isUnmeasured ? (
            <span className="text-xs font-medium text-[color:var(--color-unmeasured)]">
              Not yet assessed
            </span>
          ) : null}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={
          isUnmeasured
            ? `${srLabel ?? label ?? "Competency"}: not yet assessed`
            : `${srLabel ?? label ?? "Competency"}: ${value}${unitLabel ? ` ${unitLabel}` : ""}${
                target !== undefined ? `, target ${target}` : ""
              }`
        }
        className="w-full overflow-visible"
      >
        {/* Calibration track */}
        <line
          x1={TRACK_X0}
          y1={TRACK_Y}
          x2={TRACK_X1}
          y2={TRACK_Y}
          stroke="var(--color-rule)"
          strokeWidth={1.5}
        />

        {/* Calibration ticks */}
        {ticks.map((t, i) => {
          const x = toX(t, min, max);
          const major = i % 5 === 0;
          return (
            <line
              key={t}
              x1={x}
              y1={TRACK_Y - (major ? 7 : 4)}
              x2={x}
              y2={TRACK_Y + (major ? 7 : 4)}
              stroke="var(--color-rule)"
              strokeWidth={major ? 1.5 : 1}
            />
          );
        })}

        {/* Gap band */}
        {gapBand ? (
          <rect
            x={gapBand.x}
            y={TRACK_Y - 5}
            width={gapBand.width}
            height={10}
            fill={accentColor}
            opacity={0.16}
            rx={1}
          />
        ) : null}

        {/* Target marker */}
        {targetX !== null ? (
          <g>
            <line
              x1={targetX}
              y1={TRACK_Y - 14}
              x2={targetX}
              y2={TRACK_Y + 14}
              stroke="var(--color-target)"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
            <text
              x={targetX}
              y={TRACK_Y - 18}
              textAnchor="middle"
              className="tabular-mono"
              fontSize={9}
              fill="var(--color-target)"
            >
              target
            </text>
          </g>
        ) : null}

        {/* Current value jaw, or dashed unmeasured indicator */}
        {isUnmeasured ? (
          <g opacity={0.7}>
            <line
              x1={TRACK_X0}
              y1={TRACK_Y}
              x2={TRACK_X1}
              y2={TRACK_Y}
              stroke="var(--color-unmeasured)"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
            <circle
              cx={(TRACK_X0 + TRACK_X1) / 2}
              cy={TRACK_Y}
              r={4}
              fill="var(--color-bg)"
              stroke="var(--color-unmeasured)"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          </g>
        ) : (
          <g
            style={
              reduceMotion
                ? undefined
                : { transition: "transform 180ms ease-out" }
            }
            transform={`translate(${valueX}, 0)`}
          >
            {/* Caliper jaw: a downward tick with a small foot, like a measuring jaw */}
            <line x1={0} y1={TRACK_Y - 16} x2={0} y2={TRACK_Y + 4} stroke={accentColor} strokeWidth={2} />
            <path
              d={`M -5 ${TRACK_Y + 4} L 5 ${TRACK_Y + 4} L 0 ${TRACK_Y + 10} Z`}
              fill={accentColor}
            />
            <circle cx={0} cy={TRACK_Y - 16} r={3} fill={accentColor} />
          </g>
        )}
      </svg>
    </div>
  );
}

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion() {
  // useSyncExternalStore is the correct primitive for reading browser state
  // that can change outside React's render cycle (PRD requires full
  // prefers-reduced-motion compliance without setState-in-effect churn).
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false, // server snapshot — SSR always assumes motion is fine
  );
}
