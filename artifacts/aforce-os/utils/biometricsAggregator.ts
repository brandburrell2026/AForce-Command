/**
 * Cross-provider biometrics aggregator.
 *
 * Folds snapshots from any combination of connected health platforms
 * (Apple Health, Oura, Samsung Health, Google Health Connect, Garmin,
 * WHOOP, Strava) into two scalar inputs the scoring engine already
 * understands:
 *
 *   inferredActivityLevel  : 0..10 — used as a FLOOR for the manual
 *                            activityLevel axis when biometrics show
 *                            higher activity than the user logged
 *                            (so a heavy WHOOP strain day depletes
 *                            faster even if the slider was forgotten).
 *
 *   recoveryDelta          : -10..+10 — folded into computeRecoverySignal
 *                            in place of the legacy single-provider
 *                            Apple Health delta. Same clamp magnitude
 *                            so multi-provider data can never dominate
 *                            the score.
 *
 * Per-metric reduction strategy (when multiple providers report the
 * same field): pick the FRESHEST snapshot's value for that metric. This
 * avoids double-counting (e.g. Apple + Garmin both reporting HRV would
 * add up to 2× the recovery boost otherwise). PER-FIELD, not
 * per-provider — WHOOP can win `recoveryPct` while Apple wins `hrvSdnn`
 * in the same aggregation; nothing about one field's winner constrains
 * another's.
 *
 * "Freshest" (RC-2 Founder Ruling C, 2026-08-06 — supersedes the
 * pre-Ruling-C `fetchedAt`-only definition) is resolved by
 * `resolveComparisonTimestamp` on ONE axis per candidate, no branching
 * matrix:
 *
 *   1. per-field observedAt  (`snapshot.fieldObservedAtMs[field]`) —
 *      when THIS provider supplied one for THIS field. Today only
 *      apple_health does (services/appleHealth.ts).
 *   2. snapshot-level latestObservedAtMs — when the provider only
 *      knows one observation moment for its whole payload (every
 *      server-polled provider: WHOOP/Oura/Garmin). Accepted
 *      approximation: a provider's fields don't actually all land in
 *      the same instant, but a cloud sync only reports one timestamp
 *      for the payload, so this is the best available.
 *   3. fetchedAt — final fallback, and the ENTIRE comparison for any
 *      snapshot with no observation data at all (pre-Ruling-C
 *      behavior, byte-identical when neither axis is populated).
 *
 * A timestamp from any tier is clamped to `now` before comparing (clock
 * skew / server epoch drift / a malformed future value). This is a
 * PARITY cap, not decay: a clamped value reads as exactly "as fresh as
 * this instant" — it can TIE the freshest genuine reading available at
 * comparison time, but it can never exceed `now` and so can never carry
 * a permanent, ever-growing raw-magnitude lead over every honest
 * timestamp the way an un-clamped bogus future epoch would. (A
 * provider whose clock skew persists across every sync will keep
 * re-clamping to a fresh `now` on every call — this bounds the damage
 * to "always looks maximally fresh," never "outranks the universe
 * forever by a widening margin"; it does not detect or repair the
 * underlying skew, which is out of this module's scope.) Ties are
 * deterministic: the FIRST snapshot encountered (stable
 * `ProviderBiometrics` key order) keeps a tie rather than losing to a
 * later, equally-fresh candidate — unchanged from the pre-Ruling-C
 * comparator's strict `>`.
 *
 * Activity uses MAX across providers, on the principle that whichever
 * tracker recorded the highest workout/strain/steps captured the most
 * complete picture — Strava might log a ride that Apple missed, WHOOP
 * might log strain Apple Watch under-counted. Activity does NOT consult
 * observation time at all (unchanged by Ruling C) — MAX already picks
 * the most complete reading regardless of when any source last synced.
 *
 * Pure module — no React Native, no AsyncStorage, no clock side effects
 * beyond what the caller passes in: `aggregateBiometrics`'s `now`
 * parameter (used only for the clock-skew clamp above) defaults to
 * `Date.now()` for production call sites, which is why every one of
 * this file's existing callers (utils/scoring/breakdown.ts among them)
 * needed zero changes — but every test in this module's own suite
 * passes an explicit `now` so behavior stays fully deterministic under
 * test.
 */

import type { HealthProviderId } from '../data/healthProviders';
import type { ProviderBiometrics, ProviderSnapshot } from '../types/biometrics';
import type { AppleHealthInputs } from '../types';

export interface AggregatedBiometrics {
  /** 0..10 activity level inferred from steps + workouts + strain. */
  inferredActivityLevel: number;
  /** -10..+10 recovery delta from HRV / sleep / readiness / recovery%. */
  recoveryDelta: number;
  /** Provider IDs that contributed at least one non-null field. */
  sources: HealthProviderId[];
  /** Human-readable summary suitable for the breakdown sheet hint. */
  hint: string;
}

const RECOVERY_CLAMP = 10;
const ACTIVITY_CLAMP = 10;

/**
 * Steps → 0..10 activity level. Anchors:
 *   2,000  → 1   (sedentary office day)
 *   5,000  → 3   (errands)
 *   7,500  → 5   (light walking)
 *  10,000  → 7   (active day, US health-guideline target)
 *  15,000+ → 9   (very active)
 */
function activityFromSteps(steps: number): number {
  if (steps <= 0) return 0;
  if (steps >= 15000) return 9;
  if (steps >= 10000) return 7 + ((steps - 10000) / 5000) * 2;
  if (steps >= 7500) return 5 + ((steps - 7500) / 2500) * 2;
  if (steps >= 5000) return 3 + ((steps - 5000) / 2500) * 2;
  if (steps >= 2000) return 1 + ((steps - 2000) / 3000) * 2;
  return (steps / 2000) * 1;
}

/**
 * Workout minutes → 0..10. Anchors (ACSM guideline = 150 min/week ≈
 * 22 min/day moderate or 11 min/day vigorous):
 *   15  → 3   (active commute)
 *   30  → 5   (moderate session)
 *   60  → 7   (real workout)
 *   90  → 8.5 (long ride / lift)
 *   120+ → 10 (endurance day)
 */
function activityFromWorkoutMinutes(min: number): number {
  if (min <= 0) return 0;
  if (min >= 120) return 10;
  if (min >= 90) return 8.5 + ((min - 90) / 30) * 1.5;
  if (min >= 60) return 7 + ((min - 60) / 30) * 1.5;
  if (min >= 30) return 5 + ((min - 30) / 30) * 2;
  if (min >= 15) return 3 + ((min - 15) / 15) * 2;
  return (min / 15) * 3;
}

/**
 * WHOOP strain (0..21) → 0..10. WHOOP's 21-point scale uses 0–9 = light,
 * 10–13 = moderate, 14–17 = strenuous, 18–21 = all-out. Linear scale to
 * the AForce 0..10 axis preserves the same proportional interpretation.
 */
function activityFromStrain(strain: number): number {
  if (strain <= 0) return 0;
  return Math.min(10, (strain / 21) * 10);
}

/**
 * Fields `ProviderSnapshot.fieldObservedAtMs` may carry a per-field
 * observation time for — kept as its own alias (rather than inlining
 * `keyof NonNullable<...>` at every call site) purely for readability.
 */
type ObservedFieldKey = keyof NonNullable<ProviderSnapshot['fieldObservedAtMs']>;

/**
 * RC-2 Founder Ruling C: the ONE comparator every freshness decision in
 * this file (and, for the whole-entry case, `utils/biometricsMerge.ts`)
 * reduces to before comparing two candidates. See this file's header
 * comment for the full three-tier precedence and the clock-skew
 * rationale. `now` is REQUIRED here (not defaulted) — the one default
 * lives on `aggregateBiometrics` itself, so every internal call site is
 * forced to thread the same `now` rather than each reaching for its own.
 */
function resolveComparisonTimestamp<K extends keyof ProviderSnapshot>(
  snap: ProviderSnapshot,
  key: K,
  now: number,
): number {
  const fieldKey = key as unknown as ObservedFieldKey;
  const raw = snap.fieldObservedAtMs?.[fieldKey] ?? snap.latestObservedAtMs ?? snap.fetchedAt;
  return Math.min(raw, now);
}

/**
 * Pick the freshest snapshot for a given metric (by
 * `resolveComparisonTimestamp`, not raw `fetchedAt` — see this file's
 * header), return its value or null. Ties keep the FIRST candidate
 * encountered (strict `>`) — deterministic given `ProviderBiometrics`'
 * stable key iteration order, unchanged from the pre-Ruling-C comparator.
 */
function freshestNonNull<K extends keyof ProviderSnapshot>(
  snaps: ProviderSnapshot[],
  key: K,
  now: number,
): ProviderSnapshot[K] | null {
  let best: { value: ProviderSnapshot[K]; ts: number } | null = null;
  for (const s of snaps) {
    const v = s[key];
    if (v == null) continue;
    const ts = resolveComparisonTimestamp(s, key, now);
    if (best === null || ts > best.ts) {
      best = { value: v, ts };
    }
  }
  return best ? best.value : null;
}

/**
 * Which raw axis `resolveComparisonTimestamp` drew from for one
 * (snapshot, field) pair — see that function's three-tier precedence in
 * this file's header comment.
 */
export type FieldArbitrationTier = 'fieldObservedAt' | 'latestObservedAt' | 'fetchedAt';

/** One provider's contribution to a per-field arbitration — read-only, mirrors `resolveComparisonTimestamp`'s inputs verbatim. */
export interface FieldArbitrationCandidate<K extends keyof ProviderSnapshot = keyof ProviderSnapshot> {
  providerId: HealthProviderId;
  value: NonNullable<ProviderSnapshot[K]>;
  comparisonTimestampMs: number;
  tier: FieldArbitrationTier;
}

/** `explainFieldArbitration`'s result: the winning candidate (or `null` when nobody reports the field) plus every candidate considered, winner included. */
export interface FieldArbitrationResult<K extends keyof ProviderSnapshot = keyof ProviderSnapshot> {
  winner: FieldArbitrationCandidate<K> | null;
  candidates: FieldArbitrationCandidate<K>[];
}

/**
 * Classify which axis `resolveComparisonTimestamp` drew from for this
 * (snapshot, field) pair, using the SAME optional-chain precedence as that
 * function's `raw` expression — never re-deriving the timestamp itself,
 * only labeling which branch of it fired.
 */
function tierOf<K extends keyof ProviderSnapshot>(snap: ProviderSnapshot, key: K): FieldArbitrationTier {
  const fieldKey = key as unknown as ObservedFieldKey;
  if (snap.fieldObservedAtMs?.[fieldKey] != null) return 'fieldObservedAt';
  if (snap.latestObservedAtMs != null) return 'latestObservedAt';
  return 'fetchedAt';
}

/**
 * RC-2 founder logging order (build-49 device finding, 2026-08-07):
 * read-only introspection into per-field arbitration — the one stage of the
 * biometrics chain `freshestNonNull` makes completely unobservable today. It
 * returns only the winning VALUE, discarding which provider supplied it and
 * why — exactly the gap behind the founder's "three sleep values" report
 * (5.6h Health app / 4.696h panel / 5.4h breakdown), where the 5.4h
 * breakdown number turned out to be WHOOP winning per-field arbitration
 * against Apple, not a corrupted Apple value.
 *
 * PURE AND BEHAVIOR-NEUTRAL: reuses `resolveComparisonTimestamp` verbatim
 * (never re-derives its clamp or fallback-chain logic) and mirrors
 * `freshestNonNull`'s own winner-selection loop exactly — same candidate
 * order (`Object.entries(biometrics)`, matching `aggregateBiometrics`'s own
 * iteration), same null-skip, same strict `>` tie rule (first candidate
 * encountered keeps a tie). This function does not run from any scoring
 * call site — only from the gated `AppleHealthDiagnosticsSection` readback —
 * and changes nothing about `freshestNonNull`, `aggregateBiometrics`, or any
 * score. See this module's parity test suite
 * (`utils/__tests__/biometricsAggregator.explainFieldArbitration.test.ts`)
 * for the proof that its winner always agrees with `freshestNonNull`'s.
 */
export function explainFieldArbitration<K extends keyof ProviderSnapshot>(
  biometrics: ProviderBiometrics | undefined,
  fieldKey: K,
  now: number,
): FieldArbitrationResult<K> {
  if (!biometrics) return { winner: null, candidates: [] };

  const candidates: FieldArbitrationCandidate<K>[] = [];
  for (const [id, snap] of Object.entries(biometrics) as [HealthProviderId, ProviderSnapshot | undefined][]) {
    if (!snap) continue;
    const value = snap[fieldKey];
    if (value == null) continue;
    candidates.push({
      providerId: id,
      value: value as NonNullable<ProviderSnapshot[K]>,
      comparisonTimestampMs: resolveComparisonTimestamp(snap, fieldKey, now),
      tier: tierOf(snap, fieldKey),
    });
  }

  // Byte-identical selection rule to `freshestNonNull` above: strict `>`,
  // so the FIRST candidate encountered keeps a tie rather than losing to a
  // later, equally-fresh one.
  let winner: FieldArbitrationCandidate<K> | null = null;
  for (const c of candidates) {
    if (winner === null || c.comparisonTimestampMs > winner.comparisonTimestampMs) {
      winner = c;
    }
  }

  return { winner, candidates };
}

/**
 * Build the `biometrics.apple_health` `ProviderSnapshot` mirror from an
 * `AppleHealthInputs` value — the single mapping both `SET_APPLE_HEALTH`
 * (store/appStoreReducer.ts) and `setAppleHealthSnapshot`
 * (store/app/actions.ts) call, replacing what used to be two
 * independently-maintained copies of the same field-by-field mapping.
 * Carries the optional per-field observation times additively (RC-2
 * Founder Ruling C) so `freshestNonNull` above can arbitrate Apple's
 * fields against every other provider by OBSERVATION time, not merely
 * `fetchedAt` (sync time). Pure — no defaults invented, no clock read.
 */
export function buildAppleHealthProviderSnapshot(input: AppleHealthInputs): ProviderSnapshot {
  const fieldObservedAtMs: NonNullable<ProviderSnapshot['fieldObservedAtMs']> = {};
  if (input.hrvSdnnObservedAtMs != null) fieldObservedAtMs.hrvSdnn = input.hrvSdnnObservedAtMs;
  if (input.restingHeartRateObservedAtMs != null) fieldObservedAtMs.restingHeartRate = input.restingHeartRateObservedAtMs;
  if (input.sleepHoursLastNightObservedAtMs != null) fieldObservedAtMs.sleepHoursLastNight = input.sleepHoursLastNightObservedAtMs;
  if (input.stepsTodayObservedAtMs != null) fieldObservedAtMs.stepsToday = input.stepsTodayObservedAtMs;

  return {
    providerId: 'apple_health',
    restingHeartRate: input.restingHeartRate,
    hrvSdnn: input.hrvSdnn,
    sleepHoursLastNight: input.sleepHoursLastNight,
    stepsToday: input.stepsToday,
    fetchedAt: input.fetchedAt,
    ...(Object.keys(fieldObservedAtMs).length > 0 ? { fieldObservedAtMs } : {}),
    ...(input.latestObservedAtMs != null ? { latestObservedAtMs: input.latestObservedAtMs } : {}),
  };
}

/**
 * Aggregate per-provider snapshots into the two scalars the score
 * engine consumes. Pass an empty / undefined record to get a no-op
 * result (delta 0, inferredActivityLevel 0, sources []).
 *
 * `now` (RC-2 Founder Ruling C) defaults to `Date.now()` so every
 * existing production call site (utils/scoring/breakdown.ts) needed zero
 * changes; pass an explicit value from a test for deterministic
 * clock-skew-clamp behavior. See this file's header comment for the full
 * freshness precedence this powers.
 */
export function aggregateBiometrics(
  biometrics: ProviderBiometrics | undefined,
  now: number = Date.now(),
): AggregatedBiometrics {
  if (!biometrics) {
    return { inferredActivityLevel: 0, recoveryDelta: 0, sources: [], hint: 'No platforms connected' };
  }

  const snaps: ProviderSnapshot[] = [];
  const sources: HealthProviderId[] = [];
  for (const [id, snap] of Object.entries(biometrics) as [HealthProviderId, ProviderSnapshot | undefined][]) {
    if (!snap) continue;
    snaps.push(snap);
    sources.push(id);
  }
  if (snaps.length === 0) {
    return { inferredActivityLevel: 0, recoveryDelta: 0, sources: [], hint: 'No platforms connected' };
  }

  // ── Activity inference ────────────────────────────────────────────
  // MAX across providers (best capture wins) and across signals (any
  // single signal indicating high activity is enough — a heavy lift
  // can be 30 min of workout but 1k steps).
  let activity = 0;
  for (const s of snaps) {
    if (s.stepsToday != null) activity = Math.max(activity, activityFromSteps(s.stepsToday));
    if (s.workoutMinutesToday != null) activity = Math.max(activity, activityFromWorkoutMinutes(s.workoutMinutesToday));
    if (s.strain != null) activity = Math.max(activity, activityFromStrain(s.strain));
  }
  // Strava training load is a 7-day rolling number, so it shouldn't
  // override TODAY's activity, but a sustained high load implies the
  // user is in a heavier training block — fold it in at half weight.
  for (const s of snaps) {
    if (s.trainingLoad != null && s.trainingLoad >= 50) {
      const loadActivity = Math.min(10, ((s.trainingLoad - 50) / 50) * 4 + 4);
      activity = Math.max(activity, loadActivity * 0.5);
    }
  }
  const inferredActivityLevel = Math.max(0, Math.min(ACTIVITY_CLAMP, Math.round(activity * 10) / 10));

  // ── Recovery delta ────────────────────────────────────────────────
  // Pick the freshest non-null reading per metric so we don't
  // double-count when Apple + Garmin both report HRV.
  const hrv = freshestNonNull(snaps, 'hrvSdnn', now);
  const sleep = freshestNonNull(snaps, 'sleepHoursLastNight', now);
  const readiness = freshestNonNull(snaps, 'readinessScore', now);
  const recoveryPct = freshestNonNull(snaps, 'recoveryPct', now);
  const stress = freshestNonNull(snaps, 'stressScore', now);

  const parts: string[] = [];
  let delta = 0;

  // RC-2 Ruling C, item 3: unit-spacing sweep — was 'ms'/'h' with no
  // leading space; #586 already normalized every other card/panel unit
  // (HRV ' ms', RHR ' bpm') to a leading space. These hint templates were
  // the one place still rendering 'HRV 59ms' / 'Sleep 7.8h'. Normalized to
  // match; every string assertion in this module's test suite was updated
  // alongside.
  if (hrv != null) {
    if (hrv >= 60) { delta += 5; parts.push(`HRV ${Math.round(hrv)} ms (high)`); }
    else if (hrv >= 40) { delta += 2; parts.push(`HRV ${Math.round(hrv)} ms`); }
    else if (hrv >= 30) { parts.push(`HRV ${Math.round(hrv)} ms`); }
    else { delta -= 5; parts.push(`HRV ${Math.round(hrv)} ms (low)`); }
  }
  if (sleep != null) {
    if (sleep >= 7 && sleep <= 9) { delta += 5; parts.push(`Sleep ${sleep.toFixed(1)} h`); }
    else if (sleep >= 6) { delta += 2; parts.push(`Sleep ${sleep.toFixed(1)} h`); }
    else if (sleep >= 4) { delta -= 3; parts.push(`Sleep ${sleep.toFixed(1)} h (short)`); }
    else { delta -= 5; parts.push(`Sleep ${sleep.toFixed(1)} h (deficit)`); }
  }
  if (readiness != null) {
    if (readiness >= 85) { delta += 4; parts.push(`Readiness ${Math.round(readiness)}`); }
    else if (readiness >= 70) { delta += 2; parts.push(`Readiness ${Math.round(readiness)}`); }
    else if (readiness >= 50) { /* neutral */ parts.push(`Readiness ${Math.round(readiness)}`); }
    else { delta -= 4; parts.push(`Readiness ${Math.round(readiness)} (low)`); }
  }
  if (recoveryPct != null) {
    if (recoveryPct >= 75) { delta += 4; parts.push(`Recovery ${Math.round(recoveryPct)}%`); }
    else if (recoveryPct >= 50) { delta += 1; parts.push(`Recovery ${Math.round(recoveryPct)}%`); }
    else if (recoveryPct >= 33) { delta -= 2; parts.push(`Recovery ${Math.round(recoveryPct)}%`); }
    else { delta -= 5; parts.push(`Recovery ${Math.round(recoveryPct)}% (red)`); }
  }
  if (stress != null) {
    // Garmin stress: 0–25 rest, 26–50 low, 51–75 medium, 76–100 high.
    if (stress >= 76) { delta -= 4; parts.push(`Stress ${Math.round(stress)} (high)`); }
    else if (stress >= 51) { delta -= 2; parts.push(`Stress ${Math.round(stress)}`); }
    else if (stress <= 25) { delta += 2; parts.push(`Stress ${Math.round(stress)} (rest)`); }
  }

  const recoveryDelta = Math.max(-RECOVERY_CLAMP, Math.min(RECOVERY_CLAMP, delta));

  let hint: string;
  if (parts.length === 0) {
    hint = sources.length === 1 ? '1 platform · awaiting data' : `${sources.length} platforms · awaiting data`;
  } else {
    hint = parts.join(' · ');
  }

  return { inferredActivityLevel, recoveryDelta, sources, hint };
}
