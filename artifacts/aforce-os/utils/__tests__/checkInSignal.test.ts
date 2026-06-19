import { describe, it, expect } from 'vitest';
import {
  deriveCheckInSignalQuality,
  CHECKIN_FRESH_MINUTES,
  CHECKIN_STALE_MINUTES,
} from '../impact/checkInSignal';

describe('checkInSignal · deriveCheckInSignalQuality', () => {
  it('contributes nothing when no check-in was completed', () => {
    const r = deriveCheckInSignalQuality({ completedToday: false });
    expect(r.signalConfidence).toBe(0);
    expect(r.freshness).toBe('none');
  });

  it('a fresh, complete check-in is high confidence', () => {
    const r = deriveCheckInSignalQuality({
      completedToday: true,
      ageMinutes: 10,
      answeredCount: 3,
    });
    expect(r.signalConfidence).toBeGreaterThan(0.85);
    expect(r.signalConfidence).toBeLessThanOrEqual(1);
    expect(r.freshness).toBe('fresh');
  });

  it('produces a value in [0,1]', () => {
    for (const age of [0, 100, 300, 720, 5000]) {
      for (const answered of [0, 1, 2, 3]) {
        const r = deriveCheckInSignalQuality({
          completedToday: true,
          ageMinutes: age,
          answeredCount: answered,
        });
        expect(r.signalConfidence).toBeGreaterThanOrEqual(0);
        expect(r.signalConfidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it('fewer answered questions lowers confidence', () => {
    const full = deriveCheckInSignalQuality({ completedToday: true, ageMinutes: 10, answeredCount: 3 });
    const partial = deriveCheckInSignalQuality({ completedToday: true, ageMinutes: 10, answeredCount: 1 });
    expect(full.signalConfidence).toBeGreaterThan(partial.signalConfidence);
  });

  it('staleness decays confidence monotonically', () => {
    const fresh = deriveCheckInSignalQuality({ completedToday: true, ageMinutes: CHECKIN_FRESH_MINUTES });
    const mid = deriveCheckInSignalQuality({ completedToday: true, ageMinutes: (CHECKIN_FRESH_MINUTES + CHECKIN_STALE_MINUTES) / 2 });
    const stale = deriveCheckInSignalQuality({ completedToday: true, ageMinutes: CHECKIN_STALE_MINUTES });
    expect(fresh.signalConfidence).toBeGreaterThan(mid.signalConfidence);
    expect(mid.signalConfidence).toBeGreaterThan(stale.signalConfidence);
    expect(fresh.freshness).toBe('fresh');
    expect(stale.freshness).toBe('stale');
  });

  it('treats a check-in past the fresh window as stale', () => {
    const r = deriveCheckInSignalQuality({ completedToday: true, ageMinutes: CHECKIN_FRESH_MINUTES + 1 });
    expect(r.freshness).toBe('stale');
  });

  it('defaults missing age to fresh and missing answeredCount to 3', () => {
    const r = deriveCheckInSignalQuality({ completedToday: true });
    expect(r.freshness).toBe('fresh');
    expect(r.signalConfidence).toBeGreaterThan(0.85);
  });
});
