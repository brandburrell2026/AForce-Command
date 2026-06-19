---
name: AForce wearable / health-provider integration status
description: What is REAL vs scaffold vs demo across the wearable integrations, the WHOOP "il" codename, and the env-var gate that makes WHOOP OAuth 404 when unset.
---

Audit of how the seven `HealthProviderId` providers (apple_health, oura,
samsung_health, google_health, garmin, whoop, strava) are actually wired. The
provider CATALOG (`data/healthProviders.ts`) drives only UI cards + the mocked
connect flow; real data wiring is per-service and very uneven.

## What is real vs not (as of the audit)
- **Apple HealthKit — REAL.** The ONLY installed wearable native module is
  `@kingstinct/react-native-healthkit`. `services/appleHealth.ts` requests HR /
  RestingHR / HRV-SDNN / StepCount / SleepAnalysis and writes DietaryWater;
  app.json carries the HealthKit entitlement + usage strings. Apple Watch, Oura,
  and any HealthKit device arrive via Apple-Health passthrough (no per-device
  code). Only runs in a real iOS native/EAS build — never in Replit web preview.
- **WHOOP — fully coded, DORMANT.** See the "il" note below. Armed but no creds.
- **Samsung Health — SCAFFOLD ONLY.** `services/samsungHealth.ts` is a correct
  bridge contract but `@samsung/health-data-sdk` is NOT installed and there is no
  Android build/permission; it safely returns "unavailable" (never fabricates).
  UI shows a demo seed. Needs Samsung partner enrollment + native Android build.
- **Google Health Connect — NOT integrated.** No `react-native-health-connect`
  package, no Android Health Connect permission; demo-seeded only. So Fitbit,
  Garmin-via-Android, and a future Samsung Ring are all unreachable today.
- **Garmin Connect — NO direct integration.** Catalog card + demo seed only; no
  OAuth, no Connect IQ, no SDK, no server routes. (Owner flags Garmin direct as
  critical for Guardian/military/endurance — net-new work, mirror the WHOOP
  server pattern; needs Garmin Health API creds + native testing.)
- **Oura / Strava / Fitbit — no direct API.** Oura comes via Apple Health;
  Strava is demo seed; Fitbit isn't even a `HealthProviderId` (Health-Connect
  path only). Non-HealthKit standalone providers are `data/providerDemoSnapshots.ts`.

## "il" = WHOOP's server-side codename (not a separate provider)
All WHOOP OAuth infra is named `il` to keep the partnership out of the public
surface: routes `/api/whoop/il/start|callback`, tables `aforce_il_tokens` /
`aforce_il_auth_states`, `ilTokenStore`, `ilFetchWorker`, `ilRegistry`, token
URL `api.prod.whoop.com/il/il2/token`. Treat `il` in server/OAuth code as WHOOP.
(Separately, `il` also appears as an extra `SignalSourceId` in
`utils/signalHierarchy.ts` superset — that is a different, hierarchy-only id.)

## WHOOP OAuth is gated — 404 when unconfigured
The WHOOP router mounts ONLY if `WHOOP_CLIENT_ID` + `WHOOP_CLIENT_SECRET` +
`WHOOP_OAUTH_REDIRECT_URI` are ALL set (optional: `WHOOP_TOKEN_ENCRYPTION_KEY`,
`WHOOP_OAUTH_SUCCESS_URL`, `WHOOP_AUTH_STATE_STORE_DRIVER`). If any is missing the
router is not mounted and `/api/whoop/il/*` 404s — deliberate "no half-configured
surface". **Why:** prevents a half-wired OAuth handshake from existing.
**How to apply:** to call WHOOP "active" you must confirm those 3 env vars are
set AND see the WHOOP bootstrap log at server boot; absent them the client PKCE
in `whoop.ts`/`whoopAuth.ts` has nothing to talk to (and there is no client UI
trigger yet — "hidden infrastructure Phase 1").
