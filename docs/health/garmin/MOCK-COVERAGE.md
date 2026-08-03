# Garmin Mock Coverage — What's Proven and What Isn't

**Last verified:** 2026-08-03
**Source:** `artifacts/api-server/src/lib/garminMock/` (README + fixtures +
adapter + tests), `artifacts/api-server/src/lib/garminSnapshot.ts`.

## What `garminMock/` proves

1. **The mapping is correct against documented shapes.** Fixture payloads
   for `/dailies`, `/sleeps`, `/hrv` run through the real, unmodified
   `fetchGarminSnapshot` produce the expected `GarminSnapshot`
   (`restingHeartRate`, `hrvMs`, `sleepHoursLastNight`, `stress`, `steps`),
   including the documented field-name drift (`hrvMs`/`stress`, not the
   persisted schema's `hrvSdnn`/`stressScore`).
2. **The canonical foundation already absorbs the drift.** That drifted
   `GarminSnapshot`, lifted into a provider blob via
   `garminSnapshotToProviderBlob` and run through
   `@workspace/health-core`'s `normalizeProviderSnapshot('garmin', ...)`,
   lands correctly on `hrvRmssdMs` (never `hrvSdnnMs`/the legacy
   `hrvSdnn`) plus `stressScore` — zero Garmin-specific health-core
   changes needed at activation time.
3. **The fetch-worker seam is drop-in ready.** `createGarminMockAdapter()`
   produces exactly the `GarminSnapshotFetcher` shape
   (`(accessToken: string) => Promise<GarminSnapshot>`) that
   `RunGarminFetchOnceDeps.snapshotFetcher` expects — structurally and
   behaviorally identical to what a real fetcher would plug into.
4. **The suite runs with zero live dependencies.** No `DATABASE_URL`, no
   network call, no real Garmin credential — confirmed by running it with
   `DATABASE_URL` unset entirely.

## What `garminMock/` does NOT prove

- **That the documented endpoints are correct.** `GARMIN_API_BASE`
  (`https://apis.garmin.com/wellness-api/rest`) and the `/dailies`,
  `/sleeps`, `/hrv` sub-paths are the *documented* REST shapes, never
  checked against a live sandbox or the partner portal. See
  `ENDPOINT-VERIFICATION-CHECKLIST.md`.
- **That the delivery model is even a poll.** Garmin's wellness API is
  widely documented as push/webhook-based. If confirmed, the entire
  pull-shaped `fetchGarminSnapshot` pattern this mock validates is the
  wrong integration pattern for production. See
  `WEBHOOK-ARCHITECTURE-PLAN.md` — this is the single highest-risk gap
  this mock coverage does not and cannot close.
- **That the field shapes are real.** `restingHeartRateInBeatsPerMinute`,
  `lastNightAvg`, `sleepTimeInSeconds`/`durationInSeconds`,
  `averageStressLevel`, `steps` are assumed field names based on public
  documentation, not a verified live payload.
- **That HRV is really RMSSD.** `HRV_METHOD_BY_PROVIDER.garmin = 'rmssd'`
  is an assumption carried into health-core, not a partner-confirmed fact.
- **That the `durationInSeconds`-as-`sleepTimeInSeconds`-fallback is
  correct.** `fetchGarminSnapshot` treats a missing `sleepTimeInSeconds`
  as substitutable by `durationInSeconds`, which may represent total
  time-in-bed rather than time-asleep — the same in-bed-vs-awake
  distinction WHOOP's own sleep mapping has to handle explicitly. This
  fallback could silently overstate sleep hours; unverified.
- **Rate limits, backfill window (`maxBackfillDays: 30` is assumed, not
  confirmed against Garmin), or partner-approval SLA.**
- **Anything about a real OAuth round-trip.** `garminTokenManager.ts`'s
  `GARMIN_TOKEN_ENDPOINT` is likewise unverified.

## How to use this file

When Garmin partner credentials eventually land, this file is the
starting checklist for "what do we actually not know yet" — cross it
against `ENDPOINT-VERIFICATION-CHECKLIST.md` item by item before writing
a single line of a live fetcher. Do not let the mock's green tests be
mistaken for confidence about any item in the "does NOT prove" list above
— that conflation is exactly what `STAGE-LADDER.md`'s iron rule
("mocks alone never validate") exists to prevent, and it applies here with
even more force than to the four active providers, since there is no
partner account yet to catch the mistake early.
