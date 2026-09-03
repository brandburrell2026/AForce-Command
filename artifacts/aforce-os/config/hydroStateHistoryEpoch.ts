/**
 * HYDROSTATE HISTORY EPOCH — the earliest date on which persisted HydroState
 * history can exist for this product.
 *
 * WHY IT EXISTS. The Journal share/recap seam densifies a member's window to
 * one row per calendar day, and that needs a lower bound per member. The
 * repository has no per-member record of when a member's history began: the
 * HydroState anchor row (`aforce_user_state`) is seeded lazily by `getUserState`
 * and never recorded a creation time, and there is no Clerk `user.created`
 * webhook in the server. `history_start_at` now records it going forward; for
 * every member seeded BEFORE that column existed the information was never
 * captured and cannot be recovered. This constant is the conservative
 * repository-owned floor those members fall back to.
 *
 * WHAT IT IS NOT. Not a signup date, not a tenure estimate, and not a claim
 * about any individual. Reading it as "this member joined on this date" is
 * exactly the lossy-value substitution this layer exists to avoid. It says only:
 * NO HydroState observation can predate this date, for anyone. Member-facing
 * copy derived from it must describe MEASUREMENT COVERAGE, never tenure.
 *
 * THE DATE, AND WHY IT IS DEFENSIBLE (founder ruling 2026-09-02).
 * Commit `5da34b41c4e35d7b1d9f0f2c16423a9230261ab4`, 2026-04-29 — "Add
 * Hydration Journal feature to AForce OS" — shipped the entire vertical slice
 * in one commit: the `aforce_score_snapshots` table, the write route
 * `POST /aforce/journal/snapshot`, and the client writer (the debounced
 * snapshot effect in useAppStore.tsx). Before it there was no table, no route
 * and no writer, so no HydroState observation could exist in any form. The
 * change was purely additive — the only removed line in that schema diff is an
 * `import` — so no predecessor history table was replaced.
 *
 * WHY NOTHING LATER INVALIDATES IT:
 *   - `score` and `level` were defined in that same commit and never changed,
 *     so a snapshot row means today what it meant then.
 *   - Per-member identity (Clerk auth, `494fe8b6`) landed 2026-04-23, SIX DAYS
 *     EARLIER, so no production snapshot was ever written under the single-user
 *     `"default"` identity.
 *   - `hydrostate_model_version` (D-08, 2026-07-26) is nullable with no
 *     backfill. Pre-D-08 rows are valid observations whose PROVENANCE is
 *     unrecorded — a separate axis the boundary layer already classifies. Using
 *     D-08's date here would erase three months of real observations by
 *     asserting members had no history when they did.
 *
 * OWNERSHIP. The app package is the authoritative runtime source, matching the
 * precedent set by `HYDROSTATE_MODEL_VERSION` in `config/hydroStateModel.ts`.
 * The api-server does not need it: the rollups route stays SPARSE and only
 * reports each member's own `historyStartAt`. If a server-side mirror is ever
 * required, add it with a parity test the way `hydroStateModelVersion.ts` does.
 */
export const HYDROSTATE_HISTORY_EPOCH = '2026-04-29';

/** The epoch as a UTC instant at the start of that day. */
export function hydroStateHistoryEpochDate(): Date {
  return new Date(`${HYDROSTATE_HISTORY_EPOCH}T00:00:00.000Z`);
}

/**
 * The floor for one member's eligible HydroState history.
 *
 * `historyStartAt` is the member's own stamp, written once when their
 * HydroState state row was first seeded. NULL means "seeded before the column
 * existed" — never "started at the epoch" and never "has no history" — so the
 * epoch stands in as a conservative floor rather than as a claim about them.
 */
export function canonicalHistoryStart(historyStartAt: Date | null | undefined): Date {
  const epoch = hydroStateHistoryEpochDate();
  if (historyStartAt == null) return epoch;
  // A stamp can never legitimately predate the epoch; if one does (clock skew,
  // a hand-edited row), the epoch is the safer of the two.
  return historyStartAt.getTime() > epoch.getTime() ? historyStartAt : epoch;
}

/** Parse the wire's ISO `historyStartAt`, tolerating null and malformed input. */
export function parseHistoryStartAt(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
