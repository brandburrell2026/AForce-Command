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
- [ ] **First connection** — Health Connect permission screen appears with
      exactly the declared categories (sleep, resting HR, HR summary,
      workout, steps, active energy — no HRV/respiratory for Samsung per
      its narrower `recordTypes`; HRV included for `google_health`'s own
      native records).
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
- [ ] **First historical sync** — initial pull covers the expected backfill
      window; note Health Connect's own floor (`maxBackfillDays: 30` for
      both providers here, matching Health Connect's documented 30-day
      floor referenced in `contracts.ts`'s comment on this field).
- [ ] **Incremental sync** — later sync fetches only new records.
- [ ] **Pagination** — verify multi-page Health Connect query results are
      fully collected.
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
- [ ] **Stale** — most recent record >24h old shows `stale`.
- [ ] **No recent data** — most recent record >72h old shows
      `no_recent_data`.
- [ ] **Malformed record** — a record missing a required field or with a
      non-finite value is dropped, not passed through.
- [ ] **Unknown HRV method** — verify any HRV record whose origin can't be
      confidently mapped is never defaulted to a specific method silently;
      confirm the explicit-per-provider translation table
      (`HRV_METHOD_BY_PROVIDER`) is what governs, not a guess.
- [ ] **RMSSD/SDNN conflict** — verify Health Connect/Samsung HRV is never
      presented as SDNN (see hard rules above) — this is the single most
      important data-truthfulness case for this runbook.
- [ ] **Duplicate provider record** — same record ingested twice (e.g. sync
      retry, or Samsung Health double-writing to Health Connect); dedup by
      `externalId`/`deduplicationKey`.
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
- [ ] **Disconnect** — user disconnects; presentation changes to
      `disconnected`.
- [ ] **Failed revocation** — N/A in the OAuth sense; record as N/A with
      reason (Health Connect permissions are OS-managed, not app-revocable
      programmatically).
- [ ] **Unsupported revocation** — verify the disconnect flow is honest
      that full revocation happens in Health Connect's own settings, not
      claimed as done by the AForce disconnect button alone.
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
