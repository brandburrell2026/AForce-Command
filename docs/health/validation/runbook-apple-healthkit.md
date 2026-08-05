# Runbook — Apple HealthKit (Squad A)

**Last verified:** 2026-08-03
**Provider id:** `apple_health` (`lib/health-core/src/contracts.ts`)
**Flag:** `health_apple_enabled` (product gate) + `healthkit_native_enabled` (native
dependency gate) — both OFF in DEFAULT and DEMO flag sets today
(`artifacts/aforce-os/featureFlags/flags.ts`).
**Connect method:** `device_native`, iOS only, no external approval required.

> **Deviation register — Founder Ruling I (RC-2, part 2) is PARTIALLY
> satisfied at ship.** The ruling ("observation freshness and sync
> freshness must be displayed separately and truthfully") is fully
> implemented at the presentation layer (`resolveProviderPresentation`,
> `connectedHealthView.ts`, `ConnectedHealthView.tsx` all support dual-axis
> display) and fully fed for WHOOP/Oura/Garmin, each of which derives
> `ProviderSnapshot.latestObservedAtMs` server-side from its own payload.
> **`apple_health` and `samsung_health` (Health Connect) remain
> sync-recency-only at ship** — neither has a server-side derivation path
> for the observation axis (see "Known gaps" below). `apple_health` is
> client-wired and actively syncing, so this is a live gap today: its
> blob never populates the field and it falls back to the presentation
> layer's documented absent-field behavior. `samsung_health` has no client
> wiring at all yet (`healthConnect/sync.ts`, per
> `runbook-health-connect-samsung.md`), so the same absence applies only
> trivially today — but the underlying gap (no observation-axis
> derivation) is real and would surface the identical sync-recency-only
> behavior the moment client wiring lands, so it is disclosed here
> alongside Apple's rather than deferred. Both are one disclosed, named
> engineering gap (owner: react-native-engineer; trigger: Track A device
> work), not a product-policy exception — do not read "Ruling I done" from
> the presentation layer's dual-axis capability alone; two of the four
> active providers do not yet feed it a second axis. The
> same line appears in `docs/health/rollout/
> RC2-RULING-A-INTERNAL-TESTFLIGHT-OVERLAY.md` so this status is visible
> from either doc.

## CRITICAL — which code path this runbook validates

There are TWO Apple HealthKit modules in this codebase. They are not
interchangeable, and every Sync checkbox below must be judged against the
first one, not the second:

- **`artifacts/aforce-os/services/appleHealth.ts`** — the WIRED path. This
  is what `createAppleHealthConnection`
  (`artifacts/aforce-os/services/healthConnection.bindings.ts:26-33`) binds
  to the Connected Health screen. It requests a fixed permission set,
  re-queries fixed windows on every call (no persisted anchor/cursor), and
  returns four plain numbers — no `CanonicalHealthRecord`, no provenance
  chain, no dedup key, no per-record `observedAt`.
- **`artifacts/aforce-os/services/health/appleHealthSync.ts`** — the
  UNWIRED anchored-query engine. Its own header states plainly: "RUNTIME
  ACTIVATION STAYS OFF... not imported by any screen, store, or flag-gated
  bridge." Verified: this file has zero non-test importers anywhere in the
  repo (`git grep -n runAppleHealthSync` / `appleHealthSync` outside
  `__tests__/` returns only the file itself). It produces
  `CanonicalHealthRecord[]` with real anchors, provenance, `observedAt`,
  and sleep stages — none of which the shipped build can produce today.

If a checkbox below describes anchor persistence, provenance chains,
`observedAt`, sleep stages, or a dedup key, it is describing
`appleHealthSync.ts`'s output shape, not what a device validation run
against the current app will ever see. Those checkboxes are marked
**"engine-level"** below — they are exercised by that module's own unit
suite (`appleHealthSync.test.ts`), not by this runbook, and their absence
from real-device evidence is not a FAIL.

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

- **Required metrics only — but the WIRED request set is narrower than the
  DECLARED set, and that is expected, not a bug.** The actual
  `requestAuthorization` call (`appleHealth.ts:83-98`) requests exactly:
  `HKQuantityTypeIdentifierHeartRate`,
  `HKQuantityTypeIdentifierRestingHeartRate`,
  `HKQuantityTypeIdentifierHeartRateVariabilitySDNN`,
  `HKQuantityTypeIdentifierStepCount`,
  `HKCategoryTypeIdentifierSleepAnalysis`, `HKWorkoutTypeIdentifier` to
  READ, and `toShare: []` — **no write scope at all.**
  `HEALTH_PROVIDER_CAPABILITIES.apple_health.recordTypes`
  (`lib/health-core/src/contracts.ts`) additionally declares
  `active_energy` and `respiratory_rate` — NEITHER is requested by the
  wired path. Verify the permission sheet shows exactly the six read
  categories above and **no write/share grant of any kind** (never
  reproductive health, nutrition, or anything else outside this list) —
  active energy/respiratory absence is the declared set getting ahead of
  the implementation, not a leak; do not fail on it.
  **RULING H (RC-2, resolved):** the authorization request previously also
  asked for `HKQuantityTypeIdentifierDietaryWater` to SHARE (write) — an
  UNUSED write scope, over-collection with no shipped feature behind it.
  `git grep` for `DietaryWater` across the non-test codebase now returns
  only the historical note in `appleHealth.ts`'s comment explaining why the
  scope was removed — no live reference to it as a requested scope remains
  anywhere. The founder-decision memo that was open on this (remove the
  scope vs. ship the write feature) is resolved as **REMOVE** —
  `toShare` is now the empty-array literal, locked by
  `services/__tests__/appleHealth.healthKitScopes.test.ts`. Do not expect
  or describe a WRITE grant in the permission sheet for this provider; if
  one ever reappears, that is a regression, not an intentional feature.
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
- **`healthkit_native_enabled` is a compile-time constant, not a runtime
  flag.** `appleHealth.ts` imports it directly from `DEFAULT_FLAGS`
  (`featureFlags/flags.ts:286,481` — both `false`), a plain object literal
  bundled at build time; `isAppleHealthSupported()` and `loadHealthKit()`
  both gate on it (`appleHealth.ts:44,63`). "Flip the flag for this test
  build" (Prerequisites, above) means cutting a new build with the constant
  changed and the native dependency linked — it cannot be toggled
  server-side or via a remote-config flip against a build already
  installed on the test device.

## Known gaps

> **Build-43 lesson (2026-08-05):** Apple's upload validator requires
> `NSHealthUpdateUsageDescription` to EXIST whenever the HealthKit framework
> is linked — independent of runtime write scopes. The key is present with a
> truthful "does not currently write" string (pinned by the healthKitScopes
> lock). The REAL write-scope check for validators is unchanged: the
> permission sheet must show NO write/share toggles (toShare is empty).
 — read before scoring Sync / Data truthfulness

These are verified facts about the shipped code, not open questions. A
checkbox below that appears to fail ONLY because it observed one of these
gaps is a false FAIL — do not fail the run on it; record the gap as
already-known and move on.

- **Observation-freshness axis (Founder Ruling I, RC-2) is unwired for
  Apple Health specifically — a named, owned engineering gap, not a
  phantom ticket.** `ProviderSnapshot.latestObservedAtMs`
  (`lib/health-core/src/contracts.ts`, RC-2 part 1, #562) is derived
  server-side for WHOOP/Oura/Garmin from each provider's own payload
  timestamps. HealthKit sync is client-only
  (`artifacts/aforce-os/services/appleHealth.ts` /
  `artifacts/aforce-os/services/health/appleHealthSync.ts`) — no
  api-server derivation path touches it, so `apple_health` blobs never
  populate the field today; `resolveProviderPresentation` correctly falls
  back to sync-recency-only, exactly its documented absent-field parity
  contract (see the Stale checkbox below). `samsung_health` / Health
  Connect shares the identical gap for a different reason today — it has
  no client wiring at all yet (`healthConnect/sync.ts`, see
  `runbook-health-connect-samsung.md`'s own "Known gaps"), so its absence
  is currently moot rather than live, but the same fix (an
  api-server-side observation-axis derivation) would be needed the moment
  that wiring lands, so it is disclosed alongside Apple's rather than
  deferred to a later surprise.
  - **Owner:** react-native-engineer (the client owns
    `appleHealth.ts`/`appleHealthSync.ts` and the `CanonicalHealthRecord
    .observedAt` value that a fix would read from — the engine-level path
    already produces it, per the framing note at the top of this file).
  - **Trigger:** Track A device work — wiring this is in scope once Apple
    HealthKit moves off `appleHealth.ts` (the WIRED four-number path) and
    onto the anchored `appleHealthSync.ts` engine as part of bringing that
    engine's device-validated output onto the shipped surface. It is not
    scheduled independently of that migration.
  - **Also registered:** the provider's row in `STAGE-LADDER.md`'s "User-
    facing display" column ("presentation logic tested against mocks
    only") reflects the same not-yet-device-verified state this gap
    describes; this bullet is the fuller, owner/trigger-bearing record —
    STAGE-LADDER.md's table format has no per-gap owner/trigger columns,
    so it is intentionally not duplicated there beyond the existing rung
    status.

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
- [ ] **First connection** — permission sheet appears with exactly the six
      requested READ categories plus the one WRITE category (see hard rules
      above — NOT the full declared `recordTypes` list; active energy and
      respiratory rate are correctly absent), user grants all, app
      transitions to `connected`.
- [ ] **Cancel** — user dismisses the permission sheet without choosing;
      app does not claim `connected`.
- [ ] **Partial approval** — N/A BY PLATFORM DESIGN, not an untested case.
      `deriveProviderRowStatus` (`artifacts/aforce-os/utils/health/providerRowStatus.ts:134-137`)
      sets `apple_health`'s `link` to `'connected'` or `'none'` ONLY — there
      is no code path that produces a `'partial'` link for Apple, which
      composes to `connected_limited` never appearing for this provider.
      This is consistent with this file's own hard rule (HealthKit cannot
      tell the app whether a category was denied vs. granted-but-empty, so
      the app cannot honestly render a "these categories granted, those
      denied" state in the first place). Record as N/A with this reason,
      not as "not exercised this cycle."
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
- [ ] **First sync** — `contracts.ts`'s declared `sync: 'push_from_device'`
      for `apple_health` means there is no server-side "initial pull" at
      all; verify what the WIRED path (`appleHealth.ts`) actually does on
      first connect: resting HR and HRV each read the single most recent
      sample with no start bound (`queryQuantitySamples(..., {limit: 1,
      filter: {date: {startDate: new Date(0), endDate: now}}})`,
      `appleHealth.ts:124-133`); steps reads midnight-to-now for the local
      day (`appleHealth.ts:143-149`); sleep reads the trailing 18 hours
      (`appleHealth.ts:157-162`). None of this is a 30-day backfill —
      `maxBackfillDays: 30` in `HEALTH_PROVIDER_CAPABILITIES.apple_health`
      is a DECLARED CAPABILITY not implemented by this path; its absence in
      observed behavior is not a validation failure.
- [ ] **Incremental sync** — verify a later sync RE-QUERIES the same fixed
      windows above from scratch (midnight-to-now for steps, trailing-18h
      for sleep, most-recent-sample for RHR/HRV) rather than resuming from
      an anchor. There is no persisted anchor token anywhere in
      `appleHealth.ts` — every call recomputes `startOfDay` /
      `lastNightStart` off `new Date()`. (The anchored-token engine that
      WOULD make this genuinely incremental is `appleHealthSync.ts` —
      engine-level, see the framing note at the top of this file; not
      reachable from the shipped build.)
- [ ] **Pagination** — single unpaged queries: RHR/HRV use `limit: 1`
      (most-recent-sample only); steps/sleep use `limit: 0` (HealthKit's
      "return everything in the date filter," not a page size) with no loop
      over multiple batches. Verify no pagination is attempted — a query
      that silently truncated a large step/sleep result set would be the
      actual bug to watch for, not the absence of a page-2 request.
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
- [ ] **Timezone change** — change device timezone mid-session; verify the
      WIRED path's window math (`startOfDay`/`lastNightStart`, both derived
      from device-local `new Date()`, `appleHealth.ts:110-113`) doesn't
      shift or double-count a day when the local clock jumps. NOTE:
      `observedAt` as UTC ISO-8601 is a `CanonicalHealthRecord` field
      (`lib/health-core/src/contracts.ts`) — engine-level
      (`appleHealthSync.ts`/`appleHealthRecords.ts`), not something the
      wired path stamps on anything; do not expect to observe it here.
- [ ] **DST transition** — verify a sleep session spanning a DST transition
      is not double-counted or mis-durationed.

### Data truthfulness
- [ ] **Missing source** — a requested metric type has zero records in
      Health; verify it's presented as unavailable/no-data, not zero or
      fabricated.
- [ ] **Missing device** — no Watch/paired device for HR/HRV; verify
      graceful absence, not an error state.
- [ ] **Stale** — verify `stale` appears when `now - fetchedAt` (the last
      successful sync's timestamp) exceeds 24h. **The product question this
      used to flag as PENDING is now RULED (Founder Ruling I, RC-2):
      "observation freshness and sync freshness must be displayed
      separately and truthfully" — sync-recency-only display is NOT the
      accepted long-term behavior.** What remains open for Apple
      specifically is an ENGINEERING gap, not a product-policy one:
      `ProviderSnapshot.latestObservedAtMs` (`lib/health-core/src/contracts.ts`,
      RC-2 part 1, #562) is wired server-side for WHOOP/Oura/Garmin (each
      derives it from that provider's own payload timestamps), but
      HealthKit sync is client-only (`appleHealth.ts`/`appleHealthSync.ts`)
      — no api-server derivation path touches it, so `apple_health` blobs
      do not populate the field today. `resolveProviderPresentation`
      (`artifacts/aforce-os/services/health/providerPresentation.ts`, RC-2
      part 2, this branch) already knows how to consume it — an absent
      field is its documented, tested parity contract, not a missing
      feature — so Apple Health correctly falls back to sync-recency-only
      exactly as every other provider does when the field is absent. A
      5-day-old resting-HR sample synced 10 minutes ago still presents as
      fresh/live for Apple specifically, pending a follow-up pass that
      wires an observation timestamp from `CanonicalHealthRecord.observedAt`
      (which the engine-level HealthKit path already produces, per the note
      below) onto the `apple_health` snapshot blob. Do not fail this
      checkbox over that gap — it is a named, owned follow-up (see "Known
      gaps" above: owner react-native-engineer, trigger Track A device
      work), not a regression.
- [ ] **No recent data** — same `fetchedAt`-based age exceeding 72h shows
      `no_recent_data`. Same sync-recency caveat as Stale applies.
- [ ] **Malformed record** — inject (via test harness / simulated HealthKit
      response) a record with a non-finite or missing required field;
      verify it's dropped, not passed through as corrupted canonical data.
- [ ] **Unknown HRV method** — N/A for Apple specifically since Apple's HRV
      type is always SDNN by construction; record as N/A with reason (this
      case matters more for aggregator-relayed records — see cross-provider
      matrix in `STAGE-LADDER.md` / Squad E).
- [ ] **RMSSD/SDNN conflict** — verify Apple's own HRV is never relabeled as
      RMSSD anywhere downstream (see hard rules above).
- [ ] **Duplicate provider record** — ENGINE-LEVEL, not observable in the
      shipped build. `externalId`/`deduplicationKey` are
      `CanonicalHealthRecord` fields the WIRED path never produces —
      `appleHealth.ts` returns four aggregate numbers (latest sample /
      day-sum), not a list of identifiable records. Per-record dedup only
      exists in the unwired `appleHealthSync.ts` + `appleHealthRecords.ts`
      pipeline (zero non-test callers — see framing note at top of file),
      exercised by `appleHealthSync.test.ts`. Do not fail this checkbox for
      the shipped build's absence of a dedup key; record as N/A with this
      reason.
- [ ] **Aggregator copy** — ENGINE-LEVEL, not observable in the shipped
      build, for the same reason: `provenanceChain` / `NATIVE_ORIGIN_MAP`
      attribution (`lib/health-core/src/dedupe.ts`) is a
      `CanonicalHealthRecord` concept the wired path never constructs.
      Exercised by `appleHealthRecords.test.ts` / `appleHealthSync.test.ts`
      unit suites. Record as N/A with this reason.
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
- [ ] **Sleep** — the WIRED path renders `sleepHoursLastNight` as a single
      trailing-18h duration figure (`appleHealth.ts:157-176`) — there is no
      stage breakdown on this path at all (no `SleepSessionValue.stages`
      field is ever populated; that structured type belongs to
      `CanonicalHealthRecord`, engine-level per the framing note above).
      Verify the duration figure itself renders correctly; do NOT expect a
      stages UI to appear or fail this checkbox for `stages` being absent —
      there is no shipped code path that could produce it today.
- [ ] **Weekly** — weekly aggregate view reflects actual ingested data
      across the week, not a single day repeated.
- [ ] **Readiness** — Apple-derived HRV/RHR inform Readiness only, per
      Score-Protection; verify no Hydration Score impact.
- [ ] **Evidence Engine** — if Apple Health data feeds any Evidence Engine
      surface, verify correct attribution and no fabricated confidence.
- [ ] **a11y labels** — VoiceOver reads correct, current state labels for
      connected/disconnected/error/loading (not a generic "loading" stuck
      label).
- [ ] **Limited permissions** — N/A BY PLATFORM DESIGN (see "Partial
      approval" under Authorization above): `connected_limited` is
      unreachable for `apple_health`, so there is no partial-grant product
      surface to exercise. Record as N/A with this reason.
- [ ] **Offline** — app offline; verify Apple Health surfaces degrade
      gracefully (cached last-known state, not a crash or infinite spinner).
- [ ] **Loading** — verify a genuine loading state is shown during sync,
      distinct from empty/error states.
- [ ] **Retry** — user-triggered retry after a sync failure works and
      updates state correctly.
