# Runbook — Apple HealthKit (Squad A)

**Last verified:** 2026-08-03
**Provider id:** `apple_health` (`lib/health-core/src/contracts.ts`)
**Flag:** `health_apple_enabled` (product gate) + `healthkit_native_enabled` (native
dependency gate) — both OFF in DEFAULT and DEMO flag sets today
(`artifacts/aforce-os/featureFlags/flags.ts`).
**Connect method:** `device_native`, iOS only, no external approval required.

## Prerequisites

- **Device:** a physical iPhone. HealthKit is unavailable in the iOS
  Simulator for real sensor data and permission-sheet behavior — simulator
  runs do not satisfy this runbook's evidence bar (`ACCEPTANCE-CRITERIA.md`
  criterion 1 requires a physical device).
- **Signing:** an Apple Developer account / provisioning profile capable of
  building with the HealthKit entitlement, and a build with
  `healthkit_native_enabled` on and the native HealthKit dependency
  installed.
- **Test Apple ID:** a test Apple ID signed into the device, distinct from
  any team member's personal Apple ID where feasible.
- **Health data:** the Health app should already contain representative
  data (sleep sessions, resting HR, HRV, at least one workout, step and
  active-energy history) before starting — either from real device sensors
  over a few days, or seeded via the Health app's manual entry / a
  companion watch. An empty Health app only exercises the "clean-empty"
  data-truthfulness case, not the full runbook.
- **Apple Watch (optional but recommended):** pairing a Watch materially
  improves HR/HRV/workout data richness and lets §5 exercise real
  sleep-stage data (`SleepSessionValue.stages`) rather than duration-only
  entries.

## Provider-specific hard rules (verbatim — check these explicitly)

- **Required metrics only.** AForce requests sleep duration, sleep stages
  where available, resting heart rate, HRV (SDNN), heart-rate observations,
  workouts, steps, and active energy **only where used**. Do not request
  unrelated HealthKit permissions (e.g. no request for reproductive health,
  nutrition, or other categories AForce does not consume) — see
  `HEALTH_PROVIDER_CAPABILITIES.apple_health.recordTypes` in
  `lib/health-core/src/contracts.ts` for the exact declared set.
- **HRV is SDNN, not RMSSD.** Apple's `HKQuantityTypeIdentifierHeartRateVariabilitySDNN`
  is true SDNN (`HRV_METHOD_BY_PROVIDER.apple_health === 'sdnn'` in
  `lib/health-core/src/normalize.ts`) — the only provider in this program
  where that's true. Never let Apple's HRV value be treated with the RMSSD
  translation used for every other provider.
- **"No readable data" is never confirmed permission denial.** iOS's
  HealthKit permission model deliberately does not tell an app whether a
  read permission was denied vs. granted-but-empty (Apple's own privacy
  design). An empty read result must be presented as "no data available,"
  never as "permission denied" — conflating the two is a truthfulness
  violation the presentation layer must not make.

## Step-by-step validation flow

1. Fresh-install (or reset via Settings → General → Transfer or Reset →
   Reset → Reset Location & Privacy, which clears HealthKit permission
   grants for the app) the build with `healthkit_native_enabled` and
   `health_apple_enabled` on.
2. Launch the app, navigate to Connected Health, initiate the Apple
   HealthKit connection.
3. Work through the Authorization test cases (below) using this fresh
   state, then the granted state for Sync and Data truthfulness.
4. With data flowing, exercise every Product surface listed below.
5. Exercise the Privacy/disconnect and deletion test cases last, since
   several are destructive to the connected state.
6. Capture an `EVIDENCE-TEMPLATE.md` packet covering everything exercised.

## §5 Test-case checklist

### Authorization
- [ ] **First connection** — permission sheet appears with exactly the
      declared categories (see hard rules above), user grants all, app
      transitions to `connected`.
- [ ] **Cancel** — user dismisses the permission sheet without choosing;
      app does not claim `connected`.
- [ ] **Partial approval** — user grants some categories, denies others
      (e.g. grants sleep, denies workouts); app presents `connected_limited`
      or equivalent, and only requests/reads the granted categories.
- [ ] **Deny all** — user denies every category; app presents
      `disconnected`/`unavailable`, never `connected`.
- [ ] **External revoke** — user later revokes HealthKit access for the app
      via iOS Settings → Privacy & Security → Health, outside the app; next
      app read reflects the revocation (no data, and the app does not claim
      a stale `connected` state).
- [ ] **Reconnect** — after a prior disconnect or revoke, user re-initiates
      the connection flow; new permission sheet (or updated grant) is
      requested correctly.
- [ ] **Expired token** — N/A for on-device HealthKit (no token to expire);
      record as N/A with reason in the evidence packet, don't skip silently.
- [ ] **Deleted provider app** — N/A; HealthKit is a system framework, not
      a separate app that can be deleted independently of iOS itself.
      Record as N/A with reason.
- [ ] **Unavailable native bridge** — simulate/verify behavior when the
      native HealthKit module isn't linked (e.g. `healthkit_native_enabled`
      off, or running on a build without the native dependency) — app must
      not crash, must present the feature as unavailable.

### Sync
- [ ] **First historical sync** — initial pull covers the expected backfill
      window (`maxBackfillDays: 30` per `HEALTH_PROVIDER_CAPABILITIES.apple_health`).
- [ ] **Incremental sync** — a later sync fetches only new records since
      the last sync, without re-ingesting the historical window.
- [ ] **Pagination** — if the historical window returns more records than
      one HealthKit query batch, verify all pages are collected, not just
      the first.
- [ ] **Interrupted sync** — force-quit or background the app mid-sync;
      verify no partial/corrupt state and that a subsequent sync recovers
      cleanly.
- [ ] **Retry** — simulate a transient read failure; verify a retry occurs
      and eventually succeeds or surfaces a clear error, not a silent hang.
- [ ] **Duplicated worker** — verify two concurrent sync triggers (e.g. app
      foreground + a background refresh both firing) don't double-ingest.
- [ ] **Background sync** — verify background refresh (if implemented)
      behaves correctly under iOS background execution limits.
- [ ] **Foreground sync** — verify manual/foreground-triggered sync works
      independent of background sync.
- [ ] **Account switching** — N/A in the traditional OAuth sense (HealthKit
      has no separate "account"), but verify behavior when the device's
      Apple ID / Health data owner changes (e.g. a different test Apple ID
      signs in) — data should reflect the current device's Health store,
      never a cached prior identity's data.
- [ ] **Reinstall** — uninstall and reinstall the app; verify the
      permission sheet re-appears (HealthKit permission is tied to the app
      installation) and sync resumes correctly from a clean local state.
- [ ] **Timezone change** — change device timezone mid-session; verify
      sleep-session and timestamp handling stays correct (`observedAt`
      stored as UTC ISO-8601 per `CanonicalHealthRecord`).
- [ ] **DST transition** — verify a sleep session spanning a DST transition
      is not double-counted or mis-durationed.

### Data truthfulness
- [ ] **Missing source** — a requested metric type has zero records in
      Health; verify it's presented as unavailable/no-data, not zero or
      fabricated.
- [ ] **Missing device** — no Watch/paired device for HR/HRV; verify
      graceful absence, not an error state.
- [ ] **Stale** — most recent record is >24h old; presentation shows
      `stale`, not `connected`/live (per `ProviderPresentationState`).
- [ ] **No recent data** — most recent record is >72h old; presentation
      shows `no_recent_data`.
- [ ] **Malformed record** — inject (via test harness / simulated HealthKit
      response) a record with a non-finite or missing required field;
      verify it's dropped, not passed through as corrupted canonical data.
- [ ] **Unknown HRV method** — N/A for Apple specifically since Apple's HRV
      type is always SDNN by construction; record as N/A with reason (this
      case matters more for aggregator-relayed records — see cross-provider
      matrix in `STAGE-LADDER.md` / Squad E).
- [ ] **RMSSD/SDNN conflict** — verify Apple's own HRV is never relabeled as
      RMSSD anywhere downstream (see hard rules above).
- [ ] **Duplicate provider record** — the same sleep session or workout
      appears twice in a HealthKit query (e.g. due to a sync retry); verify
      dedup by `externalId`/`deduplicationKey`.
- [ ] **Aggregator copy** — a record written by a different app (e.g. Oura,
      Garmin) that HealthKit re-exports to AForce; verify
      `provenanceChain`/native origin correctly attributes to the writing
      app (`NATIVE_ORIGIN_MAP` in `lib/health-core/src/dedupe.ts`), not to
      Apple.
- [ ] **Direct copy** — a record actually measured on-device/by-Watch;
      verify it's attributed to `apple_health` as origin, not
      `unknown_device_app`.
- [ ] **Clean-empty** — a brand-new test Apple ID with zero Health data;
      verify the app shows an honest empty state, not an error or
      fabricated placeholder values.
- [ ] **Score without valid attribution** — N/A: Apple HealthKit has no
      provider score (`providerScores: []`); record as N/A with reason.

### Privacy
- [ ] **Disconnect** — user disconnects Apple Health from Connected Health;
      verify the app stops reading and the presentation state changes to
      `disconnected`.
- [ ] **Failed revocation** — N/A in the OAuth-token sense (see below);
      record as N/A with reason — Apple provides no app-triggerable
      "revoke" call.
- [ ] **Unsupported revocation** — this IS the real case for Apple: the app
      cannot programmatically revoke HealthKit permission (only iOS
      Settings can). Verify the disconnect flow is honest about this — it
      stops the app from reading/using the data, but does not claim to
      have revoked the OS-level grant, and ideally directs the user to iOS
      Settings if full revocation is desired.
- [ ] **Token-store read failure** — N/A; no token store for on-device
      HealthKit. Record as N/A with reason.
- [ ] **Local cleanup failure** — simulate a failure while clearing locally
      cached HealthKit-derived data on disconnect; verify the app surfaces
      an honest error rather than silently claiming success.
- [ ] **Repeated deletion** — disconnect twice in a row (or delete account
      twice); verify idempotent, no crash, no duplicate cleanup side
      effects.
- [ ] **Account deletion** — full AForce account deletion; verify any
      locally cached Apple Health-derived canonical records/snapshot are
      removed.
- [ ] **Sibling preservation** — deleting the Apple Health connection (or
      the AForce account) does not affect a different provider's connected
      data (e.g. Oura stays connected and intact).
- [ ] **Stale snapshot removal** — disconnect removes the served
      `ProviderSnapshot` for `apple_health`, not just stops future syncs.
- [ ] **Unauthorized deletion attempt** — verify the disconnect/deletion
      action requires the authenticated user (no way to trigger it for
      another account).

### Product surfaces
- [ ] **Connected Health** — shows accurate `apple_health` state and last
      sync info.
- [ ] **Home** — any Home-surface content sourced from Apple Health data
      reflects the actual canonical record, not a cached/stale value.
- [ ] **Sleep** — sleep session, duration, and stages (if available) render
      correctly, honestly reflecting `stages: null` when Apple provided no
      stage breakdown.
- [ ] **Weekly** — weekly aggregate view reflects actual ingested data
      across the week, not a single day repeated.
- [ ] **Readiness** — Apple-derived HRV/RHR inform Readiness only, per
      Score-Protection; verify no Hydration Score impact.
- [ ] **Evidence Engine** — if Apple Health data feeds any Evidence Engine
      surface, verify correct attribution and no fabricated confidence.
- [ ] **a11y labels** — VoiceOver reads correct, current state labels for
      connected/disconnected/error/loading (not a generic "loading" stuck
      label).
- [ ] **Limited permissions** — with a `connected_limited` grant (partial
      approval case above), verify surfaces correctly show data for granted
      categories and honest absence for denied ones.
- [ ] **Offline** — app offline; verify Apple Health surfaces degrade
      gracefully (cached last-known state, not a crash or infinite spinner).
- [ ] **Loading** — verify a genuine loading state is shown during sync,
      distinct from empty/error states.
- [ ] **Retry** — user-triggered retry after a sync failure works and
      updates state correctly.
