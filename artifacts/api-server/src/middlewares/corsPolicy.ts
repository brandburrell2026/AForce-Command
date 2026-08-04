import type cors from "cors";

/**
 * CORS origin-check for the server's single `cors()` mount in `app.ts` —
 * the highest-blast-radius line on the server, since every client
 * (native app, Expo web preview, and any browser) passes through it.
 * Extracted to its own module (rather than living inline in `app.ts`) so
 * it can be exercised directly in tests without importing the rest of
 * `app.ts`'s dependency graph (DB, Stripe, Shopify, Smart Capture, every
 * provider OAuth router...).
 *
 * Behavior:
 *   - no Origin header (native app / curl / same-origin)   -> allow
 *   - CORS_ALLOWED_ORIGINS set                              -> allowlist only
 *   - unset, NODE_ENV=production                            -> never reflect
 *   - unset, NODE_ENV!=production, CORS_DEV_REFLECT=1       -> reflect any origin
 *   - unset, NODE_ENV!=production, CORS_DEV_REFLECT unset   -> never reflect
 *
 * The last two rows are the fix for a Squad-F security finding: outside
 * production, with no allowlist configured, reflecting ANY origin (with
 * credentials:true) used to be the unconditional default. Production is
 * structurally closed (Dockerfile + artifact.toml pin
 * NODE_ENV=production), but hosted dev previews on *.replit.dev run
 * NODE_ENV=development and are internet-reachable — that default let a
 * hostile page make credentialed cross-origin READS against a live
 * dev/beta session there. (Destructive routes were never exposed by
 * this: they're independently guarded server-side by
 * `enforceAllowedOrigin` in `./destructiveGuards.ts`, which this change
 * does not touch. Reads had no equivalent guard, and `requireAuth`'s
 * DEFAULT_USER_ID fallback means the default blast radius is demo-user
 * data — except for a dev/beta tester with a real, live Clerk session,
 * who would risk their own real data.)
 *
 * Reflect-all is therefore now an explicit opt-in: local dev workflows
 * and any hosted preview that intentionally serves the Expo web client
 * must set CORS_DEV_REFLECT=1 (see `.env.example`).
 *
 * Reads env vars at CALL time rather than at module-load time so tests
 * can flip `NODE_ENV` / `CORS_ALLOWED_ORIGINS` / `CORS_DEV_REFLECT`
 * between requests against the same running app — this changes nothing
 * about real-deployment behavior, since env vars there are fixed for
 * the lifetime of the process.
 */
export function buildCorsOptions(): cors.CorsOptions {
  return {
    credentials: true,
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin / curl / native fetch
      const corsEnv = process.env["CORS_ALLOWED_ORIGINS"];
      const allowlist = corsEnv
        ? corsEnv.split(",").map((o) => o.trim()).filter(Boolean)
        : null;
      if (allowlist && allowlist.length > 0) {
        return cb(null, allowlist.includes(origin));
      }
      const isProd = process.env["NODE_ENV"] === "production";
      const devReflect = process.env["CORS_DEV_REFLECT"] === "1";
      if (!isProd && devReflect) return cb(null, true);
      return cb(null, false);
    },
  };
}
