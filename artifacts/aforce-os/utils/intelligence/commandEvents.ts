/**
 * commandEvents — the shared, append-only Command-Event Ledger (Tier-1
 * Intelligence Core foundation).
 *
 * This is the single, canonical record of REAL completed behaviour. Today
 * that behaviour is scattered across `UserState.intakeEvents`, voice
 * check-in records, the transient command-confirmation, and Performance
 * Age snapshots. This module gives all of them ONE normalized shape and a
 * small, pure query API so the existing engines (Command Confidence,
 * Performance Memory, Performance Age) can later adopt it via thin
 * adapters — without changing their own contracts.
 *
 * SCOPE (Step 1): pure ledger primitives + tests only. There is NO wiring
 * into the engines, NO persistence, and NO React/AsyncStorage import here.
 * Population (from the scattered sources) and persistence (a serialized
 * write queue in an app-layer service) land in later, separately-approved
 * steps.
 *
 * HARD LOCKS:
 *  - Score-Protection: the ledger only MEASURES. It never awards, mutates,
 *    or fabricates score. Context fields (weather/biometrics provenance)
 *    are advisory only.
 *  - No fabrication: events that fail validation are dropped, never
 *    repaired with invented values. Absence of events stays absence —
 *    downstream callers must read that as "low / needs-more-data".
 *
 * This file is intentionally dependency-free (no RN, no app types) so it
 * loads cleanly under the vitest pure-test runner.
 */

// ─── Event kinds ───────────────────────────────────────────────────────────────

export type CommandEventKind =
  | 'intake'
  | 'voice_checkin'
  | 'command_confirmation'
  | 'performance_age_snapshot'
  | 'context_snapshot';

const KNOWN_KINDS: readonly CommandEventKind[] = [
  'intake',
  'voice_checkin',
  'command_confirmation',
  'performance_age_snapshot',
  'context_snapshot',
];

/**
 * Fields shared by every event.
 *  - `id`            stable, deterministic dedupe key (e.g. `intake:${id}`).
 *  - `occurredAtMs`  when the behaviour happened (ms epoch).
 *  - `localDayIndex` integer day bucket for day-scoped queries; the caller
 *                    derives it (engines own their own day math).
 *  - `source`        provenance label, for debugging/audit only.
 *  - `commandId`     optional link to the recommendation that prompted it.
 */
interface CommandEventBase {
  id: string;
  kind: CommandEventKind;
  occurredAtMs: number;
  localDayIndex: number;
  source: string;
  commandId?: string;
}

export interface IntakeCommandEvent extends CommandEventBase {
  kind: 'intake';
  /** Stable id of the underlying real intake event. */
  intakeEventId: string;
  oz?: number;
  units?: number;
  fluidType?: string;
}

export interface VoiceCheckinCommandEvent extends CommandEventBase {
  kind: 'voice_checkin';
  /** 1..5 self-report; ledger requires finite, range is an engine concern. */
  energy: number;
  stress: number;
  goal?: string;
}

export interface CommandConfirmationCommandEvent extends CommandEventBase {
  kind: 'command_confirmation';
  /** Did the user follow the command? (advisory only — never scores). */
  followed: boolean;
  delta?: number;
  commandType?: string;
}

export interface PerformanceAgeSnapshotCommandEvent extends CommandEventBase {
  kind: 'performance_age_snapshot';
  performanceAge: number;
}

export interface ContextSnapshotCommandEvent extends CommandEventBase {
  kind: 'context_snapshot';
  /** Provenance only — never used to award score. */
  weatherTempC?: number | null;
  hasFreshBiometrics?: boolean;
}

export type CommandEvent =
  | IntakeCommandEvent
  | VoiceCheckinCommandEvent
  | CommandConfirmationCommandEvent
  | PerformanceAgeSnapshotCommandEvent
  | ContextSnapshotCommandEvent;

/** Max events retained in the ledger; oldest are dropped past this cap. */
export const MAX_LEDGER_EVENTS = 1000;

// ─── Validation helpers ─────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** Optional numeric field: absent is OK, but present-and-non-finite is invalid. */
function optionalFiniteOk(v: unknown): boolean {
  return v === undefined || isFiniteNumber(v);
}

/** Optional string field: absent is OK, but present-and-non-string is invalid. */
function optionalStringOk(v: unknown): boolean {
  return v === undefined || typeof v === 'string';
}

// ─── Normalization ──────────────────────────────────────────────────────────────

/**
 * Validate and clean a raw event into a typed `CommandEvent`, or return
 * `null` if it cannot be trusted. Only known fields are carried through —
 * unknown properties are stripped. Nothing is ever invented to "fix" a bad
 * event (no fabrication).
 */
export function normalizeCommandEvent(raw: unknown): CommandEvent | null {
  if (raw === null || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  const kind = e.kind;
  if (typeof kind !== 'string' || !KNOWN_KINDS.includes(kind as CommandEventKind)) {
    return null;
  }
  if (!isNonEmptyString(e.id)) return null;
  if (!isFiniteNumber(e.occurredAtMs) || e.occurredAtMs <= 0) return null;
  if (!Number.isInteger(e.localDayIndex)) return null;
  if (!isNonEmptyString(e.source)) return null;
  if (!optionalStringOk(e.commandId)) return null;

  const base: CommandEventBase = {
    id: e.id,
    kind: kind as CommandEventKind,
    occurredAtMs: e.occurredAtMs,
    localDayIndex: e.localDayIndex as number,
    source: e.source,
    ...(e.commandId !== undefined ? { commandId: e.commandId as string } : {}),
  };

  switch (kind) {
    case 'intake': {
      if (!isNonEmptyString(e.intakeEventId)) return null;
      if (!optionalFiniteOk(e.oz) || !optionalFiniteOk(e.units)) return null;
      if (!optionalStringOk(e.fluidType)) return null;
      return {
        ...base,
        kind: 'intake',
        intakeEventId: e.intakeEventId,
        ...(e.oz !== undefined ? { oz: e.oz as number } : {}),
        ...(e.units !== undefined ? { units: e.units as number } : {}),
        ...(e.fluidType !== undefined ? { fluidType: e.fluidType as string } : {}),
      };
    }
    case 'voice_checkin': {
      if (!isFiniteNumber(e.energy) || !isFiniteNumber(e.stress)) return null;
      if (!optionalStringOk(e.goal)) return null;
      return {
        ...base,
        kind: 'voice_checkin',
        energy: e.energy,
        stress: e.stress,
        ...(e.goal !== undefined ? { goal: e.goal as string } : {}),
      };
    }
    case 'command_confirmation': {
      if (typeof e.followed !== 'boolean') return null;
      if (!optionalFiniteOk(e.delta)) return null;
      if (!optionalStringOk(e.commandType)) return null;
      return {
        ...base,
        kind: 'command_confirmation',
        followed: e.followed,
        ...(e.delta !== undefined ? { delta: e.delta as number } : {}),
        ...(e.commandType !== undefined ? { commandType: e.commandType as string } : {}),
      };
    }
    case 'performance_age_snapshot': {
      if (!isFiniteNumber(e.performanceAge)) return null;
      return {
        ...base,
        kind: 'performance_age_snapshot',
        performanceAge: e.performanceAge,
      };
    }
    case 'context_snapshot': {
      // weatherTempC may be explicitly null (no reading); reject only a
      // present, non-null, non-finite value.
      if (e.weatherTempC !== undefined && e.weatherTempC !== null && !isFiniteNumber(e.weatherTempC)) {
        return null;
      }
      if (e.hasFreshBiometrics !== undefined && typeof e.hasFreshBiometrics !== 'boolean') {
        return null;
      }
      return {
        ...base,
        kind: 'context_snapshot',
        ...(e.weatherTempC !== undefined ? { weatherTempC: e.weatherTempC as number | null } : {}),
        ...(e.hasFreshBiometrics !== undefined ? { hasFreshBiometrics: e.hasFreshBiometrics as boolean } : {}),
      };
    }
    default:
      return null;
  }
}

// ─── Merge (the append path) ────────────────────────────────────────────────────

/**
 * Combine an existing ledger with incoming events into a clean, ordered,
 * capped ledger.
 *
 *  - Both inputs are normalized; anything invalid is dropped.
 *  - Dedupe is by `id`. The ledger is append-only and re-derivation from a
 *    source is idempotent, so the FIRST occurrence of an id wins (existing
 *    history is never silently rewritten by a re-derived duplicate).
 *  - Result is sorted by `occurredAtMs` ascending (stable for equal times).
 *  - If the count exceeds `cap`, the OLDEST events are dropped.
 *
 * Passing an empty `incoming` returns the normalized existing ledger
 * unchanged — it can never clobber stored history with nothing.
 */
export function mergeCommandEvents(
  existing: readonly unknown[],
  incoming: readonly unknown[] = [],
  options: { cap?: number } = {},
): CommandEvent[] {
  // A non-positive / non-integer / non-finite cap is treated as invalid and
  // falls back to the default — a bad cap must never silently wipe the ledger.
  const cap =
    Number.isInteger(options.cap) && (options.cap as number) > 0
      ? (options.cap as number)
      : MAX_LEDGER_EVENTS;

  const byId = new Map<string, CommandEvent>();
  // Existing first so existing ids win on conflict.
  for (const raw of existing) {
    const ev = normalizeCommandEvent(raw);
    if (ev && !byId.has(ev.id)) byId.set(ev.id, ev);
  }
  for (const raw of incoming) {
    const ev = normalizeCommandEvent(raw);
    if (ev && !byId.has(ev.id)) byId.set(ev.id, ev);
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => a.occurredAtMs - b.occurredAtMs,
  );

  // Drop oldest beyond the cap.
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

// ─── Queries ────────────────────────────────────────────────────────────────────

/** Events with `fromMs <= occurredAtMs <= toMs` (inclusive bounds). */
export function eventsInWindow(
  events: readonly CommandEvent[],
  fromMs: number,
  toMs: number,
): CommandEvent[] {
  if (!isFiniteNumber(fromMs) || !isFiniteNumber(toMs) || fromMs > toMs) return [];
  return events.filter((e) => e.occurredAtMs >= fromMs && e.occurredAtMs <= toMs);
}

/** Events whose `localDayIndex` matches the given day bucket. */
export function eventsOnDay(
  events: readonly CommandEvent[],
  localDayIndex: number,
): CommandEvent[] {
  if (!Number.isInteger(localDayIndex)) return [];
  return events.filter((e) => e.localDayIndex === localDayIndex);
}

/** All events of a given kind (input order preserved). */
export function eventsByKind<K extends CommandEventKind>(
  events: readonly CommandEvent[],
  kind: K,
): Extract<CommandEvent, { kind: K }>[] {
  return events.filter((e) => e.kind === kind) as Extract<CommandEvent, { kind: K }>[];
}

/** The most-recent event of a kind (by `occurredAtMs`), or `null` if none. */
export function latestByKind<K extends CommandEventKind>(
  events: readonly CommandEvent[],
  kind: K,
): Extract<CommandEvent, { kind: K }> | null {
  let latest: CommandEvent | null = null;
  for (const e of events) {
    if (e.kind !== kind) continue;
    if (latest === null || e.occurredAtMs > latest.occurredAtMs) latest = e;
  }
  return latest as Extract<CommandEvent, { kind: K }> | null;
}
