/**
 * providerKit — shared, provider-parameterized OAuth/biometrics-sync
 * plumbing extracted from the WHOOP implementation's patterns.
 *
 * WHOOP itself is production and stays on its own standalone
 * `whoop*.ts` files (frozen — not migrated in this lane). Oura is the
 * first provider migrated onto this kit; Strava and Garmin follow in
 * later lanes.
 *
 * See the individual modules for the extraction rationale:
 *   - `oauthStateStore.ts` — PKCE / OAuth-state store (memory + Drizzle).
 *   - `tokenManager.ts`    — OAuth2 token manager (auth code + refresh
 *                            grants, singleflight, sanitized errors).
 *   - `fetchWorker.ts`     — per-user biometrics fetch + persist.
 *   - `sweepLoop.ts`       — fan-out sweep + interval scheduling +
 *                            env-cadence parsing.
 *   - `retry.ts`           — error classification + backoff math.
 *   - `userStateRepo.ts`   — biometrics-blob write surface (source of
 *                            truth as of the W3 WHOOP cutover;
 *                            `whoopFetchWorker.ts` re-exports from
 *                            here).
 *   - `tokenUserIds.ts`    — keyset-paginated token-table userId
 *                            iteration, table-parameterized. Both WHOOP
 *                            and Oura wrap this.
 *   - `advisoryLock.ts`    — namespace-parameterized Postgres advisory
 *                            lock orchestration for multi-replica
 *                            singleflight. Both WHOOP and Oura wrap
 *                            this.
 */

export * from "./oauthStateStore";
export * from "./tokenManager";
export * from "./fetchWorker";
export * from "./sweepLoop";
export * from "./retry";
export * from "./userStateRepo";
export * from "./tokenUserIds";
export * from "./advisoryLock";
