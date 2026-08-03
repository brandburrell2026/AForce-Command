# Garmin mock adapter + contract tests (lane G1/G2)

## Status: Garmin is DORMANT

No partner credentials exist. `../garminSnapshot.ts:19-24` is explicit that
`GARMIN_API_BASE` and the per-domain paths are the *documented* Garmin
Health API REST endpoints, overridable specifically so they can be
corrected without a code change once real credentials land. **Nothing in
this directory changes that status.** No `garmin*` file is modified; no
route or worker is wired to call Garmin for real; `createGarminMockAdapter`
is not referenced anywhere outside its own tests.

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
DATABASE_URL="postgresql://user:pass@localhost:5432/db" \
  npx vitest run artifacts/api-server/src/lib/garminMock
```

(The `DATABASE_URL` requirement is a pre-existing `@workspace/db`
import-time guard unrelated to Garmin — see the WHOOP parity lane's README
for the full explanation. This suite makes no real DB or network call.)

## Known gap: `@workspace/health-core` is not an api-server dependency

`artifacts/api-server/package.json` does not list `@workspace/health-core`,
and there is no `@workspace/health-core` symlink under
`artifacts/api-server/node_modules/@workspace/` (confirmed by listing that
directory — it holds exactly the six workspace packages api-server actually
depends on). Only `artifacts/aforce-os` currently depends on health-core.

Because this lane is test/fixture files only (no `package.json` edits), the
contract test imports the frozen contract source by **relative path**
(`../../../../../../lib/health-core/src/normalize`) rather than the package
specifier `@workspace/health-core`. This works today because vitest
resolves relative imports independent of pnpm's workspace linking, and it
exercises the identical, unmodified source file. It is not how production
code should import it.

**Action item for whoever does the real G3/1B provider-kit cutover:** add
`"@workspace/health-core": "workspace:*"` to
`artifacts/api-server/package.json`'s dependencies and run `pnpm install`
before any non-test api-server code imports it via the package specifier.

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
