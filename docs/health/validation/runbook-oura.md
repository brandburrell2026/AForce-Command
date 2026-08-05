# Runbook — Oura (Squad C)

**Last verified:** 2026-08-03
**Provider id:** `oura` (`lib/health-core/src/contracts.ts`)
**Flag:** `health_oura_enabled` — OFF in both DEFAULT and DEMO flag sets
(`artifacts/aforce-os/featureFlags/flags.ts`), locked by
`featureFlags/__tests__/healthFlagsDefaultOff.test.ts`.
**Connect method:** `oauth_cloud`, iOS + Android, no external partner
approval required (unlike Garmin).

## Prerequisites

- **Real Oura account + ring**, or an account-only test setup if no ring is
  available (record which in `DEVICE-INVENTORY-TEMPLATE.md` — a ringless
  account only exercises the clean-empty/missing-source cases, not the
  full data-truthfulness matrix).
- **Env vars present** (name only — never record values, see
  `REDACTION.md`): `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`,
  `OURA_OAUTH_REDIRECT_URI`, `OURA_TOKEN_ENCRYPTION_KEY`
  (`artifacts/api-server/src/lib/ouraTokenManager.ts`,
  `lib/db/src/ouraTokenStore.ts`; the encryption key gates pgcrypto
  dual-write of the token columns — confirm present, do not confirm it is
  "correct," that requires a working OAuth round-trip).
- **Redirect URI configured and matching** the app's actual OAuth
  callback for the build under test.
- **Test account has historical data** (readiness, sleep, activity,
  workouts spanning at least a few days) before starting the full-data
  cases — a brand-new empty account only exercises clean-empty.
- A mobile build with `health_oura_enabled` flippable for the test run
  (internal/dev flag override, not a production flip).

## Provider-specific hard rules (verbatim — check these explicitly)

- **HRV is RMSSD-family in milliseconds, not true SDNN, despite the field
  name.** Oura's `average_hrv` field (from `/v2/usercollection/sleep`) is
  mapped to `hrvSdnn` in `OuraSnapshot` purely for shape-parity with the
  other providers' snapshot types — the underlying statistic is
  RMSSD-family (`HRV_METHOD_BY_PROVIDER.oura === 'rmssd'` in
  `lib/health-core/src/normalize.ts`). Never let Oura's HRV be presented
  or logged as SDNN anywhere downstream of normalization — this is the
  same trap the field's misleading local name sets for a future editor of
  `ouraSnapshot.ts` itself.
- **"Resting heart rate" is a documented assumption, not a verified 1:1
  field.** Oura's v2 API has no field literally named resting heart rate;
  AForce maps `lowest_heart_rate` (the lowest HR observed during the sleep
  period, from the same detailed `/v2/usercollection/sleep` resource) to
  `restingHeartRate` (`ouraSnapshot.ts`, verified against Oura's v2 docs
  2026-07). Device validation should specifically compare AForce's
  displayed resting HR against the Oura app's own displayed value for the
  same night, for at least 2–3 nights, and record any material divergence
  — this is exactly the kind of unverified-mapping assumption real-account
  evidence exists to catch.
- **PKCE is sent but not a verified Oura security guarantee.** Oura's
  authorize/token docs don't document `code_challenge`/`code_challenge_method`;
  AForce sends them anyway for defense-in-depth and codebase parity with
  WHOOP/Garmin, but the actual CSRF protection is the server-validated
  single-use `state` param (`ouraAuthStateStore.ts`). Do not treat a
  successful auth as proof PKCE was enforced Oura-side — it isn't testable
  from here either way; just confirm `state` single-use behavior holds
  (see Authorization cases below).
- **Only the first page of each endpoint's `{data, next_token}` envelope
  is read.** `ouraSnapshot.ts` reads a narrow (yesterday..today) window on
  the assumption a second page is pathological for that range, not a
  steady-state case. If a real account somehow has enough same-day
  workout records to paginate, verify this assumption doesn't silently
  drop data — otherwise this is expected behavior, not a bug, and should
  be recorded as confirmed rather than "fixed."

## Known gaps — read before scoring Sync / Data truthfulness

These are verified facts about the shipped code, not open questions. A
checkbox below that appears to fail ONLY because it observed one of these
gaps is a false FAIL — do not fail the run on it; record the gap as
already-known and move on.

- **There is no backfill.** `ouraSnapshot.ts:180-182` computes
  `start_date = today - 24h`, `end_date = today` on every call — a ~2-day
  window, not a 30-day pull. There is no `backfill` identifier anywhere in
  the Oura lib (`ouraSnapshot.ts`, `ouraFetchWorker.ts`,
  `routes/ouraOAuth.ts` — grepped, zero hits). `maxBackfillDays: 30` in
  `lib/health-core/src/contracts.ts`'s `HEALTH_PROVIDER_CAPABILITIES.oura`
  is a DECLARED CAPABILITY the contract reserves for a future
  implementation — it is not wired to anything Oura's fetcher does today.
  Its absence in observed behavior is not a validation failure.
- **Freshness now measures BOTH sync recency and observation recency —
  RULED (Founder Ruling I, RC-2).** The "product ruling PENDING" note that
  used to live here is resolved: "observation freshness and sync freshness
  must be displayed separately and truthfully." Two PRs implement it:
  - **Part 1 (#562, merged to main as `7a6f7990`):**
    `ProviderSnapshot.latestObservedAtMs` (`lib/health-core/src/contracts.ts`)
    — optional, additive epoch-ms field. For Oura specifically, the
    api-server derives it from the day-summary payload's own `bedtime_end`/
    `day` fields, counting a collection's timestamp only when it actually
    contributed a metric and taking the max across contributors; absent
    (never guessed) when a sync's payload carries no usable timestamp.
  - **Part 2 (this branch):** `resolveProviderPresentation`
    (`artifacts/aforce-os/services/health/providerPresentation.ts`) now
    computes `syncAgeMs = nowMs - fetchedAt` AND, when
    `latestObservedAtMs` is present, `observedAgeMs = nowMs -
    latestObservedAtMs` — and gates presentation STATE on whichever axis is
    STALER (conservative selection: a fresh sync of an old Oura readiness
    score must never present as fresh). `connectedHealthView.ts` /
    `ConnectedHealthView.tsx` display BOTH axes separately when they fall
    into genuinely different §53 freshness buckets ("Synced 10m ago · data
    from Aug 1"); when the axes are close, the existing single "Synced …"
    line is unchanged — no clutter.
  - **Parity:** an Oura sync whose payload carries no usable `bedtime_end`/
    `day` (any historical/legacy blob, or a future payload shape that
    regresses) still presents exactly as it did before this ruling —
    `latestObservedAtMs` absent ⇒ byte-identical output, pinned by
    dedicated parity tests at both layers (`providerPresentation.test.ts`,
    `connectedHealthContainerModel.test.ts`).
  - **Validators:** verify BOTH axes render truthfully on a real device —
    (1) a normal, fully fresh Oura account shows the single-line "Synced …"
    text (axes agree, no clutter); (2) Oura's known ~2-day pull window (see
    the no-backfill gap above) makes a meaningfully stale readiness score
    with a fresh sync more plausible here than on WHOOP — if the test
    account's real data exercises this, confirm the composed two-axis line
    appears and both timestamps read truthfully. Record "not exercisable
    this cycle" if it doesn't, rather than failing the checkbox.
- **There is no per-record dedup on this path.** `ouraFetchWorker.ts`
  writes exactly one JSON blob per user under `biometrics.oura` via
  `writeProviderEntry` (`providerKit/fetchWorker.ts:164-168` — a `jsonb_set`
  overwrite of a single key), never a list of records. `externalId` /
  `deduplicationKey` are `CanonicalHealthRecord` fields
  (`lib/health-core/src/contracts.ts:229,247`) that this path never
  produces — checking for them here is unsatisfiable against the correct
  build, not evidence of a missing dedup implementation.

## Step-by-step validation flow

1. Confirm env vars present (see Prerequisites) without ever viewing
   their values.
2. Flip `health_oura_enabled` on for the test build only.
3. Launch the app, navigate to Connected Health, initiate the Oura OAuth
   connection with the real test account.
4. Work through Authorization test cases using a fresh grant, then Sync
   and Data truthfulness with data flowing.
5. Cross-check the resting-HR and HRV mapping assumptions above against
   the Oura app's own displayed values for the same nights.
6. Exercise Product surfaces with the connected state.
7. Exercise Privacy/disconnect and deletion cases last.
8. Capture an `EVIDENCE-TEMPLATE.md` packet, explicitly noting the
   resting-HR cross-check result and any PKCE/state observations.

## §5 Test-case checklist

### Authorization
- [ ] **First connection** — PRIMARY evidence: capture the `authorizeUrl`
      returned by `POST /oura/oauth/start` (built by `buildOuraAuthorizeUrl`
      at `ouraPkce.ts:87`, passed through at `ouraOAuth.ts:161`) and read its
      `scope` query param directly off the URL. It must read exactly `daily
      heartrate workout` (`OURA_DEFAULT_SCOPES`, `ouraPkce.ts:47`), with no
      `personal` scope (gender/age/height/weight profile — deliberately
      dropped on privacy grounds, `ouraPkce.ts:42`). This is the objectively
      verifiable artifact: a raw URL parameter a validator reads directly,
      not a rendered UI element that has to be interpreted. The Oura consent
      screen (which shows human-readable labels for the granted scopes, not
      the raw scope string, and which Oura controls the wording of, not
      AForce) is CORROBORATING evidence — record what it displays; the
      scope-param capture is what the verdict primarily rests on. However,
      if the consent screen displays ANY personal-profile-scope language
      (gender, age, height, weight, or an equivalent "personal info" grant),
      that is an INDEPENDENT FAIL condition in its own right, not merely a
      note — fail the run even if the authorize-URL `scope` param itself
      reads clean, since a personal-scope appearance on the consent screen
      is evidence the requested scope diverged from `OURA_DEFAULT_SCOPES`
      somewhere between construction and what Oura actually received. User
      grants, app transitions to `connected`.
- [ ] **Cancel** — user backs out of the Oura consent screen or closes the
      in-app browser mid-flow; app does not claim `connected`.
- [ ] **Partial approval** — N/A if Oura's consent screen is all-or-nothing
      per scope grouping; if Oura does offer granular scope denial, verify
      `connected_limited` and reads limited to granted scopes. Record
      actual observed behavior — do not assume based on other providers.
- [ ] **Deny all** — user denies the consent screen entirely; app presents
      `disconnected`/`unavailable`.
- [ ] **External revoke** — user revokes AForce's access from their Oura
      account settings (cloud.ouraring.com), outside the app; next sync
      attempt reflects the revocation honestly (refresh fails, state
      becomes `disconnected` or an explicit reauth-needed state, not a
      stale `connected`).
- [ ] **Reconnect** — re-initiate after a prior disconnect/revoke; correct
      consent re-request, new state stored cleanly (no orphaned prior
      token row).
- [ ] **Expired token** — force/wait for access-token expiry; verify
      refresh-token exchange succeeds and sync continues without
      user-visible interruption.
- [ ] **Deleted provider app** — N/A; Oura is a cloud OAuth provider, not a
      local app dependency. Record as N/A with reason.
- [ ] **Unavailable native bridge** — N/A; Oura has no native module
      dependency (pure OAuth + HTTP). Record as N/A with reason.
- [ ] **State replay** — attempt to reuse a consumed OAuth `state` value
      (e.g. replay the callback URL); verify the server-side single-use
      check in `ouraAuthStateStore.ts` rejects it.

### Sync
- [ ] **First sync** — capture the actual `start_date`/`end_date` on the
      wire (or via a request log) and verify it is a yesterday..today
      (~2-day) window, computed fresh from `now()` (`ouraSnapshot.ts:180-182`)
      — NOT a 30-day backfill. See the "no backfill" known gap above; a
      ~2-day window is the correct, passing observation for this checkbox,
      not a partial result.
- [ ] **Incremental sync** — verify that a second sync run shortly after the
      first re-requests the SAME window shape (`now-24h` .. `now`) rather
      than narrowing to "since last sync" — there is no persisted cursor.
      Within that window, verify freshest-record semantics: each endpoint's
      `data[]` array is read in ascending date order and the LAST element is
      kept (`ouraSnapshot.ts`'s `latest()`); an "incremental" gain happens
      only because the window's calendar day advances, never because a
      cursor remembers what was already fetched.
- [ ] **Pagination** — verify the "first page only" assumption (see hard
      rules) against real same-day workout volume if the test account has
      enough activity; otherwise record as not exercisable this cycle.
- [ ] **Interrupted sync** — force-quit/background mid-sync; verify clean
      recovery on next sync.
- [ ] **Retry** — transient endpoint failure (simulate via network
      conditioning if possible) triggers retry or a clear per-endpoint
      partial-data state, not a full failure (per `ouraSnapshot.ts`'s
      per-endpoint isolation contract).
- [ ] **Duplicated worker** — two concurrent sync triggers don't
      double-ingest.
- [ ] **Background sync** — background fetch worker (`ouraFetchWorker.ts` /
      `ouraFetchSweepBootstrap.ts`) behaves correctly under real scheduling.
- [ ] **Foreground sync** — manual/foreground sync works independently.
- [ ] **Account switching** — disconnect one Oura account, connect a
      different one; verify data reflects the newly connected account, not
      a cached prior identity.
- [ ] **Reinstall** — uninstall/reinstall AForce; verify reauth flow and
      clean resync (server-side token persists independent of the mobile
      install, since this is cloud OAuth — verify actual observed
      behavior).
- [ ] **Timezone change** — verify timestamp handling stays correct across
      a timezone change mid-session.
- [ ] **DST transition** — verify a sleep session spanning DST isn't
      double-counted or mis-durationed.

### Data truthfulness
- [ ] **Missing source** — a requested metric type has zero records for
      the window; shown as unavailable, not zero/fabricated.
- [ ] **Missing device** — account-only (no ring) test setup; verify
      graceful absence for all ring-derived metrics, not an error state.
- [ ] **Stale** — verify `stale` appears when EITHER `now - fetchedAt`
      (sync age) OR, when the payload carried `bedtime_end`/`day` and
      `latestObservedAtMs` is present, `now - latestObservedAtMs`
      (observation age) exceeds 24h — whichever is STALER wins (Ruling I
      conservative selection, see the freshness section above). Only fail
      this checkbox if a genuinely stale observation with a fresh sync
      fails to present as `stale`.
- [ ] **No recent data** — same conservative, either-axis-exceeding-72h
      check shows `no_recent_data`. Same either-axis caveat as Stale
      applies.
- [ ] **Both freshness axes display truthfully** — when the test account's
      Oura readiness/sleep record is meaningfully older than the last sync
      (plausible here given the ~2-day pull window), verify the row shows
      the composed line ("Synced Xm ago · data from <date>") with both
      timestamps reading correctly, and that VoiceOver/TalkBack announces
      both axes. When the axes are close, verify the row shows only the
      single "Synced …" line. Record "not exercisable this cycle" if the
      account's data never diverges enough to exercise the dual-axis case.
- [ ] **Malformed record** — a record missing a required field or with a
      non-finite value is dropped, not passed through (per `num()`-style
      coercion in the snapshot mapping).
- [ ] **Unknown HRV method** — N/A; Oura's HRV is always mapped RMSSD per
      `HRV_METHOD_BY_PROVIDER`. Record as N/A with reason.
- [ ] **RMSSD/SDNN conflict** — verify Oura's HRV is never presented as
      true SDNN anywhere downstream (see hard rules above) — this is the
      single most important data-truthfulness case for this runbook, given
      the misleading `hrvSdnn` field name in the snapshot type itself.
- [ ] **Duplicate provider record** — Oura's shipped path has no per-record
      identity to dedup (see the "no per-record dedup" known gap above).
      Verify the actual observable property instead: two concurrent or
      retried syncs converge on ONE overwritten `biometrics.oura` blob value
      (last-write-wins, overwrite-idempotent), never a duplicated entry.
      Checking for `externalId`/`deduplicationKey` dedup here is
      unsatisfiable against the correct build, not a bug to find.
- [ ] **Aggregator copy** — N/A in the HealthKit/Health-Connect
      relay sense for the direct Oura OAuth path; if Oura data ALSO
      reaches AForce via a HealthKit re-export (Oura writes to Apple
      Health), verify Squad E's cross-provider matrix — not this runbook
      — governs that dedup case.
- [ ] **Direct copy** — a record fetched directly via the Oura API;
      verify attribution to `oura` as origin.
- [ ] **Clean-empty** — brand-new Oura account (or account-only, no ring,
      zero data) with zero records; honest empty state.
- [ ] **Score without valid attribution** — verify `oura_readiness`
      (`providerScores: ['oura_readiness']`) is attributed only to `oura`
      and only when a real `daily_readiness` record exists for the window;
      never fabricated when the readiness endpoint returns empty.

### Privacy
- [ ] **Disconnect** — user disconnects; presentation changes to
      `disconnected`, and the server-side token row is invalidated/cleared
      (not just the mobile-side flag).
- [ ] **Failed revocation** — simulate the disconnect API call failing;
      verify the app surfaces an honest error, does not claim
      `disconnected` while the server still holds a valid token.
- [ ] **Unsupported revocation** — N/A; Oura's OAuth model supports
      programmatic token invalidation server-side. Record as N/A with
      reason if the current implementation doesn't call Oura's own revoke
      endpoint (verify whether `ouraTokenManager.ts` does so, and record
      the actual behavior either way — do not assume).
- [ ] **Token-store read failure** — simulate a DB read failure for the
      token row; verify honest error surfacing, not a silent fallback that
      claims connected.
- [ ] **Local cleanup failure** — simulate a failure clearing locally
      cached Oura-derived data; verify honest error surfacing.
- [ ] **Repeated deletion** — disconnect/delete twice; idempotent, no
      crash.
- [ ] **Account deletion** — full AForce account deletion removes the
      server-side Oura token row and locally cached canonical
      records/snapshot (`routes/accountDeletion.ts`).
- [ ] **Sibling preservation** — deleting the Oura connection doesn't
      affect other connected providers (e.g. WHOOP stays intact).
- [ ] **Stale snapshot removal** — disconnect removes the served
      `ProviderSnapshot` for `oura`, not just stops future syncs.
- [ ] **Unauthorized deletion attempt** — disconnect/deletion requires the
      authenticated user.

### Product surfaces
- [ ] **Connected Health** — shows accurate `oura` state and last sync
      info.
- [ ] **Home** — reflects actual canonical data, not stale/cached values.
- [ ] **Sleep** — sleep session data renders correctly with correct
      provenance labeling.
- [ ] **Weekly** — weekly aggregate reflects actual ingested data.
- [ ] **Readiness** — Oura-derived data informs Readiness only; verify no
      Hydration Score impact, and that `oura_readiness` is presented
      distinctly from AForce's own Readiness computation, not conflated
      with it.
- [ ] **Evidence Engine** — correct attribution if consumed there.
- [ ] **a11y labels** — VoiceOver/TalkBack read correct, current state
      labels.
- [ ] **Limited permissions** — N/A unless Oura's consent screen is
      confirmed to support granular denial (see Authorization above); if
      confirmed N/A, record as such.
- [ ] **Offline** — graceful degradation, cached last-known state.
- [ ] **Loading** — genuine loading state distinct from empty/error.
- [ ] **Retry** — user-triggered retry after failure works correctly.
