# Runbook — Android Health Connect / Samsung Health (Squad B)

**Last verified:** 2026-08-03
**Provider ids:** `google_health` (Health Connect as platform aggregator) and
`samsung_health` (upstream origin, arrives only through Health Connect) —
`lib/health-core/src/contracts.ts`.
**Flags:** `health_google_connect_enabled` (Health Connect) and
`health_samsung_direct_enabled` (gates a hypothetical future direct-SDK path
only — see hard rules) — both OFF today.
**Connect method:** `device_native` for Health Connect (Android only);
`samsung_health` is declared `via_health_connect`, `requiresExternalApproval: true`.

## EXECUTION STATUS — this runbook is not currently executable end-to-end

Verified against the shipped code, not a projection: **neither
`google_health` nor `samsung_health` has a client-side connect path today.**

- `deriveProviderRowStatus`
  (`artifacts/aforce-os/utils/health/providerRowStatus.ts:130-133`) hardcodes
  `integrationReady = false` for `google_health` unconditionally — there is
  no code path that flips it to `true`.
- There is no `createGoogleHealthConnection` (or equivalent) anywhere in
  `artifacts/aforce-os/services/healthConnection.bindings.ts` — only
  `createAppleHealthConnection` and `createSamsungHealthConnection` (the
  latter binds to `samsungHealth.ts`, the DIRECT partner-SDK path gated by
  `health_samsung_direct_enabled`, which is a DIFFERENT lane from
  "Samsung-via-Health-Connect" — see the hard rule above about never
  conflating them). The Health Connect PERMISSION REQUEST flow itself has no
  client entry point to trigger it.
- The api-server has ZERO routes referencing `google_health` or
  `samsung_health` (grepped — no matches under `artifacts/api-server/src`).
  These are exclusively device-native/client concepts today, and the client
  side isn't wired either.
- The real engine this runbook describes —
  `artifacts/aforce-os/services/health/healthConnect/sync.ts`'s
  `runHealthConnectSync` — has zero non-test callers (`git grep` for
  `runHealthConnectSync` outside `__tests__/` returns only its own
  definition). It is real, tested code with no caller.

**What this means for every section below:** every Authorization/Sync/
Product-surface step that requires an actual on-device permission flow or
live sync is currently **BLOCKED PENDING CLIENT WIRING**, not "not yet
run" — do not attempt to force a device run past this point and record a
FAIL for it; record the block with this reason instead. The only CURRENT
evidence for this program is the engine-level unit suite
(`healthConnect/__tests__/sync.test.ts`, `permissions.test.ts`,
`mapRecords.test.ts`, `availability.test.ts`), which exercises the sync
engine's logic in isolation, not the product. Data-truthfulness and
Privacy sections below describe what the ENGINE does when it is
eventually wired — capture them as engine-level facts, not device
observations, until the wiring work lands.

## Prerequisites

- **Device:** a physical Android phone with Health Connect installed
  (bundled on Android 14+, installable from Play Store on earlier
  supported versions). Android emulator runs do not satisfy this runbook's
  evidence bar (`ACCEPTANCE-CRITERIA.md` criterion 1).
- **Android version and Health Connect version:** recorded per
  `DEVICE-INVENTORY-TEMPLATE.md` — behavior has shifted across Health
  Connect versions (e.g. its integration into Settings on newer Android),
  so the exact version matters for reproducing a result later.
- **Google Play services:** current version, since Health Connect depends
  on it.
- **Samsung device (for the Samsung-specific cases):** a Galaxy phone (or a
  Samsung Health-capable device) with the Samsung Health app installed and
  Health Connect sync enabled in Samsung Health's own settings — this is
  the mechanism by which Samsung Health data reaches Health Connect at all.
- **Samsung wearable (recommended):** a Galaxy Watch or Galaxy Ring paired
  to Samsung Health, to generate real sleep/HR/HRV data for Samsung's
  upstream-origin test cases.

## Provider-specific hard rules (verbatim — check these explicitly)

- **Samsung must ALWAYS be represented as "Samsung Health via Health
  Connect," never a direct connection.** `HEALTH_PROVIDER_CAPABILITIES.samsung_health.method`
  is `via_health_connect` and its `activationGates` explicitly state
  "arrives as upstream origin via Health Connect (no direct claim)." Any
  UI copy, log message, or evidence packet that implies AForce connects
  directly to Samsung Health (a "Samsung" button separate from Health
  Connect, a claim of a Samsung API integration) is a hard-rule violation —
  fail the run, don't just note it, if this appears anywhere.
- **No Google Fit.** Google Fit is deprecated in favor of Health Connect;
  AForce's Android provider is Health Connect, full stop. If any code path,
  test, or evidence artifact references Google Fit as the integration
  target, that's a red flag to investigate, not something to route around
  silently.
- **HRV via Health Connect/Samsung is RMSSD, not SDNN.** Both
  `google_health` and `samsung_health` map to `hrvMethod: 'rmssd'` in
  `HRV_METHOD_BY_PROVIDER` (`lib/health-core/src/normalize.ts`) — Health
  Connect's `HeartRateVariabilityRmssdRecord` and Samsung's underlying HRV
  measurement are both RMSSD-family. Never let this be presented as SDNN.
- **CROSS-REFERENCE WARNING — contracts.ts/normalize.ts disagree on
  Samsung's HRV method; do not let this create a false FAIL.**
  `lib/health-core/src/contracts.ts:112`'s
  `HEALTH_PROVIDER_CAPABILITIES.samsung_health.hrvMethod` is `null`
  (Samsung's declared `recordTypes` doesn't even include `hrv`), while
  `lib/health-core/src/normalize.ts:50`'s `HRV_METHOD_BY_PROVIDER.samsung_health`
  is `'rmssd'`. This is a genuine cross-file inconsistency pending a
  code-side alignment (flagged here, not fixed — this PR is docs-only). If
  a validator observes a Samsung-origin HRV record, note which resolver
  path produced it and don't fail the run over which of the two
  disagreeing declarations "should" have applied.

## Known gaps — read before scoring Sync / Data truthfulness (engine-level; applies once client wiring lands)

- **Freshness measures sync recency, not observation recency.**
  `resolveProviderPresentation` (`artifacts/aforce-os/services/health/providerPresentation.ts:79-92`)
  computes `age = nowMs - latestFetchedAtMs`, where `latestFetchedAtMs` is
  the snapshot's write time, not a per-record observation timestamp.
  `ProviderSnapshot` (`lib/health-core/src/contracts.ts`) carries only
  `fetchedAt`. This is the SAME class of gap documented in the Oura/WHOOP/
  Apple runbooks — it is not specific to Health Connect. Observation-time
  freshness (`CanonicalHealthRecord.observedAt`) exists only on the
  canonical-record plane, which is what `healthConnect/sync.ts` actually
  produces (unlike Oura/WHOOP/wired-Apple) — so once this engine is wired,
  Health Connect/Samsung would be the FIRST provider capable of true
  observation-time freshness. Until wiring lands, there is no shipped path
  at all to observe freshness against for these two providers.
- **No 30-day (or any) bound on the record read.**
  `sync.ts:388`'s `fullRead()` calls
  `client.readRecords<unknown>(config.hcRecordType, {})` — an empty options
  object, no `timeRangeFilter`. `maxBackfillDays: 30` in `contracts.ts` is a
  DECLARED CAPABILITY, not implemented by this read.
- **No pagination.** `HealthConnectClient.readRecords`
  (`healthConnect/types.ts:159`) has no `pageToken` parameter in its
  interface, and `sync.ts` has no loop calling it more than once per type.
  A device with enough records to need Health Connect's real paging API
  would silently only get the first page — this is a genuine open question
  for H5 (the native-wiring lane), not something to test-and-pass here.

## Step-by-step validation flow

1. Fresh-install the build with `health_google_connect_enabled` on. Ensure
   Health Connect has some data present (from the phone's own sensors,
   Samsung Health synced in, or manually entered) before starting the
   full-data cases.
2. Launch the app, navigate to Connected Health, initiate the Health
   Connect permission flow.
3. Work through Authorization test cases using a fresh grant, then Sync and
   Data truthfulness with data flowing.
4. Specifically verify the Samsung-as-upstream-origin path: with Samsung
   Health installed and syncing into Health Connect, confirm records
   attributed to Samsung Health show the correct native origin
   (`com.sec.android.app.shealth` per `NATIVE_ORIGIN_MAP`) and are
   presented as "via Health Connect."
5. Exercise Product surfaces with the connected state.
6. Exercise Privacy/disconnect and deletion cases last.
7. Capture an `EVIDENCE-TEMPLATE.md` packet — for the Samsung-specific hard
   rule, explicitly screenshot the UI language used and confirm it never
   says "connected to Samsung Health" as a standalone claim.

## §5 Test-case checklist

### Authorization
- [ ] **First connection** — BLOCKED PENDING CLIENT WIRING (see execution
      status above) — record as such rather than attempting a device run.
      For when wiring lands: the permission screen should request exactly
      `google_health`'s full declared set — sleep, resting HR, HRV, HR
      summary, workout, steps, active energy, **and respiratory rate**
      (`contracts.ts:103-108`'s `recordTypes` includes `respiratory_rate`;
      `permissions.ts:37-47` maps it to
      `android.permission.health.READ_RESPIRATORY_RATE` — don't drop it
      from the expected list). Samsung's narrower `recordTypes`
      (`contracts.ts:109-114`) correctly excludes both HRV and respiratory
      rate.
- [ ] **Cancel** — user backs out of the Health Connect permission screen;
      app does not claim `connected`.
- [ ] **Partial approval** — user grants some record types, denies others;
      app presents `connected_limited`, reads only granted types.
- [ ] **Deny all** — app presents `disconnected`/`unavailable`.
- [ ] **External revoke** — user revokes AForce's Health Connect
      permissions via Health Connect's own settings UI (not inside AForce);
      next read reflects the revocation honestly.
- [ ] **Reconnect** — re-initiate after a prior disconnect/revoke; correct
      permission re-request.
- [ ] **Expired token** — N/A for on-device Health Connect (no token to
      expire); record as N/A with reason.
- [ ] **Deleted provider app** — verify behavior if Samsung Health (the
      upstream app) is uninstalled: Health Connect connection to AForce
      should remain intact, but Samsung-originated data stops updating —
      presented as stale/no-recent-data for that origin, not an app crash.
- [ ] **Unavailable native bridge** — verify behavior when Health Connect
      itself is not installed on the device (older Android without it
      installed from Play Store) — app must not crash, must present the
      feature as unavailable with guidance, not a silent no-op.

### Sync
- [ ] **First sync** — ENGINE-LEVEL until client wiring lands (see execution
      status above). Verified fact about `healthConnect/sync.ts`'s
      `fullRead()`: it calls `readRecords(type, {})` with no
      `timeRangeFilter` (`sync.ts:388`) — there is no 30-day (or any) bound
      implemented today, despite `maxBackfillDays: 30` being declared in
      `contracts.ts`. Record this as the engine's current behavior, not as
      a device observation.
- [ ] **Incremental sync** — ENGINE-LEVEL. `sync.ts` DOES implement real
      changes-token incremental sync (`getChangesToken`/`getChanges`, see
      the module's own "CHANGES-TOKEN MODEL" doc comment) — this is the
      one provider where the engine's incremental design is genuinely more
      complete than Oura/WHOOP/Apple's fixed-window re-fetch. It cannot be
      exercised on a real device today because nothing calls it.
- [ ] **Pagination** — ENGINE-LEVEL, and a genuine open gap once wired:
      `HealthConnectClient.readRecords`'s interface
      (`healthConnect/types.ts:159`) has no `pageToken` parameter, and
      `sync.ts` never loops a type's read more than once. A real account
      with more records than Health Connect's page size would silently see
      only the first page — flag this for H5 (native wiring) to verify
      against the real SDK, don't attempt to test it on a device today.
- [ ] **Interrupted sync** — force-quit/background mid-sync; verify clean
      recovery on next sync.
- [ ] **Retry** — transient read failure triggers retry or clear error.
- [ ] **Duplicated worker** — two concurrent sync triggers don't
      double-ingest.
- [ ] **Background sync** — Android background execution constraints
      (Doze, background restrictions) don't silently break sync.
- [ ] **Foreground sync** — manual/foreground sync works independently.
- [ ] **Account switching** — verify behavior when the device's Samsung
      account or Google account changes; data should reflect the current
      device's Health Connect store, not a cached prior identity.
- [ ] **Reinstall** — uninstall/reinstall AForce; verify permission
      re-request and clean resync (Health Connect permission grants may
      persist independent of the requesting app's install state on some
      Android versions — verify and record actual observed behavior rather
      than assuming iOS-like behavior).
- [ ] **Timezone change** — verify timestamp handling stays correct across
      a timezone change mid-session.
- [ ] **DST transition** — verify a sleep session spanning DST isn't
      double-counted or mis-durationed.

### Data truthfulness
- [ ] **Missing source** — a requested metric type has zero records; shown
      as unavailable, not zero/fabricated.
- [ ] **Missing device** — no wearable paired for HR/HRV; graceful absence.
- [ ] **Stale** — BLOCKED PENDING CLIENT WIRING for a device observation.
      For when wiring lands: `stale` triggers on `now - fetchedAt`
      (snapshot write time) exceeding 24h — see the freshness known gap
      above. This is the sync-recency caveat shared with every other
      provider on the snapshot plane; Health Connect/Samsung's
      canonical-record path is the one that COULD carry true
      observation-time freshness once wired (see known gap above), but the
      snapshot-plane presentation logic reviewed here does not use it.
- [ ] **No recent data** — same `fetchedAt`-based age exceeding 72h;
      same caveat as Stale.
- [ ] **Malformed record** — a record missing a required field or with a
      non-finite value is dropped, not passed through.
- [ ] **Unknown HRV method** — verify any HRV record whose origin can't be
      confidently mapped is never defaulted to a specific method silently;
      confirm the explicit-per-provider translation table
      (`HRV_METHOD_BY_PROVIDER`) is what governs, not a guess.
- [ ] **RMSSD/SDNN conflict** — verify Health Connect/Samsung HRV is never
      presented as SDNN (see hard rules above) — this is the single most
      important data-truthfulness case for this runbook.
- [ ] **Duplicate provider record** — ENGINE-LEVEL, not observable on a
      device today (see execution status above), but unlike Oura/WHOOP this
      one IS genuinely implemented: `mapRecords.ts` stamps every record with
      `externalId`/`deduplicationKey` via `buildDeduplicationKey`, and
      `sync.ts`'s own doc comment confirms a re-delivered record (full-read
      after changes-token expiry) is safe because the key is identical
      whichever path produced it. Exercised by
      `healthConnect/__tests__/sync.test.ts` and `mapRecords.test.ts`; not
      reachable from the shipped build until client wiring lands.
- [ ] **Aggregator copy** — Samsung Health's data as it arrives via Health
      Connect is itself the "aggregator copy" case for this runbook — verify
      `provenanceChain` attributes to `samsung_health` (native origin
      `com.sec.android.app.shealth`), not to `google_health` (Health
      Connect is the transport, not the origin).
- [ ] **Direct copy** — a record actually measured by the phone/device
      itself via Health Connect's own native sensors (not relayed from
      Samsung Health or another app); verify attribution to `google_health`
      as origin.
- [ ] **Clean-empty** — brand-new device/account with zero Health Connect
      data; honest empty state.
- [ ] **Score without valid attribution** — N/A: neither `google_health`
      nor `samsung_health` has a `providerScores` entry; record as N/A with
      reason.

### Privacy
- [ ] **Disconnect** — BLOCKED PENDING CLIENT WIRING (no connect path
      exists to disconnect from — see execution status above). NOTE FOR
      WHEN WIRED: there is no server-side disconnector for either provider
      today — `buildProviderDisconnectors`'s registry
      (`artifacts/api-server/src/routes/index.ts:123`) is typed
      `Record<"whoop" | "garmin" | "oura" | "strava", ...>` and the
      api-server has zero routes referencing `google_health` or
      `samsung_health` at all. Any future "disconnect" for these providers
      is necessarily a local/OS-level action (Health Connect's own
      permission settings), never a cloud token revocation — don't write or
      accept evidence implying otherwise.
- [ ] **Failed revocation** — N/A in the OAuth sense; record as N/A with
      reason (Health Connect permissions are OS-managed, not app-revocable
      programmatically).
- [ ] **Unsupported revocation** — verify the disconnect flow is honest
      that full revocation happens in Health Connect's own settings, not
      claimed as done by the AForce disconnect button alone. Samsung
      specifically has NO disconnect affordance of its own to test: it is
      never independently connectable (arrives only as an upstream origin
      through Health Connect, per the hard rule above), so there is nothing
      Samsung-specific to disconnect separate from the Health Connect
      permission itself.
- [ ] **Token-store read failure** — N/A; no token store for on-device
      Health Connect. Record as N/A with reason.
- [ ] **Local cleanup failure** — simulate a failure clearing locally
      cached data; verify honest error surfacing.
- [ ] **Repeated deletion** — disconnect/delete twice; idempotent, no
      crash.
- [ ] **Account deletion** — full AForce account deletion removes locally
      cached Health Connect/Samsung-derived canonical records/snapshot.
- [ ] **Sibling preservation** — deleting this connection doesn't affect
      other connected providers (e.g. Oura stays intact).
- [ ] **Stale snapshot removal** — disconnect removes the served snapshot
      for both `google_health` and `samsung_health` origins, not just stops
      future syncs.
- [ ] **Unauthorized deletion attempt** — disconnect/deletion requires the
      authenticated user.

### Product surfaces
- [ ] **Connected Health** — shows accurate state for both `google_health`
      and (where applicable) the Samsung-origin data, always labeled "via
      Health Connect."
- [ ] **Home** — reflects actual canonical data, not stale/cached values.
- [ ] **Sleep** — sleep session data renders correctly with correct
      provenance labeling.
- [ ] **Weekly** — weekly aggregate reflects actual ingested data.
- [ ] **Readiness** — informs Readiness only, no Hydration Score impact.
- [ ] **Evidence Engine** — correct attribution if consumed there.
- [ ] **a11y labels** — TalkBack reads correct, current state labels.
- [ ] **Limited permissions** — partial-grant state shows correct data for
      granted types, honest absence for denied ones.
- [ ] **Offline** — graceful degradation, cached last-known state.
- [ ] **Loading** — genuine loading state distinct from empty/error.
- [ ] **Retry** — user-triggered retry after failure works correctly.
