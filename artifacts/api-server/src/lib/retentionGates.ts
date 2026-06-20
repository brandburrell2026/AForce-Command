/**
 * RETENTION GATES — pure scorecard math for the founder Command Center.
 *
 * The owner's five retention gates are, by their own definitions and the
 * `@workspace/activation-core` funnel, EVENT-LIFECYCLE conversions:
 *
 *   Gate 1  App Open → Profile Complete            target  ≥ 80%
 *   Gate 2  Profile Complete → First Command       target  < 60s (median)
 *   Gate 3  Day 1 → Day 7 retention                target  ≥ 40%
 *   Gate 4  Day 7 → Day 30 retention               target  ≥ 25%
 *   Gate 5  QR Scan → Activated User               target  ≥ 50%
 *
 * Score-Protection / honesty: this helper only TURNS already-aggregated
 * scalar counts into a gate scorecard. A gate whose denominator (cohort /
 * entered set) is empty is `awaiting` — it shows its target and an
 * explicit awaiting note, never a fabricated 0%. Activation events are not
 * instrumented in Phase 1, so every gate reads `awaiting` until the event
 * pipeline lands; the SQL behind it is correct and lights up automatically
 * once events flow. The route does the aggregation (aggregate-only, no
 * PII); this module is pure + unit-tested.
 */

import { z } from "zod";

export type GateId =
  | "appOpenToProfile"
  | "profileToFirstCommand"
  | "d1ToD7"
  | "d7ToD30"
  | "qrToActivated";

export type GateKind = "rate" | "duration";
export type GateStatus = "passing" | "failing" | "awaiting";

export interface GateTarget {
  /** `gte` for rates (higher is better), `lte` for the duration gate. */
  comparator: "gte" | "lte";
  /** Threshold — a 0..1 rate for rate gates, seconds for the duration gate. */
  value: number;
  /** Human label exactly as the owner stated it ("80%+", "Under 60s"). */
  display: string;
}

export interface GateDef {
  id: GateId;
  index: number;
  label: string;
  fromLabel: string;
  toLabel: string;
  kind: GateKind;
  target: GateTarget;
  /** Shown when the gate has no cohort yet (which events it needs). */
  awaitingNote: string;
}

/** The five gates in owner order. Static definition — never fabricated. */
export const RETENTION_GATE_DEFS: readonly GateDef[] = [
  {
    id: "appOpenToProfile",
    index: 1,
    label: "App Open → Profile Complete",
    fromLabel: "App Open",
    toLabel: "Profile Complete",
    kind: "rate",
    target: { comparator: "gte", value: 0.8, display: "80%+" },
    awaitingNote:
      "Lights up once app_opened and profile_completed events are instrumented.",
  },
  {
    id: "profileToFirstCommand",
    index: 2,
    label: "Profile Complete → First Command",
    fromLabel: "Profile Complete",
    toLabel: "First Command",
    kind: "duration",
    target: { comparator: "lte", value: 60, display: "Under 60s" },
    awaitingNote:
      "Median time from profile_completed to first_command_completed; awaits both events.",
  },
  {
    id: "d1ToD7",
    index: 3,
    label: "Day 1 → Day 7",
    fromLabel: "Day 1",
    toLabel: "Day 7",
    kind: "rate",
    target: { comparator: "gte", value: 0.4, display: "40%+" },
    awaitingNote:
      "Share of the 7-day-matured cohort still active a week after first contact.",
  },
  {
    id: "d7ToD30",
    index: 4,
    label: "Day 7 → Day 30",
    fromLabel: "Day 7",
    toLabel: "Day 30",
    kind: "rate",
    target: { comparator: "gte", value: 0.25, display: "25%+" },
    awaitingNote:
      "Share of the day-7-retained, 30-day-matured cohort still active at day 30.",
  },
  {
    id: "qrToActivated",
    index: 5,
    label: "QR Scan → Activated User",
    fromLabel: "QR Scan",
    toLabel: "Activated",
    kind: "rate",
    target: { comparator: "gte", value: 0.5, display: "50%+" },
    awaitingNote:
      "Activation = first_command_completed; awaits qr_scanned + activation events.",
  },
];

const GateTargetSchema = z.object({
  comparator: z.enum(["gte", "lte"]),
  value: z.number(),
  display: z.string(),
});

const RetentionGateSchema = z.object({
  id: z.enum([
    "appOpenToProfile",
    "profileToFirstCommand",
    "d1ToD7",
    "d7ToD30",
    "qrToActivated",
  ]),
  index: z.number().int(),
  label: z.string(),
  fromLabel: z.string(),
  toLabel: z.string(),
  kind: z.enum(["rate", "duration"]),
  target: GateTargetSchema,
  /** Denominator: identities that entered the gate (cohort size). */
  sampleSize: z.number().int().nonnegative(),
  /** Numerator for rate gates (converted/retained); null for the duration gate. */
  converted: z.number().int().nonnegative().nullable(),
  /** 0..1 rate (rate gates) or median seconds (duration); null when awaiting. */
  measured: z.number().nullable(),
  status: z.enum(["passing", "failing", "awaiting"]),
  awaitingNote: z.string(),
});

export const RetentionGatesSchema = z.object({
  generatedAt: z.string(),
  gates: z.array(RetentionGateSchema),
});

export type RetentionGate = z.infer<typeof RetentionGateSchema>;
export type RetentionGatesDTO = z.infer<typeof RetentionGatesSchema>;

/** Scalar aggregates produced by the route's SQL — already counted in PG. */
export interface RetentionGatesRaw {
  appOpenEntered: number;
  appOpenConverted: number;
  profileToCmdEntered: number;
  profileToCmdMedianSeconds: number | null;
  d7Cohort: number;
  d7Retained: number;
  d30Cohort: number;
  d30Retained: number;
  qrEntered: number;
  qrConverted: number;
}

function clampCount(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function meetsTarget(target: GateTarget, measured: number): boolean {
  return target.comparator === "gte"
    ? measured >= target.value
    : measured <= target.value;
}

function rateGate(def: GateDef, enteredRaw: number, convertedRaw: number): RetentionGate {
  const entered = clampCount(enteredRaw);
  // A conversion can never exceed its denominator; clamp defensively.
  const converted = Math.min(clampCount(convertedRaw), entered);
  const measured = entered > 0 ? converted / entered : null;
  const status: GateStatus =
    entered === 0 || measured === null
      ? "awaiting"
      : meetsTarget(def.target, measured)
        ? "passing"
        : "failing";
  return {
    id: def.id,
    index: def.index,
    label: def.label,
    fromLabel: def.fromLabel,
    toLabel: def.toLabel,
    kind: def.kind,
    target: def.target,
    sampleSize: entered,
    converted,
    measured,
    status,
    awaitingNote: def.awaitingNote,
  };
}

function durationGate(
  def: GateDef,
  enteredRaw: number,
  medianSeconds: number | null,
): RetentionGate {
  const entered = clampCount(enteredRaw);
  const valid =
    medianSeconds != null && Number.isFinite(medianSeconds) && medianSeconds >= 0;
  const measured = entered > 0 && valid ? (medianSeconds as number) : null;
  const status: GateStatus =
    measured === null
      ? "awaiting"
      : meetsTarget(def.target, measured)
        ? "passing"
        : "failing";
  return {
    id: def.id,
    index: def.index,
    label: def.label,
    fromLabel: def.fromLabel,
    toLabel: def.toLabel,
    kind: def.kind,
    target: def.target,
    sampleSize: entered,
    converted: null,
    measured,
    status,
    awaitingNote: def.awaitingNote,
  };
}

function defById(id: GateId): GateDef {
  const def = RETENTION_GATE_DEFS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown retention gate id: ${id}`);
  return def;
}

/**
 * Turn the scalar SQL aggregates into the five-gate scorecard DTO. Pure:
 * no clock, no IO. Pass `generatedAt` from the caller.
 */
export function buildRetentionGates(
  raw: RetentionGatesRaw,
  generatedAt: string,
): RetentionGatesDTO {
  return {
    generatedAt,
    gates: [
      rateGate(defById("appOpenToProfile"), raw.appOpenEntered, raw.appOpenConverted),
      durationGate(
        defById("profileToFirstCommand"),
        raw.profileToCmdEntered,
        raw.profileToCmdMedianSeconds,
      ),
      rateGate(defById("d1ToD7"), raw.d7Cohort, raw.d7Retained),
      rateGate(defById("d7ToD30"), raw.d30Cohort, raw.d30Retained),
      rateGate(defById("qrToActivated"), raw.qrEntered, raw.qrConverted),
    ],
  };
}
