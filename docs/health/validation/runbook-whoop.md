# Runbook — WHOOP (Squad D)

**Last verified:** 2026-08-03
**Provider id:** `whoop` (`lib/health-core/src/contracts.ts`)
**Flag:** `health_whoop_enabled` — OFF in both DEFAULT and DEMO flag sets
(`artifacts/aforce-os/featureFlags/flags.ts`), locked by
`featureFlags/__tests__/healthFlagsDefaultOff.test.ts`. Per
`activationGates`, server-credential gating is a carve-out until the PR 1B
provider-kit cutover — confirm with the owning engineer what actually
gates a given test build before assuming the flag alone controls access.
**Connect method:** `oauth_cloud`, iOS + Android, no external partner
approval required.

## Why this runbook is "parity-fixture-constrained"

WHOOP is the one provider with a 27-test golden parity suite
(`artifacts/api-server/src/__tests__/whoopParity/`) pinning its OAuth/PKCE,
snapshot mapping, and token-refresh behavior at exact values — but that
suite pins behavior **against fixtures**, not against WHOOP's real API.
Several of the pinned behaviors are documented in the parity README as
genuinely surprising relative to the code's own comments, which makes them
the highest-value things for this runbook to re-verify against a real
account rather than assume are also true in production:

- The selection predicate is `score_state === 'SCORED' || score != null` —
  an OR, not "skip PENDING_SCORE." A PENDING_SCORE record with a non-null
  `score` object IS selected today.
- Selection is **array-first**, not "freshest" — `scoreSourceOf` returns
  the first record matching the predicate with no date/timestamp
  comparison, despite `whoopSnapshot.ts`'s own comment describing it as
  taking "the freshest SCORED record."

Neither of these has been checked against what WHOOP's real
`/developer/v2` endpoints actually return for record ordering or
`score_state` combinations — the fixtures encode the code's *current*
behavior, not a verified guarantee about WHOOP's API contract. This
runbook's job is to close that gap with real data, not to re-derive what
the parity suite already pins.

## Prerequisites

- **Real WHOOP account** with historical data (multiple recovery/sleep/
  cycle records spanning several days) — a brand-new account only
  exercises clean-empty.
- **Env vars present** (name only — never record values, see
  `REDACTION.md`): `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`,
  `WHOOP_OAUTH_REDIRECT_URI`, `WHOOP_TOKEN_ENCRYPTION_KEY`
  (`artifacts/api-server/src/lib/whoopTokenManager.ts`,
  `lib/db/src/whoopTokenStore.ts` — the encryption key gates pgcrypto
  dual-write of the token columns).
- **Redirect URI configured and matching** the app's actual OAuth
  callback for the build under test.
- A mobile build with `health_whoop_enabled` (and whatever
  server-credential carve-out currently applies) flippable for the test
  run.

## Provider-specific hard rules (verbatim — check these explicitly)

- **HRV is RMSSD in milliseconds (`hrv_rmssd_milli`), never SDNN.**
  `HRV_METHOD_BY_PROVIDER.whoop === 'rmssd'`
  (`lib/health-core/src/normalize.ts`). Never let WHOOP's HRV be presented
  or logged as SDNN anywhere downstream.
- **WHOOP retired v1 — all endpoints are `/developer/v2`.** v1 `/recovery`
  and `/activity/sleep` now 404 per WHOOP's own migration notes. If any
  code path or evidence artifact shows a v1 URL succeeding or failing
  unexpectedly, that's a signal WHOOP's deprecation timeline moved — flag
  it, don't route around it silently.
- **`state` must be exactly 8 characters** when self-generated
  (`whoopPkce.ts`) — WHOOP silently fails the authorize step on a longer
  token. Verify the real authorize redirect succeeds with this exact
  length; a subtle regression here would not throw, it would just fail
  the auth flow at WHOOP's end. `code_verifier` is 43 characters, S256
  challenge only (`plain` is never sent).
- **Refresh requests must include `scope=offline`.** Confirmed in the
  parity suite; without it, refresh may not return a usable long-lived
  grant. Verify a real refresh cycle succeeds end-to-end.
- **WHOOP may omit the refresh token on a refresh response** — when
  omitted, the token manager must retain the prior refresh token rather
  than nulling it out. Verify this against a real refresh (may require
  waiting for natural token expiry, or shortening the local expiry window
  for the test build if that's a safe, reversible test-only change —
  confirm with the owning engineer before doing so).
- **Selection predicate and ordering (see "why this runbook exists"
  above)** — this is the single highest-value real-account check in this
  runbook. If the real account has any record with `score_state` other
  than `SCORED` but a non-null `score`, or multiple SCORED records for the
  same collection, use it to confirm the OR-predicate and array-first
  selection behave as pinned, not as the code's own ("freshest") comment
  claims.

## Step-by-step validation flow

1. Confirm env vars present (see Prerequisites) without ever viewing
   their values.
2. Flip `health_whoop_enabled` (and any current server-credential
   carve-out) on for the test build only.
3. Launch the app, navigate to Connected Health, initiate the WHOOP OAuth
   connection with the real test account.
4. Work through Authorization test cases using a fresh grant, then Sync
   and Data truthfulness with data flowing.
5. Specifically exercise the selection-predicate and refresh-token-omission
   checks called out in the hard rules above.
6. Exercise Product surfaces with the connected state.
7. Exercise Privacy/disconnect and deletion cases last.
8. Capture an `EVIDENCE-TEMPLATE.md` packet, explicitly recording the
   outcome of the selection-predicate and refresh-omission checks even if
   the account's real data doesn't happen to exercise the edge case (record
   "not exercisable — account had no PENDING_SCORE-with-score record this
   cycle" rather than silently omitting the row).

## §5 Test-case checklist

### Authorization
- [ ] **First connection** — OAuth consent screen appears with exactly the
      declared scopes (`offline read:recovery read:cycles read:sleep
      read:workout read:profile` per `whoopPkce.ts`'s
      `WHOOP_DEFAULT_SCOPES`), user grants, app transitions to `connected`.
- [ ] **Cancel** — user backs out of the WHOOP consent screen or closes the
      in-app browser mid-flow; app does not claim `connected`.
- [ ] **Partial approval** — record WHOOP's actual behavior if scope-level
      partial denial is offered; if WHOOP's consent is all-or-nothing,
      record as N/A with reason rather than assuming.
- [ ] **Deny all** — user denies the consent screen; app presents
      `disconnected`/`unavailable`.
- [ ] **External revoke** — user revokes AForce's access from their WHOOP
      account settings, outside the app; next sync reflects the revocation
      honestly (refresh fails, state becomes `disconnected` or an explicit
      reauth-needed state).
- [ ] **Reconnect** — re-initiate after a prior disconnect/revoke; correct
      consent re-request, clean token-row replacement.
- [ ] **Expired token** — force/wait for access-token expiry; verify
      refresh succeeds at the real 60-second skew boundary
      (`expiresAt - now === skew` refreshes, `skew + 1` does not, per the
      parity suite) and sync continues without user-visible interruption.
- [ ] **Deleted provider app** — N/A; WHOOP is a cloud OAuth provider.
      Record as N/A with reason.
- [ ] **Unavailable native bridge** — N/A; no native module dependency.
      Record as N/A with reason.
- [ ] **State replay** — attempt to reuse a consumed OAuth `state` value;
      verify the server-side single-use check (`whoopAuthStateStore.ts`)
      rejects it, at both the route level and the store level (the parity
      suite pins both).

### Sync
- [ ] **First historical sync** — initial pull covers the expected backfill
      window (`maxBackfillDays: 30` per `HEALTH_PROVIDER_CAPABILITIES.whoop`).
- [ ] **Incremental sync** — later sync fetches only new records.
- [ ] **Pagination** — verify behavior against `limit=10` per-endpoint
      fetches (`/recovery`, `/cycle`, `/activity/sleep`) if the real
      account has more than 10 records in the sync window.
- [ ] **Interrupted sync** — force-quit/background mid-sync; verify clean
      recovery on next sync.
- [ ] **Retry** — transient per-endpoint failure results in that
      endpoint's fields staying null while others still contribute (per
      `whoopSnapshot.ts`'s per-endpoint isolation contract) — verify this
      against a real transient failure if one can be induced, otherwise
      via network conditioning.
- [ ] **Duplicated worker** — two concurrent sync triggers don't
      double-ingest.
- [ ] **Background sync** — background fetch worker
      (`whoopFetchWorker.ts` / `whoopFetchSweepBootstrap.ts`) behaves
      correctly under real scheduling; confirm `whoopAdvisoryLock.ts`
      actually prevents overlapping sweeps against a real timing race, not
      just in unit tests.
- [ ] **Foreground sync** — manual/foreground sync works independently.
- [ ] **Account switching** — disconnect one WHOOP account, connect a
      different one; verify data reflects the newly connected account.
- [ ] **Reinstall** — uninstall/reinstall AForce; verify reauth flow and
      clean resync (server-side token persists independent of mobile
      install, since this is cloud OAuth).
- [ ] **Timezone change** — verify timestamp handling stays correct across
      a timezone change mid-session.
- [ ] **DST transition** — verify a sleep session spanning DST isn't
      double-counted or mis-durationed (sleep hours computed as
      `max(0, inBed - awake) / 3.6e6` per `whoopSnapshot.ts`).

### Data truthfulness
- [ ] **Missing source** — a requested metric type has zero records for
      the window; shown as unavailable, not zero/fabricated.
- [ ] **Missing device** — N/A; WHOOP is itself the wearable, so a
      connected account always implies a device. Record as N/A with
      reason, or use an account with a very old/unworn strap to check the
      stale/no-recent-data path instead.
- [ ] **Stale** — most recent record >24h old shows `stale`.
- [ ] **No recent data** — most recent record >72h old shows
      `no_recent_data`.
- [ ] **Malformed record** — a record missing a required field or with a
      non-finite value (per `num()`'s reject-non-finite contract in the
      parity suite) is dropped, not passed through.
- [ ] **Unknown HRV method** — N/A; WHOOP's HRV is always mapped RMSSD.
      Record as N/A with reason.
- [ ] **RMSSD/SDNN conflict** — verify WHOOP's HRV is never presented as
      SDNN anywhere downstream (see hard rules above).
- [ ] **Duplicate provider record** — same record ingested twice (e.g. sync
      retry); dedup by `externalId`/`deduplicationKey`.
- [ ] **Aggregator copy** — N/A for the direct WHOOP OAuth path; if WHOOP
      data also reaches AForce via a HealthKit re-export, that's Squad E's
      cross-provider matrix, not this runbook.
- [ ] **Direct copy** — a record fetched directly via the WHOOP API;
      verify attribution to `whoop` as origin.
- [ ] **Clean-empty** — brand-new WHOOP account (or a fresh strap with no
      recorded cycles yet) with zero data; honest empty state.
- [ ] **Score without valid attribution** — verify `whoop_recovery` and
      `whoop_strain` (`providerScores: ['whoop_recovery', 'whoop_strain']`)
      are attributed only to `whoop` and only when the selection predicate
      genuinely matches a real record — this is where the OR-predicate
      real-account check from "why this runbook is parity-fixture-
      constrained" above gets exercised end-to-end through the product
      surface, not just the parity suite's unit-level assertion.

### Privacy
- [ ] **Disconnect** — user disconnects; presentation changes to
      `disconnected`, and the server-side token row is invalidated/cleared.
- [ ] **Failed revocation** — simulate the disconnect API call failing;
      verify honest error surfacing, not a false `disconnected` claim.
- [ ] **Unsupported revocation** — record whether the current
      implementation calls WHOOP's own token-revocation endpoint (if WHOOP
      exposes one) or only stops local use of the token; record actual
      behavior, don't assume parity with another provider.
- [ ] **Token-store read failure** — simulate a DB read failure for the
      token row; verify honest error surfacing.
- [ ] **Local cleanup failure** — simulate a failure clearing locally
      cached WHOOP-derived data; verify honest error surfacing.
- [ ] **Repeated deletion** — disconnect/delete twice; idempotent, no
      crash.
- [ ] **Account deletion** — full AForce account deletion removes the
      server-side WHOOP token row and locally cached canonical
      records/snapshot (`routes/accountDeletion.ts`).
- [ ] **Sibling preservation** — deleting the WHOOP connection doesn't
      affect other connected providers (e.g. Oura stays intact).
- [ ] **Stale snapshot removal** — disconnect removes the served
      `ProviderSnapshot` for `whoop`, not just stops future syncs.
- [ ] **Unauthorized deletion attempt** — disconnect/deletion requires the
      authenticated user; also confirm `GET /whoop/status` requires auth
      and returns exactly `{credentialsConfigured, connected, expiresAt}`
      (no leaking token material) per the parity suite's route-contract
      pin.

### Product surfaces
- [ ] **Connected Health** — shows accurate `whoop` state and last sync
      info.
- [ ] **Home** — reflects actual canonical data, not stale/cached values.
- [ ] **Sleep** — sleep session data renders correctly with correct
      provenance labeling.
- [ ] **Weekly** — weekly aggregate reflects actual ingested data.
- [ ] **Readiness** — WHOOP-derived HRV/recovery inform Readiness only;
      verify no Hydration Score impact, and that `whoop_recovery` /
      `whoop_strain` are presented distinctly from AForce's own Readiness
      computation.
- [ ] **Evidence Engine** — correct attribution if consumed there.
- [ ] **a11y labels** — VoiceOver/TalkBack read correct, current state
      labels.
- [ ] **Limited permissions** — N/A unless WHOOP's consent screen is
      confirmed to support granular denial; record as such if N/A.
- [ ] **Offline** — graceful degradation, cached last-known state.
- [ ] **Loading** — genuine loading state distinct from empty/error.
- [ ] **Retry** — user-triggered retry after failure works correctly.
