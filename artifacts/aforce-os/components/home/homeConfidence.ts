/**
 * HOME CONFIDENCE — how much evidence is actually behind the number in Home's
 * hero (Wave 5 residual A, founder 2026-08-12: "make confidence proportional to
 * actual evidence quality, coverage, freshness and provenance. Missing evidence
 * must reduce confidence, not create certainty").
 *
 * WHY THIS EXISTS. `resolveHomeEvidence` (homeBaselineState.ts) is a BINARY
 * authority switch: one logged drink flips Home from "building your baseline"
 * to the full arc, the band word and the trend line, and from that moment on a
 * member with one sip and no wearable saw exactly the visual authority of a
 * member with a week of logs and a connected provider. The gate answers "has
 * AForce observed ANYTHING?"; nothing answered "how much?". That second
 * question is what this module answers, and it answers it strictly at the
 * presentation layer — the audit confirmed HydroState itself makes no
 * confidence claim (see the residual's audit note): `buildBreakdown` sums the
 * evidence it has and clamps, so a single small event yields a small number,
 * not a fabricated one. The over-confidence was entirely in how Home DREW that
 * number. Nothing here computes, reads into, or alters a score.
 *
 * NO NEW ENGINE, NO NEW SCALE. Every judgement below is made by a module that
 * already shipped:
 *   - §54 `assessSignalQuality` grades each evidence slot from its SOURCE
 *     (provenance): a self-logged intake is the phone floor (`limited`), a
 *     wearable-backed biometric is `good`.
 *   - §53 `assessFreshness` + `applyFreshness` CAP each slot by recency — the
 *     literal "missing evidence must reduce confidence" mechanism, since
 *     `freshnessCeiling` can only ever lower a rating (min), never promote one.
 *   - §55 `historyCompletenessLevel` turns days-with-evidence into the shipped
 *     coverage vocabulary, and `coverageCeiling` below applies it as one more
 *     min in the SAME §54 vocabulary — the exact shape `freshnessCeiling` has.
 *   - `signalQualityChip` produces the shipped `ConfidenceChip` model.
 * The composition order (grade the source, cap by freshness, ONE chip — never
 * two) is `dataBehindThis.ts`'s Design Decision 2, applied to Home's slots.
 *
 * FIXED SLOTS ARE THE POINT. `gatherDataBehindSignals` deliberately omits a
 * family with no source (honest absence — the sheet draws no fabricated row).
 * Home cannot use that shape: a member with nothing but one drink would then be
 * graded on a single slot and read as "fully covered". So the slot list here is
 * FIXED, and a family with no source is graded explicitly as `unavailable`.
 * Absence has to be counted to be able to reduce anything.
 *
 * Pure — no React Native, no store, no `Date.now()` (`now` is passed in) — so
 * every branch is unit-testable in the node vitest environment, same convention
 * as `homeBaselineState.ts` / `homePresentation.ts`.
 */
import {
  assessSignalQuality,
  SIGNAL_QUALITY_RATINGS,
  type QualitySignalKind,
  type SignalQualityInput,
  type SignalQualityRating,
} from '@/utils/confidence/signalQuality';
import { applyFreshness, assessFreshness } from '@/utils/confidence/dataFreshness';
import { signalQualityChip, type ConfidenceChipModel } from '@/utils/confidence/confidenceChip';
import { gatherDataBehindSignals } from '@/utils/confidence/gatherDataBehindSignals';
import type { FreshnessSignalKind } from '@/config/hydroStateModel';
// The shipped days-tracked → §55 coverage resolver (Wave 5, Performance
// Signal). Imported rather than re-derived: it already applies §55's own
// RICH_MIN_RATIO / PARTIAL_MIN_RATIO to a day count over a window, which is
// exactly the question Home is asking. A second copy of those cuts is how two
// surfaces start disagreeing about what "enough" means.
import { historyCompletenessLevel } from '@/components/hydration/signalV3Presentation';
import type { ProfileCompletenessLevel } from '@/utils/profile/profileCompleteness';
import type { ProviderBiometrics } from '@/types';
import { BASELINE_LOOKBACK_DAYS } from './homeBaselineState';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The biometric families behind Home's reading, in the §54 vocabulary. Same
 * three `gatherDataBehindSignals` resolves from the provider snapshot — listed
 * here so a family it omits (no source at all) still occupies a slot and is
 * graded `unavailable` rather than vanishing from the denominator.
 */
const BIOMETRIC_KINDS: readonly QualitySignalKind[] = ['sleep', 'heart_rate', 'activity'];

/** Structural shape of a timestamp as it reaches this module (persisted state may carry ISO strings). */
type Timestamped = Date | string | number | null | undefined;

export interface HomeConfidenceInput {
  /** `userState.intakeEvents` — the member's own logged intakes (rolling 24h). */
  intakeEvents?: readonly { loggedAt: Timestamped }[] | null;
  /** `useHistorySlice()` — cycle history, newest-first. Synthetic entries are not evidence. */
  history?: readonly { timestamp: Timestamped; isSynthetic?: boolean }[] | null;
  /** `userState.biometrics` — the multi-provider snapshot. Absent providers lower confidence. */
  biometrics?: ProviderBiometrics | null;
  now: number;
}

export interface HomeConfidence {
  /** The ONE composed rating: strongest slot ⊓ freshness ⊓ coverage. */
  rating: SignalQualityRating;
  /** The shipped `ConfidenceChip` model for that rating — what Home renders. */
  chip: ConfidenceChipModel;
  /** Distinct days with logged behaviour inside the lookback window (never > the window). */
  daysOfEvidence: number;
  /** Those days expressed in §55's coverage vocabulary. */
  coverage: ProfileCompletenessLevel;
  /** Per-slot effective ratings — a debug trace, never UI copy. */
  signals: { kind: QualitySignalKind; rating: SignalQualityRating }[];
}

/** Lower index = stronger. `SIGNAL_QUALITY_RATINGS` is §54's own display ordering, strongest first. */
function rank(rating: SignalQualityRating): number {
  return SIGNAL_QUALITY_RATINGS.indexOf(rating);
}

/** The WEAKER of two ratings — the min that every ceiling in this layer applies. */
function weaker(a: SignalQualityRating, b: SignalQualityRating): SignalQualityRating {
  return rank(a) >= rank(b) ? a : b;
}

function toMs(value: Timestamped): number | null {
  if (value == null) return null;
  const ms =
    value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Local calendar-day key. Days — not entries — are the coverage fact: four logs on one Tuesday is one day of evidence. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * §55 coverage → a CEILING in the §54 rating vocabulary. Deliberately the same
 * shape as §53's `freshnessCeiling`: it is applied with a min, so thin coverage
 * can only ever LOWER the composed rating, never promote one.
 *
 * The floor is `limited`, not `unavailable`, because this ceiling is only ever
 * consulted for a member Home has already decided has evidence (`established`).
 * Zero evidence is the `building` state, which renders no reading and therefore
 * no chip — a chip claiming UNAVAILABLE beside a real number the member's own
 * log produced would be its own small lie.
 */
export function coverageCeiling(level: ProfileCompletenessLevel): SignalQualityRating {
  switch (level) {
    case 'rich':
      return 'excellent';
    case 'partial':
      return 'good';
    case 'sparse':
      return 'limited';
  }
}

/**
 * Distinct days inside the lookback window on which the member actually logged
 * something. Both sources the store already holds are counted and de-duplicated
 * by day: today's `intakeEvents` (the local, synchronous half) and real cycle
 * history (synthetic baseline entries are the store's honest placeholder — see
 * `countRealHistoryEntries` — and counting them as evidence would manufacture
 * exactly the coverage this module exists to measure).
 */
export function countEvidenceDays(input: HomeConfidenceInput): number {
  const windowMs = BASELINE_LOOKBACK_DAYS * DAY_MS;
  const days = new Set<string>();
  const consider = (value: Timestamped) => {
    const ms = toMs(value);
    if (ms == null) return;
    if (input.now - ms >= windowMs) return; // older than the window (a future stamp is clock skew, kept)
    days.add(dayKey(ms));
  };

  for (const event of input.intakeEvents ?? []) consider(event.loggedAt);
  for (const entry of input.history ?? []) {
    if (entry.isSynthetic === true) continue;
    consider(entry.timestamp);
  }
  return Math.min(days.size, BASELINE_LOOKBACK_DAYS);
}

/** Has the member logged anything at all, at any age? Drives whether the intake slot has a source. */
function hasLoggedEvidence(input: HomeConfidenceInput): boolean {
  if ((input.intakeEvents ?? []).some((e) => toMs(e.loggedAt) != null)) return true;
  return (input.history ?? []).some((h) => h.isSynthetic !== true);
}

/**
 * Resolve the confidence affordance that sits beside Home's reading.
 *
 * Pure + deterministic. Score-Protection: returns a rating, a chip model and a
 * day count — never a score, a band or a colour.
 */
export function resolveHomeConfidence(input: HomeConfidenceInput): HomeConfidence {
  // §54 source grading, one slot per evidence family. The intake slot's source
  // is `hydration_logs`, which SOURCE_TIER puts on the phone tier → `limited`:
  // self-report is the honest floor, and no amount of it is promoted to
  // device-grade. Coverage below is what separates one drink from a week.
  const intakeSource = hasLoggedEvidence(input) ? ('hydration_logs' as const) : null;
  const behind = gatherDataBehindSignals(input.biometrics ?? undefined);
  const byKind = new Map(behind.map((s) => [s.quality.kind, s]));

  const slots: {
    quality: SignalQualityInput;
    freshness?: { kind: FreshnessSignalKind; capturedAt: number | null };
  }[] = [
    { quality: { kind: 'water_intake', source: intakeSource } },
    ...BIOMETRIC_KINDS.map((kind) => {
      const resolved = byKind.get(kind);
      // No resolved source → an explicit `unavailable` slot, not a missing row.
      return resolved
        ? { quality: resolved.quality, freshness: resolved.freshness }
        : { quality: { kind, source: null } };
    }),
  ];

  // §53 caps each slot by how old its reading is (Design Decision 2 — one chip,
  // not two). `water_intake` carries no freshness window: §53's windows live in
  // the off-limits `config/hydroStateModel.ts` and there is no intake entry
  // there, so inventing one here would be a new threshold in the wrong file.
  // Recency of BEHAVIOUR is carried by coverage below instead, which is the
  // honest axis for it anyway — one drink an hour ago is not a fresh week.
  const graded = assessSignalQuality(slots.map((s) => s.quality)).signals;
  const signals = graded.map((signal, i) => {
    const freshness = slots[i].freshness;
    if (!freshness) return { kind: signal.kind, rating: signal.rating };
    const recency = assessFreshness(freshness.kind, freshness.capturedAt, input.now).rating;
    return { kind: signal.kind, rating: applyFreshness(signal.rating, recency) };
  });

  // Best-available headline (§54's own `overall` rule), computed over the
  // freshness-capped ratings rather than the raw source ones.
  const strongest = signals.reduce<SignalQualityRating>(
    (best, s) => (rank(s.rating) < rank(best) ? s.rating : best),
    'unavailable',
  );

  const daysOfEvidence = countEvidenceDays(input);
  const coverage = historyCompletenessLevel(daysOfEvidence, BASELINE_LOOKBACK_DAYS);
  const rating = weaker(strongest, coverageCeiling(coverage));

  return { rating, chip: signalQualityChip(rating), daysOfEvidence, coverage, signals };
}
