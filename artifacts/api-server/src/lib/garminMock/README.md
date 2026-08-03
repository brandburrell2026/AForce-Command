# Garmin mock adapter + contract tests (lane G1/G2)

## Status: Garmin is DORMANT

No partner credentials exist. `../garminSnapshot.ts:19-24` is explicit that
`GARMIN_API_BASE` and the per-domain paths are the *documented* Garmin
Health API REST endpoints, overridable specifically so they can be
corrected without a code change once real credentials land. **Nothing in
this directory changes that status.** No `garmin*` file is modified; no
route or worker is wired to call Garmin for real; `createGarminMockAdapter`
is not referenced anywhere outside its own tests.

**Production wellness delivery is expected to require a verified
push/webhook architecture** — Garmin's wellness API is widely documented as
push-based (Garmin calls a registered webhook with summary payloads), not a
poll-on-demand model. The dormant pull-style endpoints this directory mocks
(`fetchGarminSnapshot`'s `/dailies`, `/sleeps`, `/hrv` GETs) are **NOT
verified** against a live Garmin sandbox or partner portal — they mirror
only the documented REST shapes. G3 is scoped to partner
docs-and-credentials work (see the checklist below), not to building the
real (likely webhook-receiver-shaped) integration; that is separate,
later work once the delivery model is confirmed.

## What this proves

That the plumbing between "Garmin sends us data" and "AForce's canonical
health contract understands it" already works, end to end, using only
documented (unverified) wire shapes:

1. **`garminMock.fixtures.ts`** — deterministic Garmin wellness-summary
   payloads (`/dailies`, `/sleeps`, `/hrv`) modeled on the fields
   `garminSnapshot.ts` already assumes (`restingHeartRateInBeatsPerMinute`,
   `lastNightAvg`, `sleepTimeInSeconds` / `durationInSeconds`,
   `averageStressLevel`, `steps`).
2. **`garminMockAdapter.ts`** — `createGarminMockAdapter()` returns a
   function with the exact same shape as `GarminSnapshotFetcher`
   (`(accessToken: string) => Promise<GarminSnapshot>`, defined in
   `../garminFetchWorker.ts` and consumed via
   `RunGarminFetchOnceDeps.snapshotFetcher`). It is a drop-in replacement
   for a live Garmin fetcher in that seam — internally it calls the REAL,
   unmodified `fetchGarminSnapshot` against fixture data, never a
   hand-rolled reimplementation of the mapping.
3. **`__tests__/garminMock.test.ts`** — three contract tests:
   - **(a)** fixture payloads run through the real `fetchGarminSnapshot`
     produce the KNOWN drifted `GarminSnapshot` shape (`hrvMs`, `stress` —
     field names that don't match the persisted biometrics schema's
     `hrvSdnn` / `stressScore`).
   - **(b)** that drifted shape, lifted into a provider blob via the real
     `garminSnapshotToProviderBlob` and run through
     `@workspace/health-core`'s `normalizeProviderSnapshot('garmin', ...)`,
     lands on the canonical `hrvRmssdMs` (never `hrvSdnnMs` or the legacy
     `hrvSdnn`) plus `stressScore` — i.e. the foundation already absorbs
     the Garmin drift with zero Garmin-specific changes needed at
     activation time.
   - **(c)** `createGarminMockAdapter()`'s output is structurally and
     behaviorally identical to a real fetcher plugged into the
     `GarminSnapshotFetcher` seam (arity 1, async, deterministic,
     round-trips through health-core the same way).

## Running

```
env -u DATABASE_URL npx vitest run artifacts/api-server/src/lib/garminMock
```

This suite passes with **no `DATABASE_URL` set at all** — confirmed by
running it that way. `./_env.ts` (imported first, matching the WHOOP parity
lane's identical guard) defaults `DATABASE_URL` defensively in case a future
edit adds a real (non-type-only) `@workspace/db` import, but nothing in this
suite reaches one today: the only brush with `@workspace/db` is a
**type-only** import (`import type { GarminSnapshotFetcher }` in
`garminMockAdapter.ts`, itself type-only against `garminFetchWorker.ts`),
which is erased at compile time and never touches the module at runtime.
See the "(d) suite runs without DATABASE_URL" test for the collection-time
proof. This suite makes no real DB or network call either way.

## `@workspace/health-core` dependency

`artifacts/api-server/package.json` DOES list
`"@workspace/health-core": "workspace:*"`, and it IS symlinked at
`artifacts/api-server/node_modules/@workspace/health-core` — confirmed by
reading both directly. The contract test imports it via the ordinary
package specifier (`@workspace/health-core`), not a relative path. (An
earlier version of this doc and the test file's docstring claimed the
dependency didn't exist and that the import used a relative path into
`lib/health-core/src`; neither was true by the time this was checked —
corrected here.)

## G3 verification checklist (before requesting/using real Garmin credentials)

Confirm every item below against the Garmin Developer Program partner
portal — do not assume the documented shapes here are correct until they
are independently verified against a live sandbox response:

- [ ] **Endpoints**: is `https://apis.garmin.com/wellness-api/rest` still
      current, and do `/dailies`, `/sleeps`, `/hrv` remain the correct
      sub-paths (vs. a versioned path, e.g. a `/v2` segment like WHOOP's
      migration)?
- [ ] **Auth model**: confirm OAuth2 client credentials + token endpoint
      (`garminTokenManager.ts`'s `GARMIN_TOKEN_ENDPOINT` —
      `https://diauth.garmin.com/di-oauth2-service/oauth/token` — is also
      unverified) and scope names required for wellness summary reads.
- [ ] **Delivery model — push/webhook likely, not poll**: Garmin's
      wellness API is widely documented as **push-based** (Garmin calls a
      registered webhook with summary payloads) rather than the
      poll-on-demand model WHOOP/Oura use. If confirmed, `fetchGarminSnapshot`'s
      current shape (a pull triggered by our worker) is the WRONG
      integration pattern and the real G3 implementation needs a webhook
      receiver + local cache, not a fetch-on-sweep loop. This is the
      single highest-risk assumption in the current dormant code and must
      be resolved before writing a live fetcher.
- [ ] **Field shapes**: `restingHeartRateInBeatsPerMinute`, `lastNightAvg`
      (HRV), `sleepTimeInSeconds` / `durationInSeconds`,
      `averageStressLevel`, `steps` — confirm exact field names, units, and
      whether HRV is truly RMSSD (assumed here and in
      `HRV_METHOD_BY_PROVIDER.garmin = 'rmssd'` in health-core) or something
      else Garmin-specific.
- [ ] **`durationInSeconds` (in-bed) vs `sleepTimeInSeconds` (asleep)
      fallback semantics**: `fetchGarminSnapshot` treats
      `GARMIN_SLEEPS_DURATION_FALLBACK_FIXTURE`'s `durationInSeconds` as an
      interchangeable substitute for `sleepTimeInSeconds` when the latter is
      absent (see the "falls back to durationInSeconds" test in
      `__tests__/garminMock.test.ts`). These are not necessarily the same
      quantity — `sleepTimeInSeconds` documents time actually asleep,
      while `durationInSeconds` more plausibly means total time in bed
      (asleep + awake), mirroring WHOOP's own in-bed-vs-awake distinction
      (`whoopSnapshot.ts`). Confirm against the partner portal / a live
      payload whether this fallback silently overstates sleep hours before
      trusting it in production.
- [ ] **Rate limits / backfill window** vs. the `maxBackfillDays: 30`
      declared in `lib/health-core/src/contracts.ts`.
- [ ] **Partner approval SLA** — `requiresExternalApproval: true` in the
      same contracts file; confirm current turnaround time before
      committing to a launch date that depends on it.

## G4 activation gates

Per `lib/health-core/src/contracts.ts`'s `HEALTH_PROVIDER_CAPABILITIES.garmin.activationGates`
(verbatim, frozen contract — do not edit here):

1. `DORMANT: partner credentials granted`
2. `endpoints verified against partner portal`
3. `health_garmin_enabled`

A Garmin row may not go user-visible until all three are objectively true.
This mock adapter satisfies none of them by design — it exists to remove
"we don't know if our code would work" from the list of things blocking
activation, leaving only the credentials/verification/flag gates above.
