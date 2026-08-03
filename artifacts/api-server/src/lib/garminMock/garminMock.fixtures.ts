/**
 * Deterministic Garmin wellness-summary fixtures.
 *
 * Modeled on the DOCUMENTED Garmin Health API REST wellness summary shapes
 * already assumed by `../garminSnapshot.ts` (see its `GarminDailyRecord` /
 * `GarminSleepRecord` / `GarminHrvRecord` interfaces): a top-level JSON
 * array per endpoint, most-recent-first. Garmin credentials are NOT
 * provisioned (garminSnapshot.ts:19-24) — these shapes have never been
 * confirmed against a live response and MUST be re-verified against the
 * partner portal before this repo treats them as ground truth (see the G3
 * checklist in `README.md`).
 *
 * Values are hand-picked to be unambiguous in assertions (no accidental
 * collisions with 0 / null / other fixture fields).
 */

/** GET /wellness-api/rest/dailies response (subset of documented fields). */
export const GARMIN_DAILIES_FIXTURE = [
  {
    calendarDate: "2026-08-02",
    restingHeartRateInBeatsPerMinute: 54,
    steps: 9184,
    averageStressLevel: 37,
  },
];

/** GET /wellness-api/rest/sleeps response. */
export const GARMIN_SLEEPS_FIXTURE = [
  {
    calendarDate: "2026-08-02",
    // 7h10m -> exercises non-whole-hour division in the /3600 mapping.
    sleepTimeInSeconds: 7 * 3600 + 10 * 60,
  },
];

/** Alternate sleeps shape some summaries use in place of `sleepTimeInSeconds`. */
export const GARMIN_SLEEPS_DURATION_FALLBACK_FIXTURE = [
  {
    calendarDate: "2026-08-02",
    durationInSeconds: 6 * 3600 + 45 * 60,
  },
];

/** GET /wellness-api/rest/hrv response. `lastNightAvg` is RMSSD-family per
 *  garminSnapshot.ts's own docstring — NOT SDNN, despite living in a field
 *  historically named `hrvSdnn` downstream (the drift this fixture set
 *  exists to pin). */
export const GARMIN_HRV_FIXTURE = [
  {
    calendarDate: "2026-08-02",
    lastNightAvg: 41,
  },
];

/**
 * The KNOWN DRIFTED shape `fetchGarminSnapshot` (unmodified, real mapping)
 * produces from the three fixtures above. "Drifted" = the field names
 * (`hrvMs`, `stress`) that historically did NOT match the persisted
 * biometrics-blob schema's `hrvSdnn` / `stressScore` naming — the exact
 * mismatch `@workspace/health-core`'s `normalizeProviderSnapshot` exists to
 * absorb (see `lib/health-core/src/normalize.ts`'s module docstring).
 */
export const GARMIN_EXPECTED_DRIFTED_SNAPSHOT = {
  restingHeartRate: 54,
  hrvMs: 41,
  sleepHoursLastNight: 7 + 10 / 60,
  stress: 37,
  steps: 9184,
};
