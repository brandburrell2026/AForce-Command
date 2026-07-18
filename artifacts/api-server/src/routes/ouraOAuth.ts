/**
 * Oura Ring OAuth2 + PKCE routes.
 *
 *   POST   /api/oura/oauth/start    (requireAuth)
 *     Mints a PKCE verifier + state, stores them server-side, and
 *     returns the authorize URL the client should send the user to.
 *     Does NOT accept a client-supplied post-success redirect (open
 *     redirect risk) — the server's `successRedirectUrl` is the only
 *     post-success destination.
 *
 *   GET    /api/oura/oauth/callback (no requireAuth)
 *     Oura redirects the browser here after consent. The userId is
 *     recovered from the single-use state record (proving the flow
 *     originated from this server for this user). Validates query,
 *     consumes state, exchanges the code, persists tokens, redirects
 *     or returns `{ok:true}`.
 *
 *   GET    /api/oura/status         (requireAuth)
 *     Returns `{credentialsConfigured:true, connected:boolean}`. The
 *     route only exists when credentials are configured (the router is
 *     mounted), so a 404 from the client means "credentials missing".
 *
 *   DELETE /api/oura/disconnect     (requireAuth)
 *     Clears the user's stored Oura tokens. Idempotent.
 *
 *   POST   /api/oura/sync           (requireAuth)
 *     Runs one biometrics fetch+persist for the caller via the injected
 *     `runSyncForUser`. 409 `not_connected` when no tokens are stored;
 *     200 `{ok:true, synced:false, reason:'no_state'}` when connected
 *     but there's no `aforce_user_state` row to merge into.
 *
 * Hidden-infra: this router is only mounted by `routes/index.ts` when
 * OURA_OAUTH_REDIRECT_URI + OURA_CLIENT_ID + OURA_CLIENT_SECRET are all
 * present. With nothing configured (the default) the routes simply do
 * not exist and every `/api/oura/*` path 404s — there is no
 * half-configured or fake-"live" surface that can leak. Mirrors the
 * WHOOP/Garmin gates exactly.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import type { OuraTokenStore } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  buildOuraAuthorizeUrl,
  codeChallengeS256,
  createCodeVerifier,
  createOAuthState,
  OURA_DEFAULT_SCOPES,
} from "../lib/ouraPkce";
import type { OuraAuthStateStore } from "../lib/ouraAuthStateStore";
import {
  exchangeAuthorizationCode,
  type OuraOAuthConfig,
} from "../lib/ouraTokenManager";

export interface OuraOAuthDeps {
  authStateStore: OuraAuthStateStore;
  oauthConfig: OuraOAuthConfig;
  redirectUri: string;
  /** Scope override; defaults to OURA_DEFAULT_SCOPES. */
  scope?: string;
  /** Per-user token store factory (defaults wire Drizzle). */
  tokenStoreFor: (userId: string) => OuraTokenStore;
  /** Optional post-success redirect. When omitted, returns JSON. */
  successRedirectUrl?: string;
  /**
   * Runs one biometrics fetch+persist for a user. Injected by the mount
   * so this route stays decoupled from the fetch worker / Drizzle (and
   * unit-testable). Returns a coarse status only. When omitted, the
   * `POST /oura/sync` route responds 500 `sync_unconfigured`.
   */
  runSyncForUser?: (userId: string) => Promise<{
    status: "ok" | "skipped_no_token" | "skipped_no_state" | "error";
    fetchedAt?: number;
  }>;
  /** Test seams. */
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}

const startBodySchema = z.object({}).strict().or(z.undefined()).or(z.null());

const callbackQuerySchema = z
  .object({
    code: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    error_description: z.string().optional(),
  })
  .strict();

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown_error";
}

export function buildOuraOAuthRouter(deps: OuraOAuthDeps): IRouter {
  const router: IRouter = Router();
  const now = (): number => (deps.nowMs ?? Date.now)();
  const scope = deps.scope ?? OURA_DEFAULT_SCOPES;

  router.post(
    "/oura/oauth/start",
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
          "ouraOAuth:start state store put failed",
        );
        res.status(500).json({ error: "state_store_unavailable" });
        return;
      }
      const authorizeUrl = buildOuraAuthorizeUrl({
        clientId: deps.oauthConfig.clientId,
        redirectUri: deps.redirectUri,
        state,
        codeChallenge: codeChallengeS256(verifier),
        scope,
      });
      res.status(200).json({ authorizeUrl, state });
    },
  );

  router.get("/oura/oauth/callback", async (req, res): Promise<void> => {
    const parsed = callbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    const q = parsed.data;
    if (q.error) {
      req.log?.warn(
        { providerError: q.error },
        "ouraOAuth:callback provider error",
      );
      res.status(400).json({ error: "oauth_provider_error", reason: q.error });
      return;
    }
    if (!q.code || !q.state) {
      res.status(400).json({ error: "missing_code_or_state" });
      return;
    }
    const record = await deps.authStateStore.consume(q.state, now());
    if (!record) {
      // Covers never-issued, replayed, and expired state. Same response
      // for all — never leak which one it was.
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
        "ouraOAuth:callback code exchange failed",
      );
      res.status(502).json({ error: "code_exchange_failed" });
      return;
    }
    try {
      await deps.tokenStoreFor(record.userId).write(tokens);
    } catch (err) {
      req.log?.error(
        { userId: record.userId, err: errName(err) },
        "ouraOAuth:callback token persist failed",
      );
      res.status(500).json({ error: "token_persist_failed" });
      return;
    }
    req.log?.info(
      { userId: record.userId },
      "ouraOAuth:callback persisted tokens",
    );
    if (deps.successRedirectUrl) {
      res.redirect(302, deps.successRedirectUrl);
      return;
    }
    res.status(200).json({ ok: true });
  });

  router.get("/oura/status", requireAuth, async (req, res): Promise<void> => {
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
        // Display-only metadata; never includes the token itself.
        expiresAt: tokens ? tokens.expiresAt : null,
      });
    } catch (err) {
      req.log?.error(
        { userId, err: errName(err) },
        "ouraOAuth:status token read failed",
      );
      res.status(500).json({ error: "status_unavailable" });
    }
  });

  router.delete(
    "/oura/disconnect",
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
          "ouraOAuth:disconnect token clear failed",
        );
        res.status(500).json({ error: "disconnect_failed" });
        return;
      }
      req.log?.info({ userId }, "ouraOAuth:disconnect cleared tokens");
      res.status(200).json({ ok: true });
    },
  );

  router.post("/oura/sync", requireAuth, async (req, res): Promise<void> => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!deps.runSyncForUser) {
      // Router is mounted but the mount didn't wire a sync runner — fail
      // loud rather than pretend a sync happened.
      res.status(500).json({ error: "sync_unconfigured" });
      return;
    }
    let outcome: {
      status: "ok" | "skipped_no_token" | "skipped_no_state" | "error";
      fetchedAt?: number;
    };
    try {
      outcome = await deps.runSyncForUser(userId);
    } catch (err) {
      req.log?.error(
        { userId, err: errName(err) },
        "ouraOAuth:sync runner threw",
      );
      res.status(502).json({ error: "sync_failed" });
      return;
    }
    switch (outcome.status) {
      case "ok":
        res
          .status(200)
          .json({ ok: true, synced: true, fetchedAt: outcome.fetchedAt ?? null });
        return;
      case "skipped_no_token":
        // No stored tokens -> not connected. Never fabricate data.
        res.status(409).json({ error: "not_connected" });
        return;
      case "skipped_no_state":
        // Connected, but no state row to merge into — surfaced as a
        // no-op success, not an error.
        res.status(200).json({ ok: true, synced: false, reason: "no_state" });
        return;
      case "error":
      default:
        res.status(502).json({ error: "sync_failed" });
        return;
    }
  });

  return router;
}
