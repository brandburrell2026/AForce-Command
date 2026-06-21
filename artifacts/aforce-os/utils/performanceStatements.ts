/**
 * Performance Statements™ — pure selection model.
 *
 * A Performance Statement is a single, short, spoken "identity" line the coach
 * delivers once per local day (e.g. "Performance is non-negotiable."). It is a
 * VOICE-ONLY moment — there is no quote card, no text render, no archive, and
 * no replay (see PerformanceStatementMount). This module owns the dependency-
 * free selection of WHICH line to speak given the active coach archetype, the
 * recently-spoken ids (for de-duplication), and the live performance signals.
 *
 * Strictly READ-ONLY / pure: imports nothing from services, stores, React, or
 * I/O (only a type-only import of CoachArchetype). Nothing here awards or
 * mutates score (Score-Protection) and it NEVER fabricates a data claim that
 * isn't true — the data-driven path is intentionally inert until a reliable
 * daily memory source exists (see selectDataDrivenStatement).
 *
 * These are identity statements, not hydration commands, so the Water-First
 * wording lock does NOT apply here (no "HYDRATE NOW" prefix); and they are a
 * distinct surface from Daily Wins (which is a TEXT home banner) so they must
 * not reuse its win framing.
 */
import type { CoachArchetype } from '@/services/voiceCatalog';

// ─── Descriptor ───────────────────────────────────────────────────────

export type StatementKind = 'data' | 'generic';

export interface StatementDescriptor {
  /** Stable id for de-duplication + analytics, e.g. 'push.1'. Never the text. */
  id: string;
  /** Whether this is a personalised data-driven line or a generic identity line. */
  kind: StatementKind;
  /** i18n key under the `performanceStatements` namespace holding the SPOKEN line. */
  i18nKey: string;
  /** Optional interpolation params for data-driven templates. */
  params?: Record<string, string | number>;
}

/** Live, read-only signals the selection MAY use (never mutates them). */
export interface StatementSignals {
  /** Derived recovery 0–100, or null when unknown. */
  recovery: number | null;
  /** Recovery direction, or null when unknown. */
  recoveryTrend: 'rising' | 'stable' | 'declining' | null;
  /** Consecutive on-protocol days. */
  complianceStreak: number;
}

export interface SelectStatementInput {
  /** Active coach archetype (from the selected voice). */
  archetype: CoachArchetype;
  /** Live signals (reserved for the future data-driven path). */
  signals: StatementSignals;
  /** Recently-spoken statement ids, MOST-RECENT FIRST, used to avoid repeats. */
  recentlyUsedIds: readonly string[];
}

// ─── Generic archetype pools ──────────────────────────────────────────
//
// One short identity line per variant. The i18n key is derived from the id
// (`performanceStatements.<id>`); the SPOKEN copy lives in locales/*.json so
// it is localised for en/es/fr/de/pt/it. Ordering defines the rotation.

const GENERIC_POOLS: Readonly<Record<CoachArchetype, readonly string[]>> = {
  push: ['push.1', 'push.2', 'push.3'],
  precision: ['precision.1', 'precision.2', 'precision.3'],
  ignite: ['ignite.1', 'ignite.2', 'ignite.3'],
  recovery: ['recovery.1', 'recovery.2', 'recovery.3'],
} as const;

/** Every generic statement id across all archetypes (for tests / i18n checks). */
export const ALL_GENERIC_STATEMENT_IDS: readonly string[] = Object.values(
  GENERIC_POOLS,
).flat();

/** The i18n key that holds the spoken copy for a statement id. */
export function statementI18nKey(id: string): string {
  return `performanceStatements.${id}`;
}

/**
 * Pick the first pool entry that hasn't been used recently. When the whole pool
 * has been used recently (small pool / long history), fall back to any entry
 * that isn't the single most-recent one so we never repeat the same line two
 * days running. Deterministic given its inputs.
 */
function pickFromPool(
  pool: readonly string[],
  recentlyUsedIds: readonly string[],
): string | null {
  if (pool.length === 0) return null;
  const fresh = pool.find((id) => !recentlyUsedIds.includes(id));
  if (fresh) return fresh;
  const mostRecent = recentlyUsedIds[0];
  return pool.find((id) => id !== mostRecent) ?? pool[0];
}

/**
 * Select a generic identity statement for the archetype, avoiding recent
 * repeats. Returns null only if the archetype somehow has no pool.
 */
export function selectGenericStatement(
  input: SelectStatementInput,
): StatementDescriptor | null {
  const pool = GENERIC_POOLS[input.archetype] ?? GENERIC_POOLS.push;
  const id = pickFromPool(pool, input.recentlyUsedIds);
  if (!id) return null;
  return { id, kind: 'generic', i18nKey: statementI18nKey(id) };
}

/**
 * Select a personalised, data-driven statement — or null.
 *
 * V1 always returns null. A truthful personalised line (e.g. "Yesterday was
 * your strongest recovery this month") requires a reliable per-day recovery
 * memory, but HistoryEntry is event-based, capped at 30 entries, and does NOT
 * persist a daily recovery series. Emitting such a claim today would fabricate
 * it, violating Score-Protection's no-fabrication rule and the roadmap's
 * "memory beats content" principle. This path is reserved here so a future
 * reliable daily-memory source can light it up WITHOUT changing the public
 * selection surface — when it does, it must be PREFERRED over the generic pool.
 */
export function selectDataDrivenStatement(
  _input: SelectStatementInput,
): StatementDescriptor | null {
  return null;
}

/**
 * The single entry point: prefer a truthful data-driven line, else fall back to
 * a generic archetype identity line. May return null if nothing applies.
 */
export function selectPerformanceStatement(
  input: SelectStatementInput,
): StatementDescriptor | null {
  return selectDataDrivenStatement(input) ?? selectGenericStatement(input);
}

// ─── Recently-used helpers (shared with the persistence service) ───────
//
// Kept here (pure) so the merge/dedupe logic is unit-testable without pulling
// AsyncStorage into the test environment.

/** Max number of recent ids retained for de-duplication. */
export const RECENT_USED_CAP = 8;

/** De-duplicate ids preserving first-seen (most-recent-first) order. */
export function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Merge two most-recent-first id lists (a before b), de-duplicate, and cap.
 * Used on hydration so an id recorded before the first disk read is preserved.
 */
export function mergeRecentlyUsed(
  a: readonly string[],
  b: readonly string[],
  cap: number = RECENT_USED_CAP,
): string[] {
  return dedupeIds([...a, ...b]).slice(0, cap);
}

/**
 * The later of two 'YYYY-MM-DD' day keys (lexicographic compare is correct for
 * this format), null-safe. Used on hydration so an early same-session write is
 * not clobbered by a stale persisted value.
 */
export function laterDayKey(
  a: string | null,
  b: string | null,
): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}
