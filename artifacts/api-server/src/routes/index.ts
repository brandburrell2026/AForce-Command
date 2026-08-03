import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scansRouter from "./scans";
import profileRouter from "./profile";
import cyclesRouter from "./cycles";
import checkoutRouter from "./checkout";
import aforceRouter from "./aforce";
import entitlementRouter from "./entitlement";
import stripePortalRouter from "./stripePortal";
import cruiseRouter from "./cruise";
import battlesRouter from "./battles";
import circleRouter from "./circle";
import privacyRouter from "./privacy";
import {
  buildAccountDeletionRouter,
  buildDefaultAccountDeletionDeps,
} from "./accountDeletion";
import voiceTtsRouter from "./voiceTts";
import designTokensRouter from "./designTokens";
import referralsRouter from "./referrals";
import earlyAccessRouter from "./earlyAccess";
import adminDemandRouter from "./adminDemand";
import adminDemandFromStateRouter from "./adminDemandFromState";
import analyticsAdminRouter from "./analyticsAdmin";
import commandCenterAdminRouter from "./commandCenterAdmin";
import { buildWhoopOAuthRouter } from "./whoopOAuth";
import { buildDefaultWhoopAdminRouter } from "./whoopAdmin";
import {
  createInMemoryWhoopAuthStateStore,
  createDrizzleWhoopAuthStateStore,
  type WhoopAuthStateStore,
} from "../lib/whoopAuthStateStore";
import { buildGarminOAuthRouter } from "./garminOAuth";
import {
  createInMemoryGarminAuthStateStore,
  createDrizzleGarminAuthStateStore,
  type GarminAuthStateStore,
} from "../lib/garminAuthStateStore";
import {
  buildDefaultGarminFetchDeps,
  runGarminFetchOnce,
} from "../lib/garminFetchWorker";
import { getGarminRefreshRegistry } from "../lib/garminRegistry";
import { buildOuraOAuthRouter } from "./ouraOAuth";
import {
  createInMemoryOuraAuthStateStore,
  createDrizzleOuraAuthStateStore,
  type OuraAuthStateStore,
} from "../lib/ouraAuthStateStore";
import {
  buildDefaultOuraFetchDeps,
  runOuraFetchOnce,
} from "../lib/ouraFetchWorker";
import { getOuraRefreshRegistry } from "../lib/ouraRegistry";
import { buildStravaOAuthRouter } from "./stravaOAuth";
import {
  createInMemoryStravaAuthStateStore,
  createDrizzleStravaAuthStateStore,
  type StravaAuthStateStore,
} from "../lib/stravaAuthStateStore";
import {
  buildDefaultStravaFetchDeps,
  runStravaFetchOnce,
} from "../lib/stravaFetchWorker";
import { getStravaRefreshRegistry } from "../lib/stravaRegistry";
import {
  createDrizzleWhoopTokenStoreForUser,
  createDrizzleGarminTokenStoreForUser,
  createDrizzleOuraTokenStoreForUser,
  createDrizzleStravaTokenStoreForUser,
  createHealthRecordsRepo,
  db,
} from "@workspace/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import {
  createDrizzleProviderUserStateDb,
  createProviderDisconnector,
  createOuraRevoker,
  createStravaRevoker,
  createWhoopRevoker,
  type ProviderDisconnector,
} from "../lib/providerKit/disconnect";
import { getWhoopRefreshRegistry } from "../lib/whoopRegistry";
import {
  buildDefaultWhoopFetchDeps,
  runWhoopFetchOnce,
} from "../lib/whoopFetchWorker";
import { logger } from "../lib/logger";
// Note: smartCaptureRouter is mounted directly in app.ts BEFORE the global
// 64kB express.json() limiter (base64 photos blow past 64kB instantly).

/**
 * F5 production wiring for `providerKit/disconnect.ts`.
 *
 * Before this, the disconnector existed and was tested but was NOT
 * mounted anywhere: every `DELETE /api/{provider}/disconnect` in
 * production took the legacy `store.clear()`-only branch. The user-
 * visible consequence was the exact dishonesty the module was written to
 * fix — tokens cleared, but the last-synced snapshot still sitting in
 * `aforce_user_state.biometrics` and still rendering in
 * `GET /api/aforce/state`, and (for Oura/Strava/WHOOP) the grant still
 * live at the provider. Untested wiring is not a feature; unmounted
 * wiring is not a fix.
 *
 * Exported so `routes/__tests__/providerDisconnectMounts.test.ts` can
 * assert the wiring itself — provider name, revoker presence, and the
 * Garmin `revocationSupported: false` ruling — rather than inferring it
 * from the express stack.
 *
 * Revoker matrix:
 *   Oura   — POST /oauth/revoke                 -> 'succeeded' | 'failed'
 *   Strava — POST /oauth/deauthorize            -> 'succeeded' | 'failed'
 *   WHOOP  — DELETE /developer/v2/user/access   -> 'succeeded' | 'failed'
 *   Garmin — none. Partner endpoints are unverified/dormant pending
 *            credentials, so `revocationSupported: false` makes the
 *            route answer 'unsupported' — a true statement — instead of
 *            'skipped_not_configured', which would imply a fixable gap.
 */
export function buildProviderDisconnectors(
  database: NodePgDatabase<Record<string, unknown>>,
  log?: Logger,
): Record<"whoop" | "garmin" | "oura" | "strava", ProviderDisconnector> {
  const userStateDb = createDrizzleProviderUserStateDb(database);
  const healthRecordsRepo = createHealthRecordsRepo(database);
  const common = { db: userStateDb, healthRecordsRepo, log };
  return {
    whoop: createProviderDisconnector({
      ...common,
      provider: "Whoop",
      tokenStoreFor: (userId) =>
        createDrizzleWhoopTokenStoreForUser(database, userId, {
          encryptionKey: process.env["WHOOP_TOKEN_ENCRYPTION_KEY"] ?? null,
          log,
        }),
      revoker: createWhoopRevoker(),
    }),
    garmin: createProviderDisconnector({
      ...common,
      provider: "Garmin",
      tokenStoreFor: (userId) =>
        createDrizzleGarminTokenStoreForUser(database, userId, {
          encryptionKey: process.env["GARMIN_TOKEN_ENCRYPTION_KEY"] ?? null,
          log,
        }),
      revocationSupported: false,
    }),
    oura: createProviderDisconnector({
      ...common,
      provider: "Oura",
      tokenStoreFor: (userId) =>
        createDrizzleOuraTokenStoreForUser(database, userId, {
          encryptionKey: process.env["OURA_TOKEN_ENCRYPTION_KEY"] ?? null,
          log,
        }),
      revoker: createOuraRevoker(),
    }),
    strava: createProviderDisconnector({
      ...common,
      provider: "Strava",
      tokenStoreFor: (userId) =>
        createDrizzleStravaTokenStoreForUser(database, userId, {
          encryptionKey: process.env["STRAVA_TOKEN_ENCRYPTION_KEY"] ?? null,
          log,
        }),
      revoker: createStravaRevoker(),
    }),
  };
}

const disconnectors = buildProviderDisconnectors(db, logger);

const router: IRouter = Router();

router.use(healthRouter);
router.use(scansRouter);
router.use(cyclesRouter);
router.use(checkoutRouter);
router.use(entitlementRouter);
router.use(stripePortalRouter);
router.use(cruiseRouter);
router.use("/aforce", aforceRouter);
router.use("/aforce/profile", profileRouter);
router.use("/battles", battlesRouter);
router.use("/circle", circleRouter);
router.use("/privacy", privacyRouter);
// Lane F5 (privacy/disconnect/deletion enforcement): the only mount this
// lane adds to this file. Always mounted (unlike the provider OAuth
// gates below) — account-level health-data deletion is not conditional
// on any provider's credentials being configured.
router.use(
  "/account",
  buildAccountDeletionRouter(buildDefaultAccountDeletionDeps(db, logger)),
);
router.use(voiceTtsRouter);
router.use(designTokensRouter);
router.use("/referrals", referralsRouter);
router.use("/early-access", earlyAccessRouter);
router.use(adminDemandRouter);
router.use(adminDemandFromStateRouter);
router.use(analyticsAdminRouter);
router.use(commandCenterAdminRouter);

// Hidden-infra mount: the WHOOP OAuth routes only exist when all three
// env vars are set. With nothing configured (default dev / test), the
// router is not mounted and `/api/whoop/oauth/*` 404s — there is no
// half-configured surface that can leak.
const whoopClientId = process.env["WHOOP_CLIENT_ID"];
const whoopClientSecret = process.env["WHOOP_CLIENT_SECRET"];
const whoopRedirectUri = process.env["WHOOP_OAUTH_REDIRECT_URI"];
// Runtime mount verification: log the PRESENCE (never the value) of each
// WHOOP_* var in the running process. The classic failure is a var set in the
// Railway dashboard but attached to the wrong variable group / read at build
// time, leaving process.env.WHOOP_* undefined at runtime — the router then
// silently doesn't mount and /api/whoop/oauth/* 404s. This line makes that
// diagnosable from the boot logs. NOTE the exact required names below; a common
// mistake is setting WHOOP_REDIRECT_URI instead of WHOOP_OAUTH_REDIRECT_URI.
logger.info(
  {
    WHOOP_CLIENT_ID: Boolean(whoopClientId),
    WHOOP_CLIENT_SECRET: Boolean(whoopClientSecret),
    WHOOP_OAUTH_REDIRECT_URI: Boolean(whoopRedirectUri),
    WHOOP_OAUTH_SUCCESS_URL: Boolean(process.env["WHOOP_OAUTH_SUCCESS_URL"]),
    WHOOP_TOKEN_ENCRYPTION_KEY: Boolean(process.env["WHOOP_TOKEN_ENCRYPTION_KEY"]),
    willMount: Boolean(whoopClientId && whoopClientSecret && whoopRedirectUri),
  },
  "whoopOAuth: env presence (mount verification)",
);
if (whoopClientId && whoopClientSecret && whoopRedirectUri) {
  // Hidden-infra env gate. Default = in-memory (preserves zero
  // behavior change for single-replica deploys). Strict whitelist
  // for the opt-in value, matching the WHOOP_FETCH_SWEEP_MULTI_REPLICA
  // pattern (PR #24) so a typo can't half-enable the Drizzle path.
  const driverRaw = process.env["WHOOP_AUTH_STATE_STORE_DRIVER"];
  const useDrizzleAuthState = driverRaw === "drizzle";
  const authStateStore: WhoopAuthStateStore = useDrizzleAuthState
    ? createDrizzleWhoopAuthStateStore(db)
    : createInMemoryWhoopAuthStateStore();
  logger.info(
    { driver: useDrizzleAuthState ? "drizzle" : "memory" },
    "whoopOAuth: auth-state store initialized",
  );
  router.use(
    buildWhoopOAuthRouter({
      // F5: revoke + token delete + served-snapshot removal.
      disconnector: disconnectors.whoop,
      authStateStore,
      oauthConfig: {
        clientId: whoopClientId,
        clientSecret: whoopClientSecret,
      },
      redirectUri: whoopRedirectUri,
      tokenStoreFor: (userId) =>
        createDrizzleWhoopTokenStoreForUser(db, userId, {
          // Hidden-infra opt-in: unset = unchanged plaintext behavior.
          // Whitespace-only is treated as unset by the store factory.
          encryptionKey: process.env["WHOOP_TOKEN_ENCRYPTION_KEY"] ?? null,
          log: logger,
        }),
      successRedirectUrl: process.env["WHOOP_OAUTH_SUCCESS_URL"],
      // Initial fetch on connect — mirrors the Garmin/Oura/Strava mounts.
      // Shares the process-singleton refresh registry with the cron sweep so
      // a connect-time fetch and a mid-sweep fetch can't double-refresh the
      // same user's token.
      runSyncForUser: async (userId) => {
        const deps = buildDefaultWhoopFetchDeps(db, userId, {
          log: logger,
          refreshRegistry: getWhoopRefreshRegistry(),
        });
        const outcome = await runWhoopFetchOnce(userId, deps);
        return { status: outcome.status, fetchedAt: outcome.fetchedAt };
      },
    }),
  );
  // Admin trigger shares the OAuth env gate AND the process-singleton
  // refresh registry that the cron sweep uses — so admin-triggered
  // fetches mid-sweep cannot double-refresh tokens for the same user.
  router.use(
    buildDefaultWhoopAdminRouter({
      db,
      refreshRegistry: getWhoopRefreshRegistry(),
      log: logger,
    }),
  );
}

// Hidden-infra mount: the Garmin OAuth routes only exist when all three
// env vars are set. With nothing configured (the default), the router is
// not mounted and `/api/garmin/*` 404s — there is no half-configured or
// fake-"live" surface that can leak. Mirrors the WHOOP gate above.
const garminClientId = process.env["GARMIN_CLIENT_ID"];
const garminClientSecret = process.env["GARMIN_CLIENT_SECRET"];
const garminRedirectUri = process.env["GARMIN_OAUTH_REDIRECT_URI"];
if (garminClientId && garminClientSecret && garminRedirectUri) {
  const garminDriverRaw = process.env["GARMIN_AUTH_STATE_STORE_DRIVER"];
  const useDrizzleGarminAuthState = garminDriverRaw === "drizzle";
  const garminAuthStateStore: GarminAuthStateStore = useDrizzleGarminAuthState
    ? createDrizzleGarminAuthStateStore(db)
    : createInMemoryGarminAuthStateStore();
  logger.info(
    { driver: useDrizzleGarminAuthState ? "drizzle" : "memory" },
    "garminOAuth: auth-state store initialized",
  );
  router.use(
    buildGarminOAuthRouter({
      // F5: revoke + token delete + served-snapshot removal.
      disconnector: disconnectors.garmin,
      authStateStore: garminAuthStateStore,
      oauthConfig: {
        clientId: garminClientId,
        clientSecret: garminClientSecret,
      },
      redirectUri: garminRedirectUri,
      tokenStoreFor: (userId) =>
        createDrizzleGarminTokenStoreForUser(db, userId, {
          encryptionKey: process.env["GARMIN_TOKEN_ENCRYPTION_KEY"] ?? null,
          log: logger,
        }),
      successRedirectUrl: process.env["GARMIN_OAUTH_SUCCESS_URL"],
      runSyncForUser: async (userId) => {
        const deps = buildDefaultGarminFetchDeps(db, userId, {
          log: logger,
          refreshRegistry: getGarminRefreshRegistry(),
        });
        const outcome = await runGarminFetchOnce(userId, deps);
        return { status: outcome.status, fetchedAt: outcome.fetchedAt };
      },
    }),
  );
}

// Hidden-infra mount: the Oura OAuth routes only exist when all three
// env vars are set. With nothing configured (the default), the router is
// not mounted and `/api/oura/*` 404s — there is no half-configured or
// fake-"live" surface that can leak. Mirrors the WHOOP/Garmin gates above.
const ouraClientId = process.env["OURA_CLIENT_ID"];
const ouraClientSecret = process.env["OURA_CLIENT_SECRET"];
const ouraRedirectUri = process.env["OURA_OAUTH_REDIRECT_URI"];
if (ouraClientId && ouraClientSecret && ouraRedirectUri) {
  const ouraDriverRaw = process.env["OURA_AUTH_STATE_STORE_DRIVER"];
  const useDrizzleOuraAuthState = ouraDriverRaw === "drizzle";
  const ouraAuthStateStore: OuraAuthStateStore = useDrizzleOuraAuthState
    ? createDrizzleOuraAuthStateStore(db)
    : createInMemoryOuraAuthStateStore();
  logger.info(
    { driver: useDrizzleOuraAuthState ? "drizzle" : "memory" },
    "ouraOAuth: auth-state store initialized",
  );
  router.use(
    buildOuraOAuthRouter({
      // F5: revoke + token delete + served-snapshot removal.
      disconnector: disconnectors.oura,
      authStateStore: ouraAuthStateStore,
      oauthConfig: {
        clientId: ouraClientId,
        clientSecret: ouraClientSecret,
      },
      redirectUri: ouraRedirectUri,
      tokenStoreFor: (userId) =>
        createDrizzleOuraTokenStoreForUser(db, userId, {
          encryptionKey: process.env["OURA_TOKEN_ENCRYPTION_KEY"] ?? null,
          log: logger,
        }),
      successRedirectUrl: process.env["OURA_OAUTH_SUCCESS_URL"],
      runSyncForUser: async (userId) => {
        const deps = buildDefaultOuraFetchDeps(db, userId, {
          log: logger,
          refreshRegistry: getOuraRefreshRegistry(),
        });
        const outcome = await runOuraFetchOnce(userId, deps);
        return { status: outcome.status, fetchedAt: outcome.fetchedAt };
      },
    }),
  );
}

// Hidden-infra mount: the Strava OAuth routes only exist when all three
// env vars are set. With nothing configured (the default), the router is
// not mounted and `/api/strava/*` 404s — there is no half-configured or
// fake-"live" surface that can leak. Mirrors the WHOOP/Garmin/Oura gates
// above.
const stravaClientId = process.env["STRAVA_CLIENT_ID"];
const stravaClientSecret = process.env["STRAVA_CLIENT_SECRET"];
const stravaRedirectUri = process.env["STRAVA_OAUTH_REDIRECT_URI"];
if (stravaClientId && stravaClientSecret && stravaRedirectUri) {
  const stravaDriverRaw = process.env["STRAVA_AUTH_STATE_STORE_DRIVER"];
  const useDrizzleStravaAuthState = stravaDriverRaw === "drizzle";
  const stravaAuthStateStore: StravaAuthStateStore = useDrizzleStravaAuthState
    ? createDrizzleStravaAuthStateStore(db)
    : createInMemoryStravaAuthStateStore();
  logger.info(
    { driver: useDrizzleStravaAuthState ? "drizzle" : "memory" },
    "stravaOAuth: auth-state store initialized",
  );
  router.use(
    buildStravaOAuthRouter({
      // F5: revoke + token delete + served-snapshot removal.
      disconnector: disconnectors.strava,
      authStateStore: stravaAuthStateStore,
      oauthConfig: {
        clientId: stravaClientId,
        clientSecret: stravaClientSecret,
      },
      redirectUri: stravaRedirectUri,
      tokenStoreFor: (userId) =>
        createDrizzleStravaTokenStoreForUser(db, userId, {
          encryptionKey: process.env["STRAVA_TOKEN_ENCRYPTION_KEY"] ?? null,
          log: logger,
        }),
      successRedirectUrl: process.env["STRAVA_OAUTH_SUCCESS_URL"],
      runSyncForUser: async (userId) => {
        const deps = buildDefaultStravaFetchDeps(db, userId, {
          log: logger,
          refreshRegistry: getStravaRefreshRegistry(),
        });
        const outcome = await runStravaFetchOnce(userId, deps);
        return { status: outcome.status, fetchedAt: outcome.fetchedAt };
      },
    }),
  );
}

export default router;
