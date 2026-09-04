/**
 * HYDROSTATE HISTORY EPOCH — the single source of truth.
 *
 * UNLIKE `hydroStateModelVersion.ts` in this same directory, this is NOT a
 * mirror: it has exactly one consumer, the `/journal/rollups` densification,
 * which is server-side. The app package holds no copy, so there is nothing to
 * drift from and no parity test to write. (An earlier revision of this PR did
 * keep a client copy and this header described the mirror arrangement; the
 * copy was deleted when densification moved into the route, and leaving the
 * header claiming a mirror + a parity test that never existed would have been
 * a lie about how the value is maintained.)
 *
 * WHY THE ROUTE NEEDS IT (founder ruling, consumer-completeness PR,
 * 2026-09-03). `GET /aforce/journal/rollups` densifies its response — one row
 * per calendar day of the member's EFFECTIVE window — so that EVERY consumer
 * (not just the Journal share card) can distinguish "no HydroState
 * observation that day" from "that day isn't in the window" without
 * reimplementing the distinction itself. The effective window needs a lower
 * bound per member, and this is the repository-owned floor for members whose
 * `aforce_user_state.history_start_at` is NULL (seeded before that column
 * existed — never backfilled, per standing ruling).
 *
 * THE DATE, AND WHY IT IS DEFENSIBLE. Commit `5da34b41c4e35d7b1d9f0f2c16423a9230261ab4`,
 * 2026-04-29 — "Add Hydration Journal feature to AForce OS" — shipped the
 * `aforce_score_snapshots` table, the write route, and the client writer
 * together. Before it there was no table, no route and no writer, so no
 * HydroState observation could exist in any form. Purely additive change
 * (the only removed line in that schema diff is an `import`). Per-member
 * identity (Clerk auth, `494fe8b6`) predates it by six days, so no
 * production snapshot was ever written under the single-user `"default"`
 * identity. `hydrostate_model_version` (D-08, 2026-07-26) is nullable with no
 * backfill and is a PROVENANCE question, not a history-existence one — using
 * its date would erase three real months of observation by asserting members
 * had no history when they did.
 */
export const HYDROSTATE_HISTORY_EPOCH = "2026-04-29";

/** The epoch as a UTC instant at the start of that day. */
export function hydroStateHistoryEpochDate(): Date {
  return new Date(`${HYDROSTATE_HISTORY_EPOCH}T00:00:00.000Z`);
}

/**
 * The floor for one member's eligible HydroState history.
 *
 * `historyStartAt` is the member's own stamp, written once when their
 * HydroState state row was first seeded. NULL means "seeded before the
 * column existed" — never "started at the epoch" and never "has no
 * history" — so the epoch stands in as a conservative floor rather than a
 * claim about that member.
 */
export function canonicalHistoryStart(
  historyStartAt: Date | null | undefined,
  now: Date,
): Date {
  const epoch = hydroStateHistoryEpochDate();
  if (historyStartAt == null) return epoch;
  const t = historyStartAt.getTime();
  // A stamp can never legitimately predate the epoch; if one does (clock
  // skew, a hand-edited row), the epoch is the safer of the two.
  //
  // AND IT CAN NEVER BE IN THE FUTURE, which this guard used to allow. The
  // asymmetry was the bug: one impossible direction was defended and the
  // other was trusted. A future stamp made the effective window's start
  // later than its end, `effectiveRangeKeys` returned `[]`, and a member with
  // real measured days got an EMPTY journal — total data loss from a single
  // bad timestamp, with no error anywhere. Sparse was unaffected, so it would
  // have looked like a densification bug rather than a bad row.
  //
  // A member who has data demonstrably has history, so a stamp that says
  // otherwise is not evidence about them — it is a broken value, and the
  // epoch is what an unstamped member already falls back to.
  if (!Number.isFinite(t) || t > now.getTime()) return epoch;
  return t > epoch.getTime() ? historyStartAt : epoch;
}
