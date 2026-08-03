/**
 * Re-export seam for `UserStateRepo` / `createDrizzleUserStateRepo`.
 *
 * The source of truth for these two symbols today is
 * `../whoopFetchWorker.ts` — WHOOP is production and that file is
 * frozen for this lane (F6+O1: shared providerKit extraction, Oura
 * migrated first). We deliberately do NOT move the definitions out of
 * `whoopFetchWorker.ts` here; instead this module re-exports them so
 * every provider migrated onto providerKit (Oura now, Strava/Garmin
 * later) can depend on `providerKit/userStateRepo` instead of reaching
 * into a WHOOP-named file.
 *
 * At the WHOOP cutover (tracked as W3 in the migration plan), this
 * file becomes the SOURCE of truth — the repo/type definitions move
 * here, and `whoopFetchWorker.ts` re-exports from this module instead
 * of the other way around. Until then, this indirection is the only
 * change WHOOP's dependents see: none, because the re-export is
 * value- and type-identical to importing from `whoopFetchWorker`
 * directly.
 */
export {
  type UserStateRepo,
  createDrizzleUserStateRepo,
} from "../whoopFetchWorker";
