/**
 * Performance Memory — capture signal types + pure merge / prune / dedupe.
 *
 * This is the pure, RN-free core behind `services/performanceMemoryCapture.ts`.
 * It owns the THREE capture streams Performance Memory was otherwise missing —
 * travel days, caffeine intake, and the member's self-reported daily priority —
 * and nothing else. The service wraps these helpers with AsyncStorage + a
 * `useSyncExternalStore` surface, mirroring the `commandEvents` (pure) /
 * `commandLedger` (service) split.
 *
 * ── Score-Protection (hard lock) ──────────────────────────────────────────
 * Strictly OBSERVATIONAL. Every signal here is a record of behaviour that
 * already happened; nothing in this module (or its service) reads into,
 * awards, mutates, or fabricates the performance score, and it never dispatches
 * a reducer action. It exists only so the read-through aggregator can DESCRIBE
 * patterns — never to influence them.
 *
 * ── No fabrication ────────────────────────────────────────────────────────
 * Builders return `null` for unusable input and coercers drop malformed stored
 * entries, so a missing signal stays missing rather than being invented.
 *
 * ── Bounded ───────────────────────────────────────────────────────────────
 * Each stream is pruned to a rolling `PERFORMANCE_MEMORY_RETENTION_DAYS`
 * window AND hard-capped at `PERFORMANCE_MEMORY_MAX_PER_SOURCE`, independently,
 * on every read and write — one noisy stream can never starve another.
 *
 * Pure + deterministic: `nowMs` is injected so retention windows are testable.
 */

/** Rolling retention window for every capture stream. */
export const PERFORMANCE_MEMORY_RETENTION_DAYS = 180;

const MS_PER_DAY = 86_400_000;

/** Retention window expressed in ms (derived from the day constant). */
export const PERFORMANCE_MEMORY_RETENTION_MS =
  PERFORMANCE_MEMORY_RETENTION_DAYS * MS_PER_DAY;

/**
 * Hard per-source cap. Each stream is capped INDEPENDENTLY so a burst on one
 * (e.g. many caffeine logs) never evicts another (e.g. travel days).
 */
export const PERFORMANCE_MEMORY_MAX_PER_SOURCE = 1000;

// ─── Signal types ─────────────────────────────────────────────────────────

export interface CaptureSignalBase {
  /** Stable, deterministic dedupe key (idempotent re-capture is a no-op). */
  id: string;
  /** Epoch ms when the underlying behaviour occurred. */
  atMs: number;
  /** UTC day bucket — `floor(atMs / 86_400_000)`. */
  dayIndex: number;
}

export interface TravelSignal extends CaptureSignalBase {
  kind: 'travel';
}

export interface CaffeineSignal extends CaptureSignalBase {
  kind: 'caffeine';
  /** Drink-catalog category id (e.g. `coffee`), when known. */
  categoryId?: string;
}

export interface UserPrioritySignal extends CaptureSignalBase {
  kind: 'priority';
  /** The self-reported daily goal id (e.g. `train` / `compete`). */
  goal: string;
}

export type CaptureSignal = TravelSignal | CaffeineSignal | UserPrioritySignal;

export interface PerformanceMemoryCaptureState {
  travel: TravelSignal[];
  caffeine: CaffeineSignal[];
  priorities: UserPrioritySignal[];
  /** False until AsyncStorage has been read at least once. */
  hydrated: boolean;
}

// ─── Shared guards ────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** UTC day bucket: timezone-free integer day number. */
export function utcDayIndex(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

export function emptyCaptureState(): PerformanceMemoryCaptureState {
  return { travel: [], caffeine: [], priorities: [], hydrated: false };
}

function isValidBase(it: CaptureSignalBase): boolean {
  return (
    isNonEmptyString(it.id) &&
    isFiniteNumber(it.atMs) &&
    it.atMs > 0 &&
    Number.isInteger(it.dayIndex)
  );
}

// ─── Builders (source → signal; null when unusable) ───────────────────────

/**
 * One travel signal per UTC day. The day-keyed id makes repeated same-day
 * captures idempotent (the first detection of the day sticks).
 */
export function buildTravelSignal(atMs: number): TravelSignal | null {
  if (!isFiniteNumber(atMs) || atMs <= 0) return null;
  const dayIndex = utcDayIndex(atMs);
  return { id: `travel:${dayIndex}`, kind: 'travel', atMs, dayIndex };
}

/**
 * One caffeine signal per intake event. Keyed by the intake event id so
 * re-deriving the same drink never double-counts.
 */
export function buildCaffeineSignal(args: {
  intakeEventId: string;
  atMs: number;
  categoryId?: string;
}): CaffeineSignal | null {
  if (!isNonEmptyString(args.intakeEventId)) return null;
  if (!isFiniteNumber(args.atMs) || args.atMs <= 0) return null;
  const dayIndex = utcDayIndex(args.atMs);
  return {
    id: `caffeine:${args.intakeEventId}`,
    kind: 'caffeine',
    atMs: args.atMs,
    dayIndex,
    ...(isNonEmptyString(args.categoryId) ? { categoryId: args.categoryId } : {}),
  };
}

/**
 * One priority signal per check-in. Keyed by `day:atMs` so a same-day
 * re-check-in is a distinct event; the aggregator keeps the latest per day.
 * Requires a non-empty goal — a missing goal records NOTHING (no fabrication).
 */
export function buildUserPrioritySignal(args: {
  atMs: number;
  goal: string;
  dayIndex?: number;
}): UserPrioritySignal | null {
  if (!isFiniteNumber(args.atMs) || args.atMs <= 0) return null;
  if (!isNonEmptyString(args.goal)) return null;
  const dayIndex =
    isFiniteNumber(args.dayIndex) && Number.isInteger(args.dayIndex)
      ? args.dayIndex
      : utcDayIndex(args.atMs);
  return {
    id: `priority:${dayIndex}:${args.atMs}`,
    kind: 'priority',
    atMs: args.atMs,
    dayIndex,
    goal: args.goal,
  };
}

// ─── Merge / prune / cap (existing wins, retention-bounded, capped) ────────

/**
 * Dedupe by id (EXISTING wins, mirroring the ledger's first-wins merge so a
 * persisted entry can never be clobbered by a late in-flight one), drop
 * anything older than the retention window, order ascending by `atMs`, and
 * cap to the most recent `cap` entries. Pure + deterministic via `nowMs`.
 */
export function mergeSignals<T extends CaptureSignalBase>(
  existing: readonly T[],
  incoming: readonly T[],
  nowMs: number,
  cap: number = PERFORMANCE_MEMORY_MAX_PER_SOURCE,
): T[] {
  const byId = new Map<string, T>();
  for (const it of existing) if (isValidBase(it) && !byId.has(it.id)) byId.set(it.id, it);
  for (const it of incoming) if (isValidBase(it) && !byId.has(it.id)) byId.set(it.id, it);

  const minMs = isFiniteNumber(nowMs) ? nowMs - PERFORMANCE_MEMORY_RETENTION_MS : -Infinity;
  const kept = [...byId.values()]
    .filter((it) => it.atMs >= minMs)
    .sort((a, b) => a.atMs - b.atMs);
  return kept.length > cap ? kept.slice(kept.length - cap) : kept;
}

// ─── Coercion from untrusted persisted JSON ───────────────────────────────

function coerceBase(
  v: unknown,
): { id: string; atMs: number; dayIndex: number } | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (!isNonEmptyString(r.id)) return null;
  if (!isFiniteNumber(r.atMs) || r.atMs <= 0) return null;
  const dayIndex =
    isFiniteNumber(r.dayIndex) && Number.isInteger(r.dayIndex)
      ? r.dayIndex
      : utcDayIndex(r.atMs);
  return { id: r.id, atMs: r.atMs, dayIndex };
}

function coerceTravel(v: unknown): TravelSignal | null {
  const base = coerceBase(v);
  return base ? { ...base, kind: 'travel' } : null;
}

function coerceCaffeine(v: unknown): CaffeineSignal | null {
  const base = coerceBase(v);
  if (!base) return null;
  const r = v as Record<string, unknown>;
  return {
    ...base,
    kind: 'caffeine',
    ...(isNonEmptyString(r.categoryId) ? { categoryId: r.categoryId } : {}),
  };
}

function coercePriority(v: unknown): UserPrioritySignal | null {
  const base = coerceBase(v);
  if (!base) return null;
  const r = v as Record<string, unknown>;
  if (!isNonEmptyString(r.goal)) return null; // no goal ⇒ drop (no fabrication)
  return { ...base, kind: 'priority', goal: r.goal };
}

function coerceArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Rebuild a clean, pruned, capped capture state from untrusted parsed JSON.
 * Invalid entries are dropped, never fabricated. `hydrated` stays false — the
 * caller flips it once the load has been merged into the live store.
 */
export function sanitizeCaptureState(
  raw: unknown,
  nowMs: number,
): PerformanceMemoryCaptureState {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const travel = mergeSignals(
    coerceArray(obj.travel).map(coerceTravel).filter((s): s is TravelSignal => s !== null),
    [],
    nowMs,
  );
  const caffeine = mergeSignals(
    coerceArray(obj.caffeine)
      .map(coerceCaffeine)
      .filter((s): s is CaffeineSignal => s !== null),
    [],
    nowMs,
  );
  const priorities = mergeSignals(
    coerceArray(obj.priorities)
      .map(coercePriority)
      .filter((s): s is UserPrioritySignal => s !== null),
    [],
    nowMs,
  );
  return { travel, caffeine, priorities, hydrated: false };
}
