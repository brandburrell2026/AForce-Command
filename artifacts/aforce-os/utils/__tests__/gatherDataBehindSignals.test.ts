/**
 * Show-10 ① — gatherDataBehindSignals (app-state → DataBehindSignal[]).
 * Pins SIGNAL HIERARCHY™ source selection (priority, not freshest-wins), the
 * §54 quality / §53 freshness kind mapping, honest absence (no row without a
 * candidate), and that the output composes correctly through buildDataBehindThis.
 */
import { describe, it, expect } from 'vitest';
import { gatherDataBehindSignals } from '../confidence/gatherDataBehindSignals';
import { buildDataBehindThis } from '../confidence/dataBehindThis';
import type { ProviderBiometrics } from '../../types/biometrics';

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

describe('gatherDataBehindSignals', () => {
  it('returns no rows when biometrics are absent', () => {
    expect(gatherDataBehindSignals(undefined)).toEqual([]);
    expect(gatherDataBehindSignals({})).toEqual([]);
  });

  it('emits a row per family that has a resolvable reading, in spec order', () => {
    const bio: ProviderBiometrics = {
      whoop: { providerId: 'whoop', sleepHoursLastNight: 7.5, restingHeartRate: null, fetchedAt: NOW },
      garmin: { providerId: 'garmin', restingHeartRate: 58, stepsToday: 8000, fetchedAt: NOW - 2 * HOUR },
    };
    const signals = gatherDataBehindSignals(bio);
    expect(signals.map((s) => s.label)).toEqual(['Sleep', 'Heart Rate', 'Activity']);
  });

  it('picks the source by HIERARCHY priority, not freshness (WHOOP sleep beats a fresher Garmin)', () => {
    const bio: ProviderBiometrics = {
      // Garmin sleep is FRESHER but lower priority than WHOOP on the sleep ladder.
      garmin: { providerId: 'garmin', sleepHoursLastNight: 6, fetchedAt: NOW },
      whoop: { providerId: 'whoop', sleepHoursLastNight: 8, fetchedAt: NOW - 5 * HOUR },
    };
    const [sleep] = gatherDataBehindSignals(bio);
    expect(sleep.label).toBe('Sleep');
    expect(sleep.quality).toEqual({ kind: 'sleep', source: 'whoop' });        // priority winner
    expect(sleep.freshness).toEqual({ kind: 'sleep', capturedAt: NOW - 5 * HOUR }); // its capture time
  });

  it('maps heart-rate + activity freshness onto the wearable_sync window', () => {
    const bio: ProviderBiometrics = {
      garmin: { providerId: 'garmin', restingHeartRate: 55, stepsToday: 12000, fetchedAt: NOW - HOUR },
    };
    const byLabel = Object.fromEntries(gatherDataBehindSignals(bio).map((s) => [s.label, s]));
    expect(byLabel['Heart Rate'].quality).toEqual({ kind: 'heart_rate', source: 'garmin' });
    expect(byLabel['Heart Rate'].freshness).toEqual({ kind: 'wearable_sync', capturedAt: NOW - HOUR });
    expect(byLabel.Activity.quality).toEqual({ kind: 'activity', source: 'garmin' });
    expect(byLabel.Activity.freshness).toEqual({ kind: 'wearable_sync', capturedAt: NOW - HOUR });
  });

  it('a WHOOP-only user now gets a Heart Rate row (task_c37a3c68 — WHOOP joined the HR ladder)', () => {
    // Before WHOOP was added to HEART_RATE_PRIORITY this resolved to nothing.
    const bio: ProviderBiometrics = {
      whoop: { providerId: 'whoop', restingHeartRate: 54, fetchedAt: NOW },
    };
    const byLabel = Object.fromEntries(gatherDataBehindSignals(bio).map((s) => [s.label, s]));
    expect(byLabel['Heart Rate']).toBeDefined();
    expect(byLabel['Heart Rate'].quality).toEqual({ kind: 'heart_rate', source: 'whoop' });
  });

  it('omits a family whose ladder has no candidate — never a fabricated row', () => {
    // oura is NOT a ladder source (Oura enters via Apple Health upstream), so an
    // Oura-only sleep reading resolves to nothing → no Sleep row.
    const bio: ProviderBiometrics = {
      oura: { providerId: 'oura', sleepHoursLastNight: 7, fetchedAt: NOW },
    };
    expect(gatherDataBehindSignals(bio)).toEqual([]);
  });

  it('composes end-to-end: gathered signals build into one composed chip per row', () => {
    const bio: ProviderBiometrics = {
      // whoop sleep captured now → excellent∧fresh; garmin HR 40h "sync" is stale.
      whoop: { providerId: 'whoop', sleepHoursLastNight: 8, fetchedAt: NOW },
      garmin: { providerId: 'garmin', restingHeartRate: 60, fetchedAt: NOW - 40 * HOUR },
    };
    const built = buildDataBehindThis({
      confidence: 'high',
      signals: gatherDataBehindSignals(bio),
      now: NOW,
    });
    const byLabel = Object.fromEntries(built.rows.map((r) => [r.label, r]));
    // Sleep: WHOOP wearable source → good, fresh → stays good.
    expect(byLabel.Sleep.chip.label).toBe('GOOD');
    expect(byLabel.Sleep.sourceRating).toBe('good');
    // Heart Rate: garmin wearable → good, but 40h wearable_sync (expireAfterMs 72h,
    // staleAfterMs 24h) → stale → capped DOWN to limited.
    expect(byLabel['Heart Rate'].sourceRating).toBe('good');
    expect(byLabel['Heart Rate'].freshnessRating).toBe('stale');
    expect(byLabel['Heart Rate'].chip.label).toBe('LIMITED');
  });
});
