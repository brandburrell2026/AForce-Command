/**
 * WHOOP OAuth2 + PKCE routes.
 *
 *   POST /api/whoop/oauth/start   (requireAuth)
 *     Mints a PKCE verifier + state, stores them server-side, and
 *     returns the authorize URL the client should send the user to.
 *     Does NOT accept a client-supplied post-success redirect —
 *     that's an open-redirect waiting to happen. The server's
 *     `successRedirectUrl` (if any) is the only post-success
 *     destination.
 *
 *   GET  /api/whoop/oauth/callback  (no requireAuth)
 *     WHOOP redirects the browser here after consent. We don't
 *     require an active Clerk session — the userId is recovered from
 *     the single-use state record (proving the flow originated from
 *     this server for this user). Steps:
 *       1. Validate query (`code` + `state` required, or `error`).
 *       2. Consume the state record (single-use; expired/missing -> 400).
 *       3. Exchange the code at WHOOP via `exchangeAuthorizationCode`.
 *          Any failure -> 502 with a generic message (never leak
 *          the code or the underlying provider error).
 *       4. Persist tokens via the per-user `WhoopTokenStore` from
 *          PR #14.
 *       5. Redirect to `successRedirectUrl` if configured, else 200
 *          JSON `{ok:true}`.
 *
 * Hidden-infra: this router is only mounted by `routes/index.ts`
 * when WHOOP_OAUTH_REDIRECT_URI + WHOOP_CLIENT_ID + WHOOP_CLIENT_SECRET
 * are all present. With nothing configured (dev / test default) the
 * routes simply do not exist.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import type { WhoopTokenStore } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  buildWhoopAuthorizeUrl,
  codeChallengeS256,
  createCodeVerifier,
  createOAuthState,
  WHOOP_DEFAULT_SCOPES,
} from "../lib/whoopPkce";
import type { WhoopAuthStateStore } from "../lib/whoopAuthStateStore";
import {
  exchangeAuthorizationCode,
  type WhoopOAuthConfig,
} from "../lib/whoopTokenManager";

export interface WhoopOAuthDeps {
  authStateStore: WhoopAuthStateStore;
  oauthConfig: WhoopOAuthConfig;
  redirectUri: string;
  /** Scope override; defaults to WHOOP_DEFAULT_SCOPES. */
  scope?: string;
  /** Per-user token store factory (defaults wire Drizzle). */
  tokenStoreFor: (userId: string) => WhoopTokenStore;
  /** Optional post-success redirect. When omitted, returns JSON. */
  successRedirectUrl?: string;
  /**
   * Optional post-connect sync. When wired, the callback kicks a best-effort
   * initial biometrics fetch right after the tokens are stored, so real WHOOP
   * data lands immediately instead of waiting for the periodic sweep's next
   * tick. It never blocks or fails the browser redirect — a sync error is
   * logged and the ongoing sweep retries. Mirrors the Garmin/Oura/Strava hook.
   */
  runSyncForUser?: (userId: string) => Promise<{
    status:
      | "ok"
      | "skipped_no_token"
      | "skipped_no_state"
      | "skipped_locked"
      | "error";
    fetchedAt?: number;
  }>;
  /** Test seams. */
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

const startBodySchema = z
  .object({})
  .strict()
  .or(z.undefined())
  .or(z.null());

// NOT `.strict()`: an OAuth provider may append params to the redirect beyond
// the ones we consume (WHOOP can add extras alongside `code`/`state`). Rejecting
// on an unexpected param would 400 a perfectly valid callback ("bad_request").
// Unknown keys are stripped (zod default); `code`/`state` are still validated
// below (the handler requires both, or an `error`).
const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  error_description: z.string().optional(),
});

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown_error";
}

export function buildWhoopOAuthRouter(deps: WhoopOAuthDeps): IRouter {
  const router: IRouter = Router();
  const now = (): number => (deps.nowMs ?? Date.now)();
  const scope = deps.scope ?? WHOOP_DEFAULT_SCOPES;

  router.post(
    "/whoop/oauth/start",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      const parsed = startBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const verifier = createCodeVerifier();
      const state = createOAuthState();
      try {
        await deps.authStateStore.put(state, {
          codeVerifier: verifier,
          userId,
          createdAtMs: now(),
        });
      } catch (err) {
        req.log?.error(
          { userId, err: errName(err) },
          "whoopOAuth:start state store put failed",
        );
        res.status(500).json({ error: "state_store_unavailable" });
        return;
      }
      const authorizeUrl = buildWhoopAuthorizeUrl({
        clientId: deps.oauthConfig.clientId,
        redirectUri: deps.redirectUri,
        state,
        codeChallenge: codeChallengeS256(verifier),
        scope,
      });
      res.status(200).json({ authorizeUrl, state });
    },
  );

  router.get(
    "/whoop/oauth/callback",
    async (req, res): Promise<void> => {
      const parsed = callbackQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const q = parsed.data;
      if (q.error) {
        req.log?.warn(
          { providerError: q.error },
          "whoopOAuth:callback provider error",
        );
        res.status(400).json({
          error: "oauth_provider_error",
          reason: q.error,
        });
        return;
      }
      if (!q.code || !q.state) {
        res.status(400).json({ error: "missing_code_or_state" });
        return;
      }
      const record = await deps.authStateStore.consume(q.state, now());
      if (!record) {
        // Covers: never-issued state, replay of consumed state, and
        // expired state. Same client-visible response — never leak
        // which one it was.
        res.status(400).json({ error: "invalid_or_expired_state" });
        return;
      }
      let tokens;
      try {
        tokens = await exchangeAuthorizationCode({
          code: q.code,
          codeVerifier: record.codeVerifier,
          redirectUri: deps.redirectUri,
          config: deps.oauthConfig,
          fetchImpl: deps.fetchImpl,
          nowMs: deps.nowMs,
        });
      } catch (err) {
        req.log?.error(
          { userId: record.userId, err: errName(err) },
          "whoopOAuth:callback code exchange failed",
        );
        res.status(502).json({ error: "code_exchange_failed" });
        return;
      }
      try {
        await deps.tokenStoreFor(record.userId).write(tokens);
      } catch (err) {
        req.log?.error(
          { userId: record.userId, err: errName(err) },
          "whoopOAuth:callback token persist failed",
        );
        res.status(500).json({ error: "token_persist_failed" });
        return;
      }
      req.log?.info(
        { userId: record.userId },
        "whoopOAuth:callback persisted tokens",
      );
      // Best-effort initial fetch so the app shows real biometrics right after
      // connect (not on the next sweep tick). Awaited so it definitely runs,
      // but wrapped so a fetch error never blocks or fails the redirect.
      if (deps.runSyncForUser) {
        try {
          const outcome = await deps.runSyncForUser(record.userId);
          req.log?.info(
            { userId: record.userId, status: outcome.status },
            "whoopOAuth:callback initial sync",
          );
        } catch (err) {
          req.log?.warn(
            { userId: record.userId, err: errName(err) },
            "whoopOAuth:callback initial sync threw",
          );
        }
      }
      if (deps.successRedirectUrl) {
        res.redirect(302, deps.successRedirectUrl);
        return;
      }
      res.status(200).json({ ok: true });
    },
  );

  // ─── Connection status ──────────────────────────────────────────────────────
  // The app drives its WHOOP row off SERVER truth (a stored token), not a cached
  // local flag: no token -> the UI shows Connect. `credentialsConfigured` is
  // always true here because the router only mounts when the WHOOP_* env is set.
  router.get("/whoop/status", requireAuth, async (req, res): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      const tokens = await deps.tokenStoreFor(userId).read();
      res.status(200).json({
        credentialsConfigured: true,
        connected: tokens !== null,
        // Display-only metadata; never the token itself.
        expiresAt: tokens ? tokens.expiresAt : null,
      });
    } catch (err) {
      req.log?.error(
        { userId, err: errName(err) },
        "whoopOAuth:status token read failed",
      );
      res.status(500).json({ error: "status_unavailable" });
    }
  });

  // ─── Disconnect ─────────────────────────────────────────────────────────────
  // Clears the stored token so a subsequent Connect re-runs a real OAuth
  // authorization (the fix for a stale/undecryptable token after key rotation).
  router.delete(
    "/whoop/disconnect",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      try {
        await deps.tokenStoreFor(userId).clear();
      } catch (err) {
        req.log?.error(
          { userId, err: errName(err) },
          "whoopOAuth:disconnect token clear failed",
        );
        res.status(500).json({ error: "disconnect_failed" });
        return;
      }
      req.log?.info({ userId }, "whoopOAuth:disconnect cleared tokens");
      res.status(200).json({ ok: true });
    },
  );

  // ─── Manual sync ────────────────────────────────────────────────────────────
  // Lets the app pull immediately after a browser OAuth return, rather than
  // waiting for the periodic sweep. Mirrors /garmin/sync.
  router.post("/whoop/sync", requireAuth, async (req, res): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!deps.runSyncForUser) {
      res.status(500).json({ error: "sync_unconfigured" });
      return;
    }
    let outcome: Awaited<ReturnType<NonNullable<WhoopOAuthDeps["runSyncForUser"]>>>;
    try {
      outcome = await deps.runSyncForUser(userId);
    } catch (err) {
      req.log?.error({ userId, err: errName(err) }, "whoopOAuth:sync runner threw");
      res.status(502).json({ error: "sync_failed" });
      return;
    }
    switch (outcome.status) {
      case "ok":
        res.status(200).json({ ok: true, synced: true, fetchedAt: outcome.fetchedAt ?? null });
        return;
      case "skipped_no_token":
        res.status(409).json({ error: "not_connected" });
        return;
      case "skipped_no_state":
        res.status(200).json({ ok: true, synced: false, reason: "no_state" });
        return;
      case "skipped_locked":
        res.status(200).json({ ok: true, synced: false, reason: "locked" });
        return;
      case "error":
      default:
        res.status(502).json({ error: "sync_failed" });
        return;
    }
  });

  return router;
}
