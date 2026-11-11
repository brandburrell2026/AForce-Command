/**
 * clerkConfigured — is Clerk fully configured for this process?
 *
 * `@clerk/express`'s `clerkMiddleware()` THROWS inside the request pipeline
 * ("Publishable key is missing") when `CLERK_PUBLISHABLE_KEY` is absent, which
 * turned every request on an unconfigured deployment — including the
 * `/api/healthz` liveness probe — into a 500 (observed on the circle-api
 * staging service, 2026-10-05: "1/1 replicas never became healthy").
 *
 * The contract app.ts always promised is that auth being unconfigured makes
 * AUTHENTICATED routes fail closed (503 auth_unavailable in production), not
 * that the process stops answering. So the middleware is mounted only when
 * both keys are present, and the auth gates treat a missing decoration as
 * "auth unavailable" rather than letting getAuth() throw.
 */
export function clerkConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env["CLERK_SECRET_KEY"] && env["CLERK_PUBLISHABLE_KEY"]);
}
