/**
 * Pure logic for the af.* primitive library (F2). Extracted from the RN
 * components so it is unit-testable in the node vitest environment (the
 * components themselves import react-native and cannot be collected there).
 *
 * No react-native / react import here — numbers and strings only.
 */

/** Clamp any input to a 0…1 progress fraction (guards NaN/Infinity/out-of-range). */
export function clampProgress(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

/**
 * Full-circle ring geometry for AFProgressRing (a determinate/indeterminate
 * ring). `stroke` is the ring thickness; the radius is inset by half the
 * stroke so the stroke never clips the viewbox edge.
 */
export function ringGeometry(size: number, stroke: number, progress: number) {
  const clamped = clampProgress(progress);
  const radius = Math.max(0, (size - stroke) / 2);
  const circumference = 2 * Math.PI * radius;
  return {
    clamped,
    radius,
    circumference,
    // strokeDasharray = full circumference; dashoffset shrinks as progress fills.
    dashoffset: circumference * (1 - clamped),
  };
}

/**
 * Partial-arc geometry for AFReadinessArc — a `sweepDeg` arc (default 270°,
 * the "thin arc" behind the readiness value). Returns the dash/gap pair that
 * draws only the arc plus the dashoffset that fills it to `progress`.
 */
export function arcGeometry(
  size: number,
  stroke: number,
  progress: number,
  sweepDeg = 270,
) {
  const clamped = clampProgress(progress);
  const radius = Math.max(0, (size - stroke) / 2);
  const circumference = 2 * Math.PI * radius;
  const sweep = Math.max(0, Math.min(360, sweepDeg)) / 360;
  const arcLength = circumference * sweep;
  return {
    clamped,
    radius,
    circumference,
    arcLength,
    // Track: draw `arcLength`, then gap out the remainder.
    dashArray: `${arcLength} ${circumference}`,
    // Fill: offset so only `clamped` of the arc is painted.
    dashoffset: arcLength * (1 - clamped),
  };
}

export type TrendDirection = 'up' | 'down' | 'flat';

/** Resolve a numeric delta into a trend direction + accessible sign. */
export function trendOf(delta: number | null | undefined): {
  direction: TrendDirection;
  sign: string;
} {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return { direction: 'flat', sign: '' };
  }
  return delta > 0
    ? { direction: 'up', sign: '+' }
    : { direction: 'down', sign: '−' }; // U+2212 minus, not hyphen
}

export type AFButtonVariant = 'primary' | 'secondary' | 'text';
export type AFButtonPhase = 'default' | 'pressed' | 'disabled' | 'loading';

/**
 * Resolve a button's phase from its interaction flags, in priority order:
 * disabled > loading > pressed > default. Kept pure so the precedence is
 * pinned by a test rather than living implicitly in JSX.
 */
export function buttonPhase(flags: {
  disabled?: boolean;
  loading?: boolean;
  pressed?: boolean;
}): AFButtonPhase {
  if (flags.disabled) return 'disabled';
  if (flags.loading) return 'loading';
  if (flags.pressed) return 'pressed';
  return 'default';
}

/** A button is non-interactive while disabled OR loading. */
export function buttonIsInert(flags: { disabled?: boolean; loading?: boolean }): boolean {
  return Boolean(flags.disabled || flags.loading);
}

// ─── AFChart scaling (F3) ────────────────────────────────────────────────────

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

/**
 * Map a value series into SVG coordinates for AFChart. y is inverted (SVG is
 * y-down, so the highest value sits at the smallest y). A flat series (or a
 * single point) pins to the vertical mid-line rather than dividing by zero.
 * `pad` insets the plot so stroke caps and dots don't clip the viewbox.
 */
export function chartScale(
  values: number[],
  width: number,
  height: number,
  pad = 6,
): { points: ChartPoint[]; polyline: string; min: number; max: number } {
  if (values.length === 0) return { points: [], polyline: '', min: 0, max: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const innerW = Math.max(0, width - pad * 2);
  const innerH = Math.max(0, height - pad * 2);
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    // Flat series → mid-line; else invert so max is at the top.
    const norm = range === 0 ? 0.5 : (v - min) / range;
    const y = pad + innerH * (1 - norm);
    return { x, y, value: v };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  return { points, polyline, min, max };
}

// ─── AFTimeline step states (F3) ─────────────────────────────────────────────

export type AFTimelineStepState = 'completed' | 'current' | 'upcoming' | 'locked' | 'hold';

/** Only the current + upcoming steps are actionable; completed/locked/hold are not. */
export function timelineStepIsActionable(state: AFTimelineStepState): boolean {
  return state === 'current' || state === 'upcoming';
}
