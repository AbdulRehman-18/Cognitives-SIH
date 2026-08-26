"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CaliperGaugeProps {
  value: number | null;
  target?: number;
  min?: number;
  max?: number;
  severity?: "critical" | "high" | "medium" | "low" | "none";
  label?: string;
  srLabel?: string;
  unitLabel?: string;
  className?: string;
  size?: "default" | "compact";
  /** Skeleton loading state — pulsing 8% opacity fill */
  loading?: boolean;
}

const SEVERITY_COLOR: Record<
  NonNullable<CaliperGaugeProps["severity"]>,
  string
> = {
  critical: "var(--color-critical)",
  high: "var(--color-moderate)",
  medium: "var(--color-moderate)",
  low: "var(--color-grow)",
  none: "var(--color-accent)",
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
  loading = false,
}: CaliperGaugeProps) {
  const reduceMotion = usePrefersReducedMotion();
  const ticks = React.useMemo(() => {
    const count = 10;
    return Array.from({ length: count + 1 }, (_, i) => min + (i * (max - min)) / count);
  }, [min, max]);

  const isUnmeasured = value === null;
  const valueX = isUnmeasured || loading ? null : toX(value, min, max);
  const targetX = target !== undefined && !loading ? toX(target, min, max) : null;

  const gapBand =
    valueX !== null && targetX !== null && targetX > valueX
      ? { x: valueX, width: targetX - valueX }
      : null;

  const accentColor = SEVERITY_COLOR[severity];

  // Gauge fill/marker animation: 600ms entrance, once on mount, skip if reduced motion
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // Trigger entrance on next frame so CSS transition fires
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Skeleton state
  if (loading) {
    return (
      <div className={cn("w-full", size === "compact" ? "max-w-[240px]" : "", className)}>
        {label ? (
          <div className="mb-[8px] flex items-baseline justify-between gap-2">
            <span className="text-eyebrow text-muted-foreground opacity-60">{label}</span>
          </div>
        ) : null}
        <div
          role="status"
          aria-label={`${srLabel ?? label ?? "Competency"}: loading`}
          className="h-[64px] w-full overflow-hidden rounded-[4px] bg-[color:var(--color-border-resting)]"
          style={{ animation: reduceMotion ? undefined : "gauge-pulse 1.4s ease-in-out infinite" }}
        >
          <div className="h-full w-full opacity-[0.08] bg-[color:var(--color-ink)]" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", size === "compact" ? "max-w-[240px]" : "", className)}>
      {label ? (
        <div className="mb-[8px] flex items-baseline justify-between gap-2">
          <span className="text-eyebrow text-muted-foreground">{label}</span>
          {isUnmeasured ? (
            <span className="text-small text-[color:var(--color-unassessed)]">
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
          stroke="var(--color-border-resting)"
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
              stroke="var(--color-border-resting)"
              strokeWidth={major ? 1.5 : 1}
            />
          );
        })}

        {/* Gap band — animates width from 0 on mount */}
        {gapBand ? (
          <rect
            x={gapBand.x}
            y={TRACK_Y - 5}
            width={reduceMotion ? gapBand.width : mounted ? gapBand.width : 0}
            height={10}
            fill={accentColor}
            opacity={0.16}
            rx={1}
            style={
              reduceMotion
                ? undefined
                : { transition: "width var(--duration-gauge) var(--ease-entrance)" }
            }
          />
        ) : null}

        {/* Target marker — fades in */}
        {targetX !== null ? (
          <g
            style={
              reduceMotion
                ? undefined
                : {
                    opacity: mounted ? 1 : 0,
                    transition: "opacity var(--duration-gauge) var(--ease-entrance)",
                  }
            }
          >
            <line
              x1={targetX}
              y1={TRACK_Y - 14}
              x2={targetX}
              y2={TRACK_Y + 14}
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
            <text
              x={targetX}
              y={TRACK_Y - 18}
              textAnchor="middle"
              className="tabular-mono"
              fontSize={9}
              fill="var(--color-accent)"
              style={{ fontFamily: "var(--font-mono)" }}
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
              stroke="var(--color-unassessed)"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
            <circle
              cx={(TRACK_X0 + TRACK_X1) / 2}
              cy={TRACK_Y}
              r={4}
              fill="var(--color-canvas)"
              stroke="var(--color-unassessed)"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          </g>
        ) : (
          <g
            style={
              reduceMotion
                ? undefined
                : {
                    transform: `translate(${mounted ? valueX : TRACK_X0}px, 0)`,
                    transition: "transform var(--duration-gauge) var(--ease-entrance)",
                  }
            }
            // When reduced motion, render directly at final position
            transform={reduceMotion ? `translate(${valueX}, 0)` : undefined}
          >
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
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}
