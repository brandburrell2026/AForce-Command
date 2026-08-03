# Garmin Endpoint Verification Checklist (G3)

**Last verified:** 2026-08-03
**When to use this:** after Garmin partner credentials are granted, before
writing a single line of a live fetcher. Confirm every item below against
the real Garmin Developer Program partner portal and, ideally, a live
sandbox response — do not assume any documented shape here is correct
until independently verified. This is the same checklist maintained
alongside the mock adapter
(`artifacts/api-server/src/lib/garminMock/README.md`'s "G3 verification
checklist"); it is restated here as the durable, discoverable copy so a
future session doesn't have to know to look inside a test-support
directory's README to find it.

## Checklist

- [ ] **Endpoints** — is `https://apis.garmin.com/wellness-api/rest` still
      current, and do `/dailies`, `/sleeps`, `/hrv` remain the correct
      sub-paths (vs. a versioned path, e.g. a `/v2` segment the way WHOOP
      migrated)?
- [ ] **Auth model** — confirm OAuth2 client credentials + token endpoint.
      `garminTokenManager.ts`'s `GARMIN_TOKEN_ENDPOINT`
      (`https://diauth.garmin.com/di-oauth2-service/oauth/token`) is
      unverified, as are the exact scope names required for wellness
      summary reads.
- [ ] **Delivery model — push/webhook likely, not poll.** This is the
      single highest-risk assumption in the current dormant code. See
      `WEBHOOK-ARCHITECTURE-PLAN.md` — resolve this before anything else on
      this list, since a confirmed push model invalidates the pull-shaped
      approach the rest of this checklist otherwise assumes.
- [ ] **Field shapes** — `restingHeartRateInBeatsPerMinute`,
      `lastNightAvg` (HRV), `sleepTimeInSeconds` / `durationInSeconds`,
      `averageStressLevel`, `steps`. Confirm exact field names, units, and
      whether HRV is truly RMSSD (assumed here and in
      `HRV_METHOD_BY_PROVIDER.garmin = 'rmssd'` in health-core) or
      something Garmin-specific.
- [ ] **`durationInSeconds` vs `sleepTimeInSeconds` fallback semantics** —
      `fetchGarminSnapshot` treats `durationInSeconds` as an interchangeable
      substitute for `sleepTimeInSeconds` when the latter is absent. These
      may not be the same quantity (total time-in-bed vs. time-asleep,
      mirroring WHOOP's own in-bed-vs-awake split). Confirm against the
      partner portal or a live payload whether this fallback silently
      overstates sleep hours before trusting it in production.
- [ ] **Rate limits / backfill window** vs. the `maxBackfillDays: 30`
      declared in `lib/health-core/src/contracts.ts` — confirm Garmin's
      actual limits and adjust the declared capability if they differ.
- [ ] **Partner approval SLA** — `requiresExternalApproval: true` in the
      same contracts file; confirm current turnaround time before
      committing to a launch date that depends on it.

## After this checklist is complete

Update `lib/health-core/src/contracts.ts`'s
`HEALTH_PROVIDER_CAPABILITIES.garmin` fields to match confirmed reality
(not documented assumption) in the same PR that closes out this checklist
— per this program's doctrine, a fact learned here that isn't reflected
back into the frozen contract is a fact that will silently go stale the
next time someone reads `contracts.ts` instead of this file.

Then, and only then, does Garmin become eligible to enter the
`docs/health/validation/` program at CODED/UNIT-VALIDATED — this checklist
does not itself advance Garmin on `STAGE-LADDER.md`; it removes the
"we don't know if the endpoints are real" blocker so that work can begin
honestly.
