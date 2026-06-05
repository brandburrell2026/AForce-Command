import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scansRouter from "./scans";
import cyclesRouter from "./cycles";
import checkoutRouter from "./checkout";
import aforceRouter from "./aforce";
import entitlementRouter from "./entitlement";
import stripePortalRouter from "./stripePortal";
import cruiseRouter from "./cruise";
import battlesRouter from "./battles";
import circleRouter from "./circle";
import privacyRouter from "./privacy";
import voiceTtsRouter from "./voiceTts";
import designTokensRouter from "./designTokens";
import referralsRouter from "./referrals";
import earlyAccessRouter from "./earlyAccess";
import adminDemandRouter from "./adminDemand";
import adminDemandFromStateRouter from "./adminDemandFromState";
import analyticsAdminRouter from "./analyticsAdmin";
import { buildWhoopOAuthRouter } from "./whoopOAuth";
import { buildDefaultWhoopAdminRouter } from "./whoopAdmin";
import {
  createInMemoryWhoopAuthStateStore,
  createDrizzleWhoopAuthStateStore,
  type WhoopAuthStateStore,
} from "../lib/whoopAuthStateStore";
import { createDrizzleWhoopTokenStoreForUser, db } from "@workspace/db";
import { getWhoopRefreshRegistry } from "../lib/whoopRegistry";
import { logger } from "../lib/logger";
// Note: smartCaptureRouter is mounted directly in app.ts BEFORE the global
// 64kB express.json() limiter (base64 photos blow past 64kB instantly).

const router: IRouter = Router();

router.use(healthRouter);
router.use(scansRouter);
router.use(cyclesRouter);
router.use(checkoutRouter);
router.use(entitlementRouter);
router.use(stripePortalRouter);
router.use(cruiseRouter);
router.use("/aforce", aforceRouter);
router.use("/battles", battlesRouter);
router.use("/circle", circleRouter);
router.use("/privacy", privacyRouter);
router.use(voiceTtsRouter);
router.use(designTokensRouter);
router.use("/referrals", referralsRouter);
router.use("/early-access", earlyAccessRouter);
router.use(adminDemandRouter);
router.use(adminDemandFromStateRouter);
router.use(analyticsAdminRouter);

// Hidden-infra mount: the WHOOP OAuth routes only exist when all three
// env vars are set. With nothing configured (default dev / test), the
// router is not mounted and `/api/whoop/oauth/*` 404s — there is no
// half-configured surface that can leak.
const whoopClientId = process.env["WHOOP_CLIENT_ID"];
const whoopClientSecret = process.env["WHOOP_CLIENT_SECRET"];
const whoopRedirectUri = process.env["WHOOP_OAUTH_REDIRECT_URI"];
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

export default router;
