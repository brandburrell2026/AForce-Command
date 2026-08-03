/**
 * Strava OAuth2 routes.
 *
 *   POST   /api/strava/oauth/start    (requireAuth)
 *     Mints a CSRF state, stores it server-side (bound to the caller's
 *     userId), and returns the authorize URL the client should send
 *     the user to. Does NOT accept a client-supplied post-success
 *     redirect (open redirect risk) — the server's `successRedirectUrl`
 *     is the only post-success destination.
 *
 *   GET    /api/strava/oauth/callback (no requireAuth)
 *     Strava redirects the browser here after consent. The userId is
 *     recovered from the single-use state record (proving the flow
 *     originated from this server for this user). Validates query,
 *     consumes state, exchanges the code server-side (client_id +
 *     client_secret — Strava is a confidential client, no PKCE),
 *     persists tokens, redirects or returns `{ok:true}`.
 *
 *   GET    /api/strava/status         (requireAuth)
 *     Returns `{credentialsConfigured:true, connected:boolean}`. The
 *     route only exists when credentials are configured (the router is
 *     mounted), so a 404 from the client means "credentials missing".
 *
 *   DELETE /api/strava/disconnect     (requireAuth)
 *     Clears the user's stored Strava tokens. Idempotent. When `deps.
 *     disconnector` is wired (Lane F5 — providerKit/disconnect.ts), also
 *     best-effort revokes the token at Strava, removes the Strava key
 *     from the `aforce_user_state.biometrics` snapshot blob, and — when
 *     `?purge=true` is passed — soft-tombstones this user's Strava
 *     health records. Omitting `deps.disconnector` keeps the
 *     pre-Lane-F5 token-clear-only behavior (current production mount —
 *     see `routes/index.ts`, not rewired in this lane).
 *

 *   POST   /api/strava/sync           (requireAuth)
 *     Runs one biometrics fetch+persist for the caller via the injected
 *     `runSyncForUser`. 409 `not_connected` when no tokens are stored;
 *     200 `{ok:true, synced:false, reason:'no_state'}` when connected
 *     but there's no `aforce_user_state` row to merge into.
 *
 * Hidden-infra: this router is only mounted by `routes/index.ts` when
 * STRAVA_OAUTH_REDIRECT_URI + STRAVA_CLIENT_ID + STRAVA_CLIENT_SECRET
 * are all present. With nothing configured (the default) the routes
 * simply do not exist and every `/api/strava/*` path 404s — there is
 * no half-configured or fake-"live" surface that can leak. Mirrors the
 * WHOOP/Garmin/Oura gates exactly.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import type { StravaTokenStore } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  destructiveGuards,
  type DestructiveRouteDeps,
} from "../middlewares/destructiveGuards";
import {
  buildStravaAuthorizeUrl,
  createOAuthState,
  STRAVA_DEFAULT_SCOPES,
} from "../lib/stravaAuthorize";
import type { StravaAuthStateStore } from "../lib/stravaAuthStateStore";
import {
  exchangeAuthorizationCode,
  type StravaOAuthConfig,
} from "../lib/stravaTokenManager";
import type { ProviderDisconnector } from "../lib/providerKit/disconnect";

export interface StravaOAuthDeps extends DestructiveRouteDeps {
  authStateStore: StravaAuthStateStore;
  oauthConfig: StravaOAuthConfig;
  redirectUri: string;
  /** Scope override; defaults to STRAVA_DEFAULT_SCOPES. */
  scope?: string;
  /** Per-user token store factory (defaults wire Drizzle). */
  tokenStoreFor: (userId: string) => StravaTokenStore;
  /** Optional post-success redirect. When omitted, returns JSON. */
  successRedirectUrl?: string;
  /**
   * Runs one biometrics fetch+persist for a user. Injected by the mount
   * so this route stays decoupled from the fetch worker / Drizzle (and
   * unit-testable). Returns a coarse status only. When omitted, the
   * `POST /strava/sync` route responds 500 `sync_unconfigured`.
   */
  runSyncForUser?: (userId: string) => Promise<{
    status: "ok" | "skipped_no_token" | "skipped_no_state" | "error";
    fetchedAt?: number;
  }>;
  /** Test seams. */
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  /**
   * Lane F5 disconnect+cleanup. When omitted, `DELETE /strava/disconnect`
   * keeps its pre-Lane-F5 behavior (token clear only) — see
   * `providerKit/disconnect.ts` for the full step contract. Not wired
   * by the production mount in `routes/index.ts` in this lane; that
   * wiring is a documented follow-up.
   */
  disconnector?: ProviderDisconnector;
}

const startBodySchema = z.object({}).strict().or(z.undefined()).or(z.null());

const callbackQuerySchema = z
  .object({
    code: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    scope: z.string().optional(),
  })
  .strict();

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown_error";
}

export function buildStravaOAuthRouter(deps: StravaOAuthDeps): IRouter {
  const router: IRouter = Router();
  const now = (): number => (deps.nowMs ?? Date.now)();
  const scope = deps.scope ?? STRAVA_DEFAULT_SCOPES;

  router.post(
    "/strava/oauth/start",
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
      const state = createOAuthState();
      try {
        await deps.authStateStore.put(state, {
          userId,
          createdAtMs: now(),
        });
      } catch (err) {
        req.log?.error(
          { userId, err: errName(err) },
          "stravaOAuth:start state store put failed",
        );
        res.status(500).json({ error: "state_store_unavailable" });
        return;
      }
      const authorizeUrl = buildStravaAuthorizeUrl({
        clientId: deps.oauthConfig.clientId,
        redirectUri: deps.redirectUri,
        state,
        scope,
      });
      res.status(200).json({ authorizeUrl, state });
    },
  );

  router.get("/strava/oauth/callback", async (req, res): Promise<void> => {
    const parsed = callbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    const q = parsed.data;
    if (q.error) {
      req.log?.warn(
        { providerError: q.error },
        "stravaOAuth:callback provider error",
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
        config: deps.oauthConfig,
        fetchImpl: deps.fetchImpl,
        nowMs: deps.nowMs,
      });
    } catch (err) {
      req.log?.error(
        { userId: record.userId, err: errName(err) },
        "stravaOAuth:callback code exchange failed",
      );
      res.status(502).json({ error: "code_exchange_failed" });
      return;
    }
    try {
      await deps.tokenStoreFor(record.userId).write(tokens);
    } catch (err) {
      req.log?.error(
        { userId: record.userId, err: errName(err) },
        "stravaOAuth:callback token persist failed",
      );
      res.status(500).json({ error: "token_persist_failed" });
      return;
    }
    req.log?.info(
      { userId: record.userId },
      "stravaOAuth:callback persisted tokens",
    );
    if (deps.successRedirectUrl) {
      res.redirect(302, deps.successRedirectUrl);
      return;
    }
    res.status(200).json({ ok: true });
  });

  router.get("/strava/status", requireAuth, async (req, res): Promise<void> => {
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
        "stravaOAuth:status token read failed",
      );
      res.status(500).json({ error: "status_unavailable" });
    }
  });

  router.delete(
    "/strava/disconnect",
    // Destructive: origin allow-list -> rate limit -> REAL auth (no
    // DEFAULT_USER_ID dev fallback). See middlewares/destructiveGuards.ts.
    ...destructiveGuards({
      scope: "strava_disconnect",
      limit: deps.destructiveRateLimit?.limit,
      windowMs: deps.destructiveRateLimit?.windowMs,
      auth: deps.destructiveAuth,
    }),
    async (req, res): Promise<void> => {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      // Lane F5 path: revoke + token clear + snapshot purge + optional
      // record tombstone via the shared providerKit disconnector.
      // `?purge=true` opts into the record-plane tombstone — chosen over
      // a body flag because DELETE request bodies are unreliable across
      // clients/proxies; a query param is unambiguous on a DELETE.
      if (deps.disconnector) {
        const purgeRecords = req.query["purge"] === "true";
        try {
          const result = await deps.disconnector.disconnect(userId, {
            purgeRecords,
          });
          req.log?.info(
            {
              userId,
              status: result.status,
              revocationOk: result.revocation.ok,
              snapshotRemoved: result.snapshotRemoved,
              recordsTombstoned: result.recordsTombstoned,
            },
            "stravaOAuth:disconnect complete (providerKit)",
          );
          // Truthful three-part answer. `ok`/`local` describe what THIS
          // server did (tokens deleted + snapshot key removed);
          // `revocation` describes what the PROVIDER did, and is the
          // only field that can tell the user whether the upstream
          // grant is actually dead. A blanket `ok:true` used to stand
          // for both.
          res.status(200).json({
            ok: true,
            local: "succeeded",
            revocation: result.revocation.outcome,
            status: result.status,
          });
        } catch (err) {
          req.log?.error(
            { userId, err: errName(err) },
            "stravaOAuth:disconnect (providerKit) failed",
          );
          res.status(500).json({ error: "disconnect_failed" });
        }
        return;
      }

      // Legacy path (no disconnector wired) — byte-identical to
      // pre-Lane-F5 behavior: token clear only.
      try {
        await deps.tokenStoreFor(userId).clear();
      } catch (err) {
        req.log?.error(
          { userId, err: errName(err) },
          "stravaOAuth:disconnect token clear failed",
        );
        res.status(500).json({ error: "disconnect_failed" });
        return;
      }
      req.log?.info({ userId }, "stravaOAuth:disconnect cleared tokens");
      // `local: "tokens_only"` — this path clears the token row and
      // NOTHING else: the biometrics snapshot survives and no revoke was
      // attempted. Saying "succeeded" here would overstate it.
      res.status(200).json({
        ok: true,
        local: "tokens_only",
        revocation: "skipped_not_configured",
      });
    },
  );

  router.post("/strava/sync", requireAuth, async (req, res): Promise<void> => {
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
        "stravaOAuth:sync runner threw",
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
