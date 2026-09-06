/**
 * commandEventAdapters — the pure translation layer between the shared
 * Command-Event Ledger (`commandEvents.ts`) and the three existing Tier-1
 * engines.
 *
 * Two directions, both pure and RN-free:
 *
 *   1. POPULATION (source → ledger): map today's scattered real behaviour
 *      (intake events, voice check-ins, the command-confirmation answer,
 *      Performance Age snapshots, a context snapshot) into normalized
 *      `CommandEvent`s with STABLE, deterministic ids so re-derivation is
 *      idempotent (the ledger's first-wins merge never double-counts).
 *
 *   2. READ ADAPTERS (ledger → engine inputs): project the ledger into each
 *      engine's EXISTING input shape — `CommandConfidenceInputs`,
 *      `PerformanceMemoryEntry[]`, `PerformanceAgeDailySnapshot[]` — WITHOUT
 *      changing any engine's contract. The engines stay untouched; they can
 *      adopt these adapters later behind a flag.
 *
 * HARD LOCKS:
 *  - Score-Protection: every function here only MEASURES / TRANSLATES. None
 *    reads, awards, mutates, or fabricates score. The adherence read
 *    (`deriveLedgerAdherence`) is a learning PRIMITIVE only — it is
 *    intentionally NOT fed into `deriveCommandConfidence`, so confidence can
 *    never be upgraded without real behaviour + context.
 *  - No fabrication: missing/invalid source data maps to nothing (the mapper
 *    returns `null`); absence of ledger events maps to the engines' honest
 *    "low / needs-more-data" states, never an invented signal.
 *
 * Day-index convention is preserved per source so each consumer keeps the
 * semantics it already relies on:
 *  - voice check-ins carry the record's own local-calendar `dayIndex`
 *    (what Performance Memory's streak math compares against `now`);
 *  - Performance Age snapshots carry the UTC day index
 *    (`floor(epochMs / 86_400_000)`) the trend helper already uses;
 *  - intake / confirmation / context use the UTC day index too — they are
 *    only ever read by rolling-window (occurredAtMs) queries, never by day.
 *
 * Type-only imports of app types are fully erased at build, so this module
 * stays loadable under the vitest pure-test runner (no RN at runtime).
 */

import { isWeatherObservationCurrent } from '../environment/weatherFreshness';
import type { IntakeEvent } from '../../types';
import type { VoiceCheckInRecord } from '../voiceCheckIn';
import type { PerformanceAgeDailySnapshot } from '../performanceAge';
import type { PerformanceMemoryEntry } from '../performanceMemory';
import type { CommandConfidenceInputs } from '../scoring/commandConfidence';
import {
  BIOMETRIC_FRESHNESS_MS,
  CLOCK_SKEW_MS,
} from '../scoring/commandConfidence';
import {
  eventsByKind,
  eventsInWindow,
  type CommandEvent,
  type IntakeCommandEvent,
  type VoiceCheckinCommandEvent,
  type CommandConfirmationCommandEvent,
  type PerformanceAgeSnapshotCommandEvent,
  type ContextSnapshotCommandEvent,
  type ExecutionEventCommandEvent,
} from './commandEvents';

// ─── Windows ────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

/**
 * Rolling window that defines "today's behaviour" for Command Confidence.
 * The source `UserState.intakeEvents` list is already pruned to a rolling
 * 24h, so reading the (un-pruned, up-to-1000) ledger through this window
 * reproduces the original `intakeEvents.length > 0` semantics faithfully.
 */
export const BEHAVIOR_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/** Trailing window the adherence read considers (command-confirmation rate). */
export const ADHERENCE_WINDOW_MS = 14 * MS_PER_DAY;
/** Minimum confirmations before an adherence rate is reported (else 'insufficient'). */
export const ADHERENCE_MIN_SAMPLES = 3;

// ─── Shared helpers ───────────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** UTC day bucket: timezone-free integer day number. */
function utcDayIndex(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

/** Coerce a Date | epoch-ms | ISO string into finite epoch ms, or null. */
function toEpochMs(v: unknown): number | null {
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * A captured-context timestamp is "fresh" when it is within `maxAgeMs` of
 * `now` and not implausibly future-dated (small clock-skew tolerance).
 * Mirrors `isFresh` in `commandConfidence.ts` so freshness means the same
 * thing whether read live or through the ledger.
 */
function isFresh(occurredAtMs: number, now: number, maxAgeMs: number): boolean {
  if (!isFiniteNumber(occurredAtMs) || occurredAtMs <= 0 || !Number.isFinite(now)) {
    return false;
  }
  const age = now - occurredAtMs;
  return age >= -CLOCK_SKEW_MS && age <= maxAgeMs;
}

// ─── Population: source → ledger CommandEvent ─────────────────────────────────────

/**
 * Map one real `IntakeEvent` to an `intake` ledger event. Stable id
 * `intake:${e.id}` makes re-derivation idempotent. Returns null when the
 * event lacks a usable id or timestamp (no fabrication).
 */
export function intakeEventToCommandEvent(e: IntakeEvent): IntakeCommandEvent | null {
  if (!e || !isNonEmptyString(e.id)) return null;
  const occurredAtMs = toEpochMs(e.loggedAt);
  if (occurredAtMs === null || occurredAtMs <= 0) return null;
  return {
    id: `intake:${e.id}`,
    kind: 'intake',
    occurredAtMs,
    localDayIndex: utcDayIndex(occurredAtMs),
    source: 'intakeEvents',
    intakeEventId: e.id,
    ...(isFiniteNumber(e.oz) ? { oz: e.oz } : {}),
    ...(isNonEmptyString(e.fluidType) ? { fluidType: e.fluidType } : {}),
  };
}

/**
 * Map one persisted `VoiceCheckInRecord` to a `voice_checkin` ledger event.
 * The id embeds the completion time so a same-day re-check-in produces a
 * distinct event (Performance Memory then keeps the latest per day), while
 * re-deriving the identical record stays idempotent. Carries the record's
 * own local-calendar `dayIndex` so streak math is unchanged.
 */
export function voiceCheckInToCommandEvent(
  r: VoiceCheckInRecord,
): VoiceCheckinCommandEvent | null {
  if (!r || !r.answers) return null;
  if (!isFiniteNumber(r.completedAtMs) || r.completedAtMs <= 0) return null;
  if (!Number.isInteger(r.dayIndex)) return null;
  if (!isFiniteNumber(r.answers.energy) || !isFiniteNumber(r.answers.stress)) return null;
  return {
    id: `voice_checkin:${r.dayIndex}:${r.completedAtMs}`,
    kind: 'voice_checkin',
    occurredAtMs: r.completedAtMs,
    localDayIndex: r.dayIndex,
    source: 'voiceCheckIn',
    energy: r.answers.energy,
    stress: r.answers.stress,
    ...(isNonEmptyString(r.answers.goal) ? { goal: r.answers.goal } : {}),
  };
}

/**
 * Map one persisted `PerformanceAgeDailySnapshot` to a
 * `performance_age_snapshot` ledger event. One snapshot per UTC day; the id
 * is the day index so the daily series stays one-per-day and idempotent.
 */
export function performanceAgeSnapshotToCommandEvent(
  s: PerformanceAgeDailySnapshot,
): PerformanceAgeSnapshotCommandEvent | null {
  if (!s || !Number.isInteger(s.dayIndex)) return null;
  if (!isFiniteNumber(s.performanceAge)) return null;
  return {
    id: `performance_age_snapshot:${s.dayIndex}`,
    kind: 'performance_age_snapshot',
    // Anchor the event at the start of its UTC day; clamp to >0 so the epoch
    // day (index 0) still satisfies the ledger's positive-timestamp rule.
    occurredAtMs: Math.max(1, s.dayIndex * MS_PER_DAY),
    localDayIndex: s.dayIndex,
    source: 'performanceAgeSnapshot',
    performanceAge: s.performanceAge,
  };
}

/**
 * Build a `command_confirmation` ledger event from the user's explicit
 * answer to "Did you follow the command?". `followed` is passed in by the
 * caller (the only source of truth for the answer) — never inferred from the
 * transient ±delta, so nothing is fabricated. Advisory only: this NEVER
 * scores. Stable id is the answer timestamp.
 */
export function confirmationToCommandEvent(args: {
  followed: boolean;
  setAtMs: number;
  delta?: number;
  commandType?: string;
  commandId?: string;
}): CommandConfirmationCommandEvent | null {
  if (typeof args.followed !== 'boolean') return null;
  if (!isFiniteNumber(args.setAtMs) || args.setAtMs <= 0) return null;
  // Disambiguate same-millisecond confirmations by the command they answer.
  const id = isNonEmptyString(args.commandId)
    ? `command_confirmation:${args.setAtMs}:${args.commandId}`
    : `command_confirmation:${args.setAtMs}`;
  return {
    id,
    kind: 'command_confirmation',
    occurredAtMs: args.setAtMs,
    localDayIndex: utcDayIndex(args.setAtMs),
    source: 'confirmationDelta',
    followed: args.followed,
    ...(isFiniteNumber(args.delta) ? { delta: args.delta } : {}),
    ...(isNonEmptyString(args.commandType) ? { commandType: args.commandType } : {}),
    ...(isNonEmptyString(args.commandId) ? { commandId: args.commandId } : {}),
  };
}

/**
 * Build a `context_snapshot` ledger event capturing the provenance of the
 * environmental/biometric context at `atMs`. `weatherTempC` may be an
 * explicit null (no reading); `hasFreshBiometrics` records whether a fresh,
 * finite biometric signal existed at capture. Provenance only — never scores.
 */
export function contextSnapshotToCommandEvent(args: {
  atMs: number;
  weatherTempC?: number | null;
  hasFreshBiometrics?: boolean;
  /** Source fetch times (epoch ms). When present, each signal's freshness is
   *  anchored to its own fetch, not to `atMs` (when it was observed). */
  weatherFetchedAtMs?: number;
  biometricsFetchedAtMs?: number;
}): ContextSnapshotCommandEvent | null {
  if (!isFiniteNumber(args.atMs) || args.atMs <= 0) return null;
  // A present weather reading must be null (no reading) or finite; an unusable
  // value (NaN/Infinity) is dropped — not fabricated — so the snapshot's valid
  // biometric provenance is still preserved rather than discarded by the merge.
  const keepWeather =
    args.weatherTempC !== undefined &&
    (args.weatherTempC === null || isFiniteNumber(args.weatherTempC));
  const keepWeatherFetched =
    isFiniteNumber(args.weatherFetchedAtMs) && args.weatherFetchedAtMs > 0;
  const keepBioFetched =
    isFiniteNumber(args.biometricsFetchedAtMs) && args.biometricsFetchedAtMs > 0;
  return {
    id: `context_snapshot:${args.atMs}`,
    kind: 'context_snapshot',
    occurredAtMs: args.atMs,
    localDayIndex: utcDayIndex(args.atMs),
    source: 'contextSnapshot',
    ...(keepWeather ? { weatherTempC: args.weatherTempC } : {}),
    ...(typeof args.hasFreshBiometrics === 'boolean'
      ? { hasFreshBiometrics: args.hasFreshBiometrics }
      : {}),
    ...(keepWeatherFetched ? { weatherFetchedAtMs: args.weatherFetchedAtMs } : {}),
    ...(keepBioFetched ? { biometricsFetchedAtMs: args.biometricsFetchedAtMs } : {}),
  };
}

// ─── Population collectors (array sources, invalid entries dropped) ───────────────

export function collectIntakeCommandEvents(
  events: readonly IntakeEvent[] | undefined | null,
): IntakeCommandEvent[] {
  const out: IntakeCommandEvent[] = [];
  for (const e of events ?? []) {
    const ev = intakeEventToCommandEvent(e);
    if (ev) out.push(ev);
  }
  return out;
}

export function collectVoiceCheckInCommandEvents(
  records: readonly VoiceCheckInRecord[] | undefined | null,
): VoiceCheckinCommandEvent[] {
  const out: VoiceCheckinCommandEvent[] = [];
  for (const r of records ?? []) {
    const ev = voiceCheckInToCommandEvent(r);
    if (ev) out.push(ev);
  }
  return out;
}

export function collectPerformanceAgeSnapshotEvents(
  snapshots: readonly PerformanceAgeDailySnapshot[] | undefined | null,
): PerformanceAgeSnapshotCommandEvent[] {
  const out: PerformanceAgeSnapshotCommandEvent[] = [];
  for (const s of snapshots ?? []) {
    const ev = performanceAgeSnapshotToCommandEvent(s);
    if (ev) out.push(ev);
  }
  return out;
}

/** Args accepted by {@link collectConfirmationCommandEvents}. */
export type ConfirmationSource = Parameters<typeof confirmationToCommandEvent>[0];

/**
 * Build a Decision Guard result row (directive §11: the ledger records a
 * "Decision Guard result" per command). Uses the reserved generic
 * `execution_event` kind so no schema change is needed; the subtype keeps
 * it invisible to every kind-filtered reader (adaptive learning, execution
 * memory, response timeline) — advisory audit only, never selection input.
 * The id encodes the evaluation instant (first-wins merge would otherwise
 * freeze the first verdict forever).
 */
export function decisionGuardResultToCommandEvent(args: {
  result: { verdict: 'approved' } | { verdict: 'blocked'; reason: string };
  commandId?: string;
  atMs: number;
}): ExecutionEventCommandEvent | null {
  if (!isFiniteNumber(args.atMs) || args.atMs <= 0) return null;
  const label =
    args.result.verdict === 'approved' ? 'approved' : `blocked:${args.result.reason}`;
  const id = isNonEmptyString(args.commandId)
    ? `execution_event:${args.atMs}:decision_guard:${args.commandId}`
    : `execution_event:${args.atMs}:decision_guard`;
  return {
    id,
    kind: 'execution_event',
    occurredAtMs: args.atMs,
    localDayIndex: utcDayIndex(args.atMs),
    source: 'decisionGuard',
    subtype: 'decision_guard_result',
    label,
    ...(isNonEmptyString(args.commandId) ? { commandId: args.commandId } : {}),
  };
}

export function collectConfirmationCommandEvents(
  confirmations: readonly ConfirmationSource[] | undefined | null,
): CommandConfirmationCommandEvent[] {
  const out: CommandConfirmationCommandEvent[] = [];
  for (const c of confirmations ?? []) {
    const ev = confirmationToCommandEvent(c);
    if (ev) out.push(ev);
  }
  return out;
}

/** Args accepted by {@link collectContextSnapshotCommandEvents}. */
export type ContextSnapshotSource = Parameters<typeof contextSnapshotToCommandEvent>[0];

export function collectContextSnapshotCommandEvents(
  snapshots: readonly ContextSnapshotSource[] | undefined | null,
): ContextSnapshotCommandEvent[] {
  const out: ContextSnapshotCommandEvent[] = [];
  for (const s of snapshots ?? []) {
    const ev = contextSnapshotToCommandEvent(s);
    if (ev) out.push(ev);
  }
  return out;
}

// ─── Read adapters: ledger → engine inputs ───────────────────────────────────────

/**
 * Project the ledger into `CommandConfidenceInputs`. Faithful to the live
 * derivation, read entirely from the ledger:
 *  - hasTodayBehavior — at least one `intake` event in the rolling 24h.
 *  - hasFreshBiometrics — a `context_snapshot` that recorded fresh
 *    biometrics AND is itself within the 24h biometric window.
 *  - hasWeather — a `context_snapshot` with a finite weather reading that is
 *    within the 6h weather window.
 * Each freshness window is evaluated against its OWN context snapshot, so an
 * older-but-still-fresh biometrics snapshot still counts even if the newest
 * snapshot only carried weather. Missing signals stay false (no fabrication).
 */
export function ledgerToCommandConfidenceInputs(
  events: readonly CommandEvent[],
  now: number = Date.now(),
): CommandConfidenceInputs {
  const hasTodayBehavior = eventsInWindow(events, now - BEHAVIOR_FRESHNESS_MS, now).some(
    (e) => e.kind === 'intake',
  );

  const contexts = eventsByKind(events, 'context_snapshot');
  // Anchor each signal's freshness to its ORIGINAL source fetch time when the
  // snapshot recorded it, falling back to occurredAtMs otherwise. Without this,
  // a stale reading observed late would look fresh for a full window from the
  // observation instant and silently overstate confidence vs the live engine.
  const hasFreshBiometrics = contexts.some(
    (c) =>
      c.hasFreshBiometrics === true &&
      isFresh(c.biometricsFetchedAtMs ?? c.occurredAtMs, now, BIOMETRIC_FRESHNESS_MS),
  );
  // PR5.1 — the replayed verdict is the SAME verdict, not a local re-derivation.
  // `isFresh` below still serves BIOMETRICS, whose window and semantics are
  // unchanged; only the weather arm is routed to the canonical classifier, so
  // replay can no longer disagree with the live path inside the skew grace.
  const hasWeather = contexts.some(
    (c) =>
      isFiniteNumber(c.weatherTempC) &&
      isWeatherObservationCurrent(c.weatherFetchedAtMs ?? c.occurredAtMs, now),
  );

  return { hasTodayBehavior, hasFreshBiometrics, hasWeather };
}

/**
 * Project the ledger's voice check-ins into `PerformanceMemoryEntry[]`.
 * `computePerformanceMemory` dedupes by day and orders internally, so this
 * is a straight field map; goal defaults to '' when the check-in had none.
 */
export function ledgerToPerformanceMemoryEntries(
  events: readonly CommandEvent[],
): PerformanceMemoryEntry[] {
  return eventsByKind(events, 'voice_checkin').map((e) => ({
    dayIndex: e.localDayIndex,
    energy: e.energy,
    stress: e.stress,
    goal: e.goal ?? '',
  }));
}

/**
 * Project the ledger's Performance Age snapshots into
 * `PerformanceAgeDailySnapshot[]` for the trend helper.
 * `computePerformanceAgeTrend` dedupes by day and orders internally.
 */
export function ledgerToPerformanceAgeSnapshots(
  events: readonly CommandEvent[],
): PerformanceAgeDailySnapshot[] {
  return eventsByKind(events, 'performance_age_snapshot').map((e) => ({
    dayIndex: e.localDayIndex,
    performanceAge: e.performanceAge,
  }));
}

// ─── Adherence (learning primitive — intentionally NOT wired to score) ───────────

export interface LedgerAdherence {
  /** 'insufficient' until at least ADHERENCE_MIN_SAMPLES confirmations exist. */
  status: 'insufficient' | 'ready';
  /** followed / total over the window, 0..1 — or null when insufficient. */
  followedRate: number | null;
  /** Total confirmations counted in the window. */
  sampleSize: number;
  /** How many of those were "followed". */
  followed: number;
}

/**
 * Read how reliably the member has followed commands recently, from the
 * `command_confirmation` events in a trailing window. PURE and read-only.
 *
 * Score-Protection: this is a learning PRIMITIVE for future surfaces. It is
 * deliberately NOT consumed by `deriveCommandConfidence` (whose signature is
 * unchanged), so adherence can never silently upgrade a recommendation's
 * confidence. Below the sample floor it reports 'insufficient' with a null
 * rate rather than guessing.
 */
export function deriveLedgerAdherence(
  events: readonly CommandEvent[],
  now: number = Date.now(),
  windowMs: number = ADHERENCE_WINDOW_MS,
): LedgerAdherence {
  const span = isFiniteNumber(windowMs) && windowMs > 0 ? windowMs : ADHERENCE_WINDOW_MS;
  const confirmations = eventsInWindow(events, now - span, now).filter(
    (e): e is CommandConfirmationCommandEvent => e.kind === 'command_confirmation',
  );
  const sampleSize = confirmations.length;
  const followed = confirmations.reduce((acc, c) => acc + (c.followed ? 1 : 0), 0);
  if (sampleSize < ADHERENCE_MIN_SAMPLES) {
    return { status: 'insufficient', followedRate: null, sampleSize, followed };
  }
  return { status: 'ready', followedRate: followed / sampleSize, sampleSize, followed };
}
