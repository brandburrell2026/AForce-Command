/**
 * Keyset-paginated iteration over `aforce_oura_tokens` userIds.
 *
 * Thin wrapper over `providerKit/tokenUserIds.ts` — the keyset-cursor
 * loop, sweep-cutoff guard, DB-clock `now()` source, and array-drain
 * helper are all shared implementation now (extracted from this file's
 * and `whoopFetchWorker.ts`'s previously byte-identical copies; see
 * that module for the full contract doc, including the tuple-keyset
 * boundary-correctness rationale and the round-1 PR-21 regression the
 * sweep-cutoff guard exists to prevent). This file exists to keep
 * Oura's public API — every exported name, type, and default —
 * byte-identical to what it was before the extraction, so
 * `ouraFetchSweepBootstrap.ts` and every existing Oura test keep
 * passing unchanged.
 *
 * Bound to `aforceOuraTokens`, which carries the required composite
 * index `aforce_oura_tokens_updated_user_idx` on `(updated_at, user_id)`
 * (confirmed present in `lib/db/src/schema/aforce.ts`, added alongside
 * the table, same as WHOOP's and Garmin's).
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceOuraTokens } from "@workspace/db";
import {
  PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE,
  getDbNow as getProviderDbNow,
  iterProviderTokenUserIds,
  iterProviderTokenUserIdsForSweep,
  listProviderTokenUserIds,
} from "./providerKit/tokenUserIds";

/**
 * Default keyset page size for `iterOuraTokenUserIds`. Matches WHOOP's
 * default (500) — same reasoning: large enough that per-page
 * round-trip overhead is negligible vs. fetch work, small enough that
 * one page comfortably fits in memory regardless of table size.
 * Sourced from `providerKit/tokenUserIds.ts` — same value as before
 * extraction.
 */
export const OURA_TOKEN_USERS_DEFAULT_PAGE_SIZE =
  PROVIDER_TOKEN_USERS_DEFAULT_PAGE_SIZE;

/**
 * Streaming iteration over every userId with stored Oura tokens, in
 * stable `(updated_at ASC, user_id ASC)` order. Thin wrapper over
 * `providerKit/tokenUserIds.ts`'s `iterProviderTokenUserIds`, bound to
 * `aforceOuraTokens`. See that module for the full keyset/cutoff
 * rationale.
 *
 * Yields one page (string[]) at a time so callers can fan out work
 * per-page with bounded memory.
 */
export function iterOuraTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): AsyncGenerator<string[], void, void> {
  return iterProviderTokenUserIds(db, aforceOuraTokens, opts);
}

/**
 * Sweep-mode iterator: same semantics as `iterOuraTokenUserIds` but the
 * snapshot `cutoff` is REQUIRED (not optional). Thin wrapper over
 * `providerKit/tokenUserIds.ts`'s `iterProviderTokenUserIdsForSweep` —
 * see that module for the full rationale (mirrors WHOOP's
 * `iterWhoopTokenUserIdsForSweep`, including the round-1 PR-21
 * regression this guard exists to prevent) and the runtime
 * cutoff-validation contract.
 */
export function iterOuraTokenUserIdsForSweep(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { cutoff: Date; pageSize?: number },
): AsyncGenerator<string[], void, void> {
  return iterProviderTokenUserIdsForSweep(db, aforceOuraTokens, opts);
}

/**
 * Return the DB's current `now()`. Thin re-export of
 * `providerKit/tokenUserIds.ts`'s `getDbNow` (provider-agnostic — no
 * table parameter needed). See that module for the clock-skew
 * rationale. Mirrors `whoopFetchWorker.ts`'s `getDbNow` — both now
 * resolve to the same shared implementation.
 */
export const getDbNow = getProviderDbNow;

/**
 * Backwards-compat drain of `iterOuraTokenUserIds` to one array. Thin
 * wrapper over `providerKit/tokenUserIds.ts`'s
 * `listProviderTokenUserIds`. Convenient for tests and ad-hoc tooling,
 * but NOT for the sweep hot path — at scale this re-materializes the
 * memory cliff the iterator was built to remove. Use
 * `iterOuraTokenUserIds` directly in production code that streams.
 */
export function listOuraTokenUserIds(
  db: NodePgDatabase<Record<string, unknown>>,
  opts: { pageSize?: number; updatedAtMax?: Date } = {},
): Promise<string[]> {
  return listProviderTokenUserIds(db, aforceOuraTokens, opts);
}
