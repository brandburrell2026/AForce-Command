/**
 * Superfood Signals.
 *
 * When HydroScan recognizes an AForce product, surface a
 * "SUPERFOOD SIGNALS ACTIVE" block — five signal chips that name the
 * categories the product supports (mineral, recovery, electrolyte
 * efficiency, cellular hydration, performance) plus a "TAP TO LEARN
 * WHY" CTA that opens an education layer covering the mineral-rich
 * superfoods themselves (seamoss, dulse, chlorella).
 *
 * ── Tone & compliance constraints ─────────────────────────────────
 * AForce is a hydration product, NOT a medical device or drug. Every
 * string this file emits must use COMPLIANT language only:
 *
 *   ALLOWED:  supports, assists, may help support, contributes to,
 *             designed to support
 *
 *   BANNED:   cures, treats, prevents disease, prevents <any disease>,
 *             diagnoses, heals, fixes, eliminates symptoms
 *
 * A hard regression test in __tests__/superfoodSignals.test.ts
 * scans every exported string for those banned words and fails the
 * build if any appear. Add new copy through this file only so the
 * compliance gate covers it.
 *
 * ── Sodium framing ────────────────────────────────────────────────
 * Sodium is NEVER described as bad. The product brief is explicit:
 * "Hydration requires balance, not just sodium loading." That exact
 * sentence is the canonical sodium note exported below; UI surfaces
 * that touch electrolyte messaging must use it verbatim.
 */

/** Stable machine keys for each superfood signal chip. */
export type SuperfoodSignalKey =
  | 'mineralSupport'
  | 'recoverySupport'
  | 'electrolyteEfficiency'
  | 'cellularHydrationSupport'
  | 'performanceSupport';

export interface SuperfoodSignal {
  key: SuperfoodSignalKey;
  /** Short chip label rendered on the result card. */
  label: string;
}

/** Stable machine keys for each education-layer entry. */
export type SuperfoodTopicKey =
  | 'seamoss'
  | 'dulse'
  | 'chlorella'
  | 'mineralSupport'
  | 'balancedHydrationSupport';

export interface SuperfoodEducationEntry {
  key: SuperfoodTopicKey;
  /** Short headline / chip label for the education sheet. */
  title: string;
  /** One-sentence compliant explanation. */
  body: string;
}

export interface SuperfoodSignalsBlock {
  /** Section header — always "SUPERFOOD SIGNALS ACTIVE". */
  header: string;
  /** Chip list, stable order. */
  signals: readonly SuperfoodSignal[];
  /** CTA text for the education-sheet opener. */
  learnCta: string;
  /** Education-layer entries surfaced when the user taps the CTA. */
  education: readonly SuperfoodEducationEntry[];
  /** AForce positioning statement — single source of truth. */
  positioning: string;
  /** Canonical sodium-balance note. NEVER frames sodium as bad. */
  sodiumNote: string;
}

// ── Canonical strings ──────────────────────────────────────────────
// Single source of truth — every UI surface that renders Superfood
// Signals must read from these constants so the compliance gate
// covers them.

export const SUPERFOOD_SIGNALS_HEADER = 'SUPERFOOD SIGNALS ACTIVE';

export const SUPERFOOD_LEARN_CTA = 'TAP TO LEARN WHY';

export const AFORCE_POSITIONING =
  'Balanced hydration support with mineral-rich superfoods designed to support recovery, hydration efficiency, and performance.';

export const SODIUM_BALANCE_NOTE =
  'Hydration requires balance, not just sodium loading.';

const SIGNALS: readonly SuperfoodSignal[] = [
  { key: 'mineralSupport', label: 'Mineral Support' },
  { key: 'recoverySupport', label: 'Recovery Support' },
  { key: 'electrolyteEfficiency', label: 'Electrolyte Efficiency' },
  { key: 'cellularHydrationSupport', label: 'Mineral + Hydration Support' },
  { key: 'performanceSupport', label: 'Performance Support' },
];

const EDUCATION: readonly SuperfoodEducationEntry[] = [
  {
    key: 'seamoss',
    title: 'Sea Moss',
    body: 'Sea moss is a mineral-rich red algae traditionally used for its broad-spectrum trace mineral profile, which may help support hydration and recovery.',
  },
  {
    key: 'dulse',
    title: 'Dulse',
    body: 'Dulse is a red seaweed that contributes naturally occurring iodine, potassium, and magnesium, and may help support electrolyte balance.',
  },
  {
    key: 'chlorella',
    title: 'Chlorella',
    body: 'Chlorella is a freshwater green algae rich in chlorophyll and trace minerals that may help support cellular hydration and recovery.',
  },
  {
    key: 'mineralSupport',
    title: 'Mineral Support',
    body: 'A balanced spectrum of minerals supports the body’s natural fluid balance, assisting both hydration efficiency and performance.',
  },
  {
    key: 'balancedHydrationSupport',
    title: 'Balanced Hydration Support',
    body: 'Hydration requires balance, not just sodium loading. Mineral-rich superfoods contribute to a more complete electrolyte profile that may help support recovery and performance.',
  },
];

/** Exposed for tests + callers that want the raw list without a block. */
export function superfoodSignalsList(): readonly SuperfoodSignal[] {
  return SIGNALS;
}

/** Exposed for tests + callers that want the raw education entries. */
export function superfoodEducationEntries(): readonly SuperfoodEducationEntry[] {
  return EDUCATION;
}

/**
 * Builds the full Superfood Signals block. Pure; no I/O. Callers pass
 * a flag indicating whether the scanned product is an AForce product
 * — the block is only meaningful for AForce SKUs, so non-AForce
 * scans get `null` and skip the chip render entirely.
 */
export function buildSuperfoodSignalsBlock(args: {
  isAForce: boolean;
}): SuperfoodSignalsBlock | null {
  if (!args.isAForce) return null;
  return {
    header: SUPERFOOD_SIGNALS_HEADER,
    signals: SIGNALS,
    learnCta: SUPERFOOD_LEARN_CTA,
    education: EDUCATION,
    positioning: AFORCE_POSITIONING,
    sodiumNote: SODIUM_BALANCE_NOTE,
  };
}

/**
 * Every user-facing string this module emits, flattened for the
 * compliance-language regression test. Keep this in sync whenever
 * new copy is added so the banned-words sweep covers it.
 */
export function allSuperfoodCopy(): readonly string[] {
  return [
    SUPERFOOD_SIGNALS_HEADER,
    SUPERFOOD_LEARN_CTA,
    AFORCE_POSITIONING,
    SODIUM_BALANCE_NOTE,
    ...SIGNALS.map((s) => s.label),
    ...EDUCATION.flatMap((e) => [e.title, e.body]),
  ];
}
