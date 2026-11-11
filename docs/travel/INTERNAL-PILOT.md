# AForce Travel — local internal integration

Updated 2026-10-28. AForce base: current main `3c8ab7820ce5a9bdea414cd4e4a465d15eeb6988` (includes released startup repair and subsequent website-only change). Paired TravelGate base: current main `7a2116193506ce3de75cbbc60e21c76834327c7f`.

## Implemented

Travel is a native AForce OS route at `/travel`, branded “Travel · powered by TravelGate.”

- Enter a flight number, airports, departure date/time and departure UTC offset.
- Save/reopen one journey per signed-in account on this device.
- Home cards on Editorial Home, Home V2 and internal Skin Intelligence Home.
- Open the actual Hydration root or enabled Moments route.
- Finish to dismiss the Home card; explicitly confirm local removal.
- Explicit “Check flight status” action, with reported status, gate/terminal when supplied, estimated departure and provider-fetch timestamp.
- Optional, default-off native preparation reminders: one generic AForce notification two hours before entered departure; suppressed during 22:00–07:00 departure-airport quiet hours and after the preparation time.
- Explicit ownership choices: AForce, another app, or off. Selecting another app cancels only AForce’s preparation reminder; it does not modify TravelGate/airline settings.
- A root lifecycle cancels on confirmed sign-out, account switch, completion/removal or disabling the travel flag. Transient unresolved/unverifiable identity does not itself erase an established schedule.
- Native notification content contains no flight, airport, health or raw account ID. Taps require an owner fingerprint and the still-active saved trip; other notification streams are untouched.
- Clear travel data from this device removes the current account’s trip, preference and status cache, and cancels/dismisses its AForce notification and removes its stored notification response. Partial failures are reported.
- Separate manual itinerary and provider observation: a lookup cannot rewrite the entered flight or mark the trip finished.
- Recently fetched, stale and unavailable states; failed refreshes retain a clearly labeled last-known result. Timestamps age locally and on foreground/focus without background provider polling.
- Account changes discard forms and cancel pending status checks, including a hung token lookup.

## Server connection

Client → AForce `POST /api/travel/flight-status` → TravelGate `POST /api/integrations/aforce/flight-status` → existing FlightAware loader.

The AForce session token stops at AForce. A separate integration credential authenticates the server-to-server request. No passenger, booking, health, Circle or subscription data crosses the bridge. The request contains only flight number, departure date and airports. This lookup does not link TravelGate accounts or import existing TravelGate trips.

AForce requires all of: explicit server enablement, genuine Clerk identity in every environment, and an allowlisted pilot account. Ordinary client flags/demo auth cannot grant server access. There is a five-checks-per-minute limit per authenticated pilot.

TravelGate requires explicit enablement and a dedicated 64-hex-character key; it authenticates before parsing a small request body and limits the integration to 60 checks per minute per IP. It reuses the existing flight loader's cache, deduplication, circuit breaker and global upstream budget. Existing user-authenticated routes retain their Clerk boundaries. The new machine route is mounted before global Clerk because it uses its own narrow service authentication.

Responses are private/no-store. The AForce bridge uses a fixed HTTPS endpoint, refuses redirects, limits response size and times out. Client calls also refuse redirects and time out. Detailed upstream errors and credentials are not sent to the user.

## Data truth

Both servers and the app validate a versioned Zod contract. Identical copies and an additive OpenAPI specification are checked into the two independent repositories. Existing generated clients were not regenerated or rewritten; this additive bridge uses its shared Zod validator directly.

A provider result must match the flight, both airports and the departure date in the provider-reported origin timezone. Missing/unverifiable timezone or mismatched legs are unavailable. This deliberately favors withholding a result over showing the wrong daily/multi-leg flight.

`fetchedAt` means time fetched from FlightAware, not proof that airport information is instantaneous. Results older than two minutes or returned with a loader cache warning are stale; implausibly future timestamps are rejected. Predicted “boarding soon” is mapped back to scheduled, never reported boarding. Provider estimates retain that label. Airline instructions remain authoritative.

## Access and configuration

The client `travel_mode_enabled` flag defaults false in normal and demo defaults. Enable Profile → Developer → “Travel · TravelGate pilot” only in development/internal TestFlight. Profile → Protocol Tools → All Modules → Travel opens the route. Public-build route and Home gates reject even a persisted true flag.

Server environment names, all currently left unconfigured by this work:

AForce:
- `AFORCE_TRAVEL_ENABLED=true`
- `AFORCE_TRAVEL_MEMBER_IDS`: comma-separated genuine AForce Clerk user IDs
- `TRAVELGATE_BRIDGE_KEY`: dedicated integration key
- Existing AForce Clerk/server and mobile API configuration

TravelGate:
- `AFORCE_BRIDGE_ENABLED=true`
- `AFORCE_BRIDGE_KEY`: same dedicated integration key, server-side only
- Existing FlightAware provider configuration

Provision the key through approved server secret configuration. Never put it in `EXPO_PUBLIC_*`, client bundles, source, chat or output artifacts. No secrets were read, generated for production, copied or changed. The fixed intended upstream endpoint is `https://api.travelgateapp.com/api/integrations/aforce/flight-status`; its deployment and behavior have not been verified live.

## Local storage

Native uses Expo SecureStore directly with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, no plaintext fallback. Web internal preview explicitly uses tab sessionStorage. Every repository operation requires an explicit owner; keys encode that owner without collisions. Same-account operations serialize. React Query caches include owner and flight identity. Storage failures/corruption are visible rather than silently overwritten.

Trips have no cloud sync. Provider status is held in the in-memory query cache; the manually entered itinerary persists offline. The device-data clear function is implemented and ready to reuse from a future whole-account deletion flow. The existing app deletion endpoint covers health data, so this work does not mislabel health deletion as account deletion. Whole-account deletion integration remains a release gate; sign-out retains the encrypted trip but cancels preparation reminders and clears retired account caches. No new data is shared to Circle, health providers or analytics; no scores are awarded or changed.

## Refreshed pilot verification - current bases

- Frozen-lockfile installs passed for both fresh worktrees with pnpm 11.1.2; lifecycle scripts were intentionally skipped.
- AForce mobile and both API typechecks passed, as did shared TypeScript reference builds and both API bundles.
- 91 AForce tests passed across 12 travel suites. 34 TravelGate tests passed across bridge, date and live-source governance suites.
- Four paired HTTP smoke tests passed against the fresh current-base source, using synthetic identity and provider fixtures.
- A test-helper body type was narrowed to string | object for current Supertest types; runtime integration code was unchanged by this refresh.
- Native/device validation, actual pilot identity, provider access and commercial-plan confirmation remain pending. These checks do not establish a complete release candidate.

## Earlier verification evidence

- Shared TypeScript references built; AForce mobile, AForce API and TravelGate API type checks passed.
- Both API bundles built successfully. Build tooling emitted large-bundle size notices.
- Earlier broader AForce targeted suite: 447 tests across 36 files, including reminders, device cleanup, native adapter mocks, account races and existing notification/copy-guard regressions.
- Mobile/API TypeScript checks passed on the refreshed current-main integration; its API bundle built successfully.
- TravelGate targeted suite: 21 tests across 3 files, including existing provider/date suites.
- Paired local HTTP smoke rerun against the current-main integration: 4 tests through the actual client status function and both real routers. Identity verification and provider responses are synthetic fixtures. It checks credential separation, anonymous rejection, stale-cache propagation and mismatched-leg rejection.
- DOM tests exercise manual journey persistence/account switching and status-panel explicit requests, unavailable/stale/failure states, local aging and account-switch cancellation.
- Existing storage-classification tests emit Expo native-module/API-base warnings in Node but pass. An intentional missing-auth configuration test emits the existing strict-auth diagnostic.
- The sandbox initially blocked local listening; after network permission was granted the HTTP suites and two-server smoke passed.

These checks do not establish live provider connectivity, deployed endpoint availability, production Clerk configuration, Keychain/Keystore device behavior, native navigation, notifications or signed-binary readiness. No production system was accessed by these tests.

## Remaining before release

1. Both patches apply cleanly to the current main revisions stated above. Replit confirms the Travel Gate app publishes at https://travelgatelive.com. Both it and https://api.travelgateapp.com answer /api/healthz with HTTP 200; Replit’s connected-domains and Publishing panels directly confirm both custom domains belong to the same app. The panel reports the current live publication as two months old; deployed Git revision remains unverified. Review the difference between live deployment and current source before republishing.
2. Completed: the separately approved startup repair is live in AForce production and Circle staging via PR #1135. Both deployments are online and return liveness HTTP 200. The original missing @opentelemetry/api crash is resolved.
3. Owner-approved configuration and deployment of both travel server changes, with dedicated secret provisioning and pilot cohort selection.
4. Verify real AForce authentication, authenticated lookup behavior and source freshness against actual provider data. Current TravelGate launch documentation still lists confirmation of its FlightAware commercial plan as open. Confirm that existing requirement before enabling the bridge. Recent main changes alter account/legal/storage behavior; older readiness findings are historical and must be re-verified before expanding existing-account flows.
5. Reuse the implemented device-data clear function from a true whole-account deletion flow when that flow exists; define cloud retention/deletion if cloud journeys are added.
6. Implement explicit TravelGate identity linking/import only if existing trips must be brought across. Never auto-match by email.
7. Device-test the implemented local preparation reminder and consent controls. Flight/gate change alerts, remote/background polling and automatic deduplication with other apps are not implemented. Existing-account import/linking remains separate work.
8. Complete physical-device tests for restart, offline behavior, account switch, secure-storage failure, navigation, provider failures and delay/cancellation cases.
9. Approve the exact native build before TestFlight upload or public release.

Travel integration remains local and unpublished. The separate startup repair was approved and released through PR #1135; see the release evidence below. No production database changes, travel configuration, or native uploads were performed.


## Current hosting observations — read-only, 2026-10-28

- AForce production and Circle staging run the approved startup repair revision. Both Railway deployments succeeded and both public /api/healthz endpoints returned HTTP 200. Exact evidence is in startup-repair-release-evidence.json.
- Replit reports Travel Gate app `06be0c19-f9bd-418b-97d9-b3ed90e38d5d` published successfully at https://travelgatelive.com, deployment `e532498b-2679-4d0f-91dd-422cbf57f184`.
- TravelGate's native production configuration points to https://api.travelgateapp.com. Both hosts resolved to 34.111.179.208 and independently answered /api/healthz HTTP 200. Replit’s connected-domains and Publishing panels also directly confirm both domains on the Travel Gate app. The UI reports the live publication as two months old; its exact deployed source revision is not verified.
- No Travel flags, production credentials, domains, authentication settings, or database values have been changed or accessed by this continuation. The Travel code remains local.

## Release-pack usage

The startup repair is already live. Apply only `aforce-travel-pilot.patch` against AForce revision `3c8ab782`, and `travelgate-pilot-bridge.patch` against TravelGate revision `7a21161`. Do not reapply the startup repair. Older cumulative patches are archived context and must not be applied on top of repaired main.

## Approved startup repair release - 2026-10-28

PR: https://github.com/brandburrell2026/AForce-Command/pull/1135
Merged revision: 5b55f8c9f3ba48f8cb850cfc27e072f5758a6490
Scope: four added lines across artifacts/api-server/package.json and pnpm-lock.yaml.
All required GitHub PR checks passed.
AForce production deployment: 2f5dbac3-73ce-4175-9324-a0c916e53358.
Circle staging deployment: 2d8388be-13c5-4c0c-b8ad-5bc1db64021d.
Both deployments succeeded from the merged revision. Each service is online with one running replica, zero crashed replicas, no pending work and no Railway warnings. Both public /api/healthz endpoints returned HTTP 200 with {"status":"ok"}. Required checks passed on both the PR and merged main revision. See startup-repair-release-evidence.json for deployment and verification details. Liveness does not establish authenticated app, database, provider, payment or physical-device readiness.
Travel integration is not included in this release; it remains gated off.


## Approved review scope

The owner approved creating two review PRs, one in brandburrell2026/AForce-Command and one in brandburrell2026/Travel-Gate. Keep the integration default-off, with no merge, deployment, secret, flag, database or native-release change in that action. TravelGate project instructions explicitly require owner approval before committing, pushing, merging or opening a PR. The subsequent owner continuation authorizes these review PRs; merge, production configuration, and deployment are outside this step.
