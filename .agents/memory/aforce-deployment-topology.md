---
name: AForce deployment topology & prod Stripe/DB failure mode
description: How the AForce monorepo is deployed (one repl = one deployment), why api-server's Stripe init fails in the Autoscale prod, and what the mobile API host is.
---

# AForce deployment topology

- The whole repl deploys as **ONE deployment** (multi-artifact, path-routed proxy). There is **no separate deployment per artifact** — api-server is reachable at `/api` on the same deployment domain as the web/slide artifacts. `getDeploymentInfo()` returns a single deployment with one `deploymentType`.
- Therefore changing the deployment type (e.g. Autoscale → Reserved VM) is **repl-wide** and affects every artifact (pitch deck, site, command-center, api-server, the expo dev process) and its always-on billing — it is not scoped to api-server alone.
- Publishing / choosing the deployment type is **user-initiated in the Publishing UI**; the agent cannot click Publish or pick VM-vs-Autoscale. Post-deploy "external" verification = curl the public `*.replit.app` host over the internet + `fetchDeploymentLogs`.
- Mobile API base: set the EXPO build's `EXPO_PUBLIC_DOMAIN` to the deployment **host only** (no scheme, no `/api`) — client code builds `https://${EXPO_PUBLIC_DOMAIN}/api`. The auto `*.replit.app` host serves api-server at `/api` (verified 200 on `/api/healthz`).

## Prod Stripe/DB failure mode (Autoscale)

**Why:** Under Autoscale, instances cold-start and scale to zero. At each boot `initStripe()` (fire-and-forget in `index.ts`) runs `runMigrations` → `getStripeSync` → `findOrCreateManagedWebhook` → `syncBackfill`. In prod logs this **intermittently** hits `timeout expired` (pg pool) and connector `TimeoutError`, and even when it proceeds, `findOrCreateManagedWebhook` fails with `relation "stripe.accounts" does not exist` (migrations didn't reliably create the schema). Net: **`initStripe: managed webhook ensured` NEVER appears in prod** (webhook unregistered); `syncBackfill complete` appears only sometimes. Also repeated `SIGTERM` / "artifact process exited signal: terminated" cycles = Autoscale scaling down → drops the WebSocket hub + heartbeats (`attachAforceHub`).

**How to apply:** This is an environment/deployment-type problem, NOT a code bug — don't "fix" it by editing initStripe. The remedy is a **Reserved VM** (single always-on instance: stable pool, migrations run once, WS/heartbeats survive). Expect the Stripe webhook + DB timeouts to resolve on VM. `/api/healthz` is a cheap liveness check (no DB); `/api/healthz/deep` is **404** (not wired) so don't point health checks at it — artifact.toml already uses `/api/healthz`. Native mobile requests carry no Origin header so CORS `if(!origin) allow` lets them through even with `CORS_ALLOWED_ORIGINS` unset (browsers from other origins are blocked in prod).
