/**
 * Apple Health pipeline diagnostics — TEMPORARY, INTERNAL-TESTFLIGHT-ONLY.
 *
 * RC-2 P0 device-validation audit (fix/rc2-apple-pipeline-diagnostics). The
 * founder reported, on a physical device with real Apple Health data (build
 * 47): values don't match the Health app, refresh doesn't retrieve current
 * values, the Home score doesn't move, and the breakdown never shows an
 * Apple-sourced row. This module exists so the NEXT report is evidence, not
 * a guess: it captures, for one refresh cycle, the raw samples HealthKit
 * actually returned, the mapped snapshot, the value rendered on the Profile
 * card, and the value handed to the scoring input — all in one place the
 * founder can read on-device without a console.
 *
 * HARD GATE: every read of this module's state goes through
 * `isAppleHealthDiagnosticsEnabled()`, which is exactly
 * `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED` (`featureFlags/internalTestflightOverlay.ts`
 * — `true` only when `EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true`, the internal EAS
 * profile). Production, preview, development, and demo builds all read
 * `false` here, so `getLastAppleHealthDiagnostics()` always resolves `null`
 * and the panel that reads it never renders. `setLastAppleHealthDiagnostics`
 * is ALSO gated on write, not just on read, so a stray call from a
 * mis-wired caller can never populate state that a later flag flip could
 * expose.
 *
 * PRIVACY: state lives in a plain module-level variable — no AsyncStorage,
 * no network call, nothing serialized anywhere. It holds the founder's own
 * health data on their own device, which is fine for an internal build; it
 * disappears on JS reload / app restart. Only HealthKit source NAMES
 * (`sourceRevision.source.name`, e.g. "iPhone" / "Brandon's Apple Watch")
 * are captured — never a device identifier, token, or anything beyond what
 * the Health app itself already shows the user under "Data Sources".
 *
 * TEMPORARY: this is diagnostics-only scaffolding for RC-2 device
 * validation, not a permanent feature. It carries no scoring logic of its
 * own — every value here is either copied verbatim from a HealthKit query
 * result already being made for another reason, or read back from state the
 * app already computed (the score breakdown row), never recomputed.
 */
import { INTERNAL_TESTFLIGHT_OVERLAY_ENABLED } from '../featureFlags/internalTestflightOverlay';
import type { AppleHealthSnapshot } from './appleHealth';

/** One HealthKit sample's identifying facts — never anything beyond this. */
export interface AppleHealthDiagnosticSample {
  startDate: string;
  endDate: string;
  quantity: number;
  unit: string;
  sourceName: string;
}

export interface AppleHealthQuantityMetricDiagnostic {
  identifier: string;
  /** `false` only for metrics HealthKit authorized but this pipeline never queries (see SUSPECT 4 / workout). */
  queried: boolean;
  /** Count of samples in the trailing 24h window — lets a reader see whether "stale" means "no new data" or "query bug". */
  sampleCount24h: number | null;
  /** The single newest sample HealthKit returned, verbatim. `null` when zero samples exist for this identifier at all. */
  newest: AppleHealthDiagnosticSample | null;
  /** The number `fetchAppleHealthSnapshot()` actually returned for this metric. */
  valueUsed: number | null;
}

export interface AppleHealthStepsSourceTotal {
  sourceName: string;
  total: number;
}

export interface AppleHealthStepsDiagnostic {
  identifier: 'HKQuantityTypeIdentifierStepCount';
  queried: true;
  /** OLD method: sum of every raw sample from every source, unconditionally. Double-counts when iPhone + Watch both record. */
  rawSampleSum: number | null;
  /** NEW method: per-hour bucket, max across sources, summed across the day. See `reduceStepsByBucketMax`. */
  bucketedMaxTotal: number | null;
  /**
   * B1 (RC-2 independent-verdict review): HealthKit's OWN merged total, via
   * plain `queryStatisticsForQuantity` (not the `...SeparateBySource`
   * variant). CAPTURE-ONLY — not yet selected as `valueUsed`; see
   * `services/appleHealth.ts`'s comment on `stepsToday`'s assignment for why,
   * and `docs/health/validation/APPLE-PIPELINE-AUDIT.md` §3 for the record.
   * Compare this against `rawSampleSum` and `bucketedMaxTotal` on-device
   * against the Health app's displayed total.
   */
  nativeMergedTotal: number | null;
  /** Whole-day total per source (`queryStatisticsForQuantitySeparateBySource`), for side-by-side comparison against the Health app's per-source breakdown. */
  perSourceTotals: readonly AppleHealthStepsSourceTotal[];
  /** Raw sample count for the day (same query the old method summed). */
  sampleCount: number | null;
  /** The number `fetchAppleHealthSnapshot()` actually returned (bucketed-max, unless it fell back). */
  valueUsed: number | null;
  /** `true` if the bucketed-max query failed and the raw sum was used as a resilience fallback. */
  usedFallback: boolean;
}

export interface AppleHealthSleepDiagnostic {
  identifier: 'HKCategoryTypeIdentifierSleepAnalysis';
  queried: true;
  sampleCount: number | null;
  valueUsed: number | null;
}

export interface AppleHealthWorkoutDiagnostic {
  identifier: 'HKWorkoutTypeIdentifier';
  queried: false;
  reason: string;
}

/**
 * What actually reached the scoring input for this refresh — read back
 * verbatim from state the app already computed
 * (`store/app/actions.ts#setAppleHealthSnapshot` →
 * `utils/scoring/breakdown.ts#computeRecoverySignal`'s `health_signals`
 * contribution). This module never recomputes a score value.
 */
export interface AppleHealthScoringInputSnapshot {
  /** `state.userState.biometrics.apple_health` — the exact object handed to `aggregateBiometrics`. `null` if not yet set. */
  biometricsEntry: {
    restingHeartRate: number | null;
    hrvSdnn: number | null;
    sleepHoursLastNight: number | null;
    stepsToday: number | null;
    fetchedAt: number;
  } | null;
  /** The `health_signals` row from `ScoreEngineOutput.breakdown`, if present. */
  recoveryContribution: { id: string; label: string; delta: number; hint: string } | null;
}

/**
 * `services/appleHealth.ts` is deliberately store-free (see its own file
 * header) — it isolates HealthKit behind a tiny async API and knows nothing
 * about `UserState`/`ScoreEngineOutput`. So the HealthKit-side capture below
 * carries no `scoringInput`: that half is assembled by the CALLER (the
 * Profile screen, which already holds both the store slice and this
 * snapshot) and passed to the panel as a sibling prop — see
 * `AppleHealthScoringInputSnapshot` and
 * `AppleHealthDiagnosticsPanel`/`formatAppleHealthDiagnosticsSummary`'s
 * second parameter.
 */
export interface AppleHealthDiagnosticsSnapshot {
  capturedAt: number;
  restingHeartRate: AppleHealthQuantityMetricDiagnostic;
  hrv: AppleHealthQuantityMetricDiagnostic;
  steps: AppleHealthStepsDiagnostic;
  sleep: AppleHealthSleepDiagnostic;
  workout: AppleHealthWorkoutDiagnostic;
  mappedSnapshot: AppleHealthSnapshot;
}

/**
 * The single sanctioned gate for this entire module. Mirrors the pattern
 * `isAppleHealthSupported()` already uses in `services/appleHealth.ts` — one
 * seam, reused, never re-derived.
 */
export function isAppleHealthDiagnosticsEnabled(): boolean {
  return INTERNAL_TESTFLIGHT_OVERLAY_ENABLED;
}

// In-memory only (see file header). Module-level by design: the diagnostics
// panel and the fetch path that populates it live in different components
// and must not require prop-drilling a debug-only concern through the
// production render tree.
let lastDiagnostics: AppleHealthDiagnosticsSnapshot | null = null;

/** Gated on WRITE, not just read — see file header. No-op off-gate. */
export function setLastAppleHealthDiagnostics(snapshot: AppleHealthDiagnosticsSnapshot): void {
  if (!isAppleHealthDiagnosticsEnabled()) return;
  lastDiagnostics = snapshot;
}

/** Gated on READ — always `null` off-gate, regardless of what was ever set. */
export function getLastAppleHealthDiagnostics(): AppleHealthDiagnosticsSnapshot | null {
  if (!isAppleHealthDiagnosticsEnabled()) return null;
  return lastDiagnostics;
}

/** Test/dev utility — clears captured state without waiting for a JS reload. */
export function clearAppleHealthDiagnostics(): void {
  lastDiagnostics = null;
}

function formatSample(sample: AppleHealthDiagnosticSample | null): string {
  if (!sample) return 'no samples found';
  return `${sample.quantity} ${sample.unit} @ ${sample.startDate} (source: ${sample.sourceName})`;
}

/**
 * Plain-text summary of one captured cycle — the collapsible panel's text
 * body is built from this same shape, and it's what a founder could paste
 * into a bug report. Pure and independently unit-tested (no React,
 * no gating logic — the gate already ran before this is ever called from
 * production code).
 */
export function formatAppleHealthDiagnosticsSummary(
  snapshot: AppleHealthDiagnosticsSnapshot,
  scoringInput?: AppleHealthScoringInputSnapshot | null,
): string {
  const lines: string[] = [];
  lines.push(`Captured: ${new Date(snapshot.capturedAt).toISOString()}`);
  lines.push('');
  lines.push(`Resting HR: used ${snapshot.restingHeartRate.valueUsed ?? '—'} bpm`);
  lines.push(`  newest sample: ${formatSample(snapshot.restingHeartRate.newest)}`);
  lines.push(`  samples in last 24h: ${snapshot.restingHeartRate.sampleCount24h ?? '—'}`);
  lines.push('');
  lines.push(`HRV (SDNN): used ${snapshot.hrv.valueUsed ?? '—'} ms`);
  lines.push(`  newest sample: ${formatSample(snapshot.hrv.newest)}`);
  lines.push(`  samples in last 24h: ${snapshot.hrv.sampleCount24h ?? '—'}`);
  lines.push('');
  lines.push(`Steps today: used ${snapshot.steps.valueUsed ?? '—'}${snapshot.steps.usedFallback ? ' (FALLBACK to raw sum — bucketed query failed)' : ''}`);
  lines.push(`  raw sample sum (old method): ${snapshot.steps.rawSampleSum ?? '—'}`);
  lines.push(`  bucketed max-per-hour (new method): ${snapshot.steps.bucketedMaxTotal ?? '—'}`);
  lines.push(`  native merged (HealthKit's own, capture-only): ${snapshot.steps.nativeMergedTotal ?? '—'}`);
  lines.push(`  sample count: ${snapshot.steps.sampleCount ?? '—'}`);
  if (snapshot.steps.perSourceTotals.length === 0) {
    lines.push('  per-source totals: none');
  } else {
    lines.push('  per-source totals:');
    for (const s of snapshot.steps.perSourceTotals) {
      lines.push(`    ${s.sourceName}: ${s.total}`);
    }
  }
  lines.push('');
  lines.push(`Sleep last night: used ${snapshot.sleep.valueUsed ?? '—'} h (${snapshot.sleep.sampleCount ?? '—'} samples)`);
  lines.push('');
  lines.push(`Workouts: NOT QUERIED — ${snapshot.workout.reason}`);
  lines.push('');
  lines.push('Scoring input (read back from app state, not recomputed):');
  if (scoringInput?.biometricsEntry) {
    const b = scoringInput.biometricsEntry;
    lines.push(`  biometrics.apple_health: RHR=${b.restingHeartRate ?? '—'} HRV=${b.hrvSdnn ?? '—'} sleep=${b.sleepHoursLastNight ?? '—'} steps=${b.stepsToday ?? '—'} fetchedAt=${new Date(b.fetchedAt).toISOString()}`);
  } else {
    lines.push('  biometrics.apple_health: not set');
  }
  if (scoringInput?.recoveryContribution) {
    const r = scoringInput.recoveryContribution;
    lines.push(`  breakdown row "${r.label}": delta=${r.delta} (${r.hint})`);
  } else {
    lines.push('  breakdown row: none found (no "health_signals" contribution)');
  }
  return lines.join('\n');
}
