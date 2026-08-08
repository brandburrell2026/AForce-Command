/**
 * `computeRecoverySignal`'s legacy single-provider (`state.appleHealth`)
 * fallback — RC-2 #595 verdict, item S2.
 *
 * This branch hand-rolls the same HRV / Sleep hint strings as
 * `utils/biometricsAggregator.ts`'s multi-provider path, but had NOT been
 * normalized to the spaced unit convention (`HRV 65 ms`, not `HRV 65ms`)
 * when Ruling C's unit-spacing sweep (#586, then #595) normalized the
 * aggregator. No prior test in this repo pinned this branch's hint text, so
 * the drift shipped unnoticed. This file locks the now-normalized strings
 * (Ruling E: "clean up unit spacing") so the two branches can't silently
 * drift apart again.
 */
import { describe, it, expect } from 'vitest';
import { computeRecoverySignal } from '../scoring/breakdown';
import type { UserState } from '../../types';

const NOW = 1_700_000_000_000;

// Casts through `unknown`, mirroring the sibling `commandConfidence.test.ts`
// / `scoreClockDeterminism.test.ts` fixtures — `computeRecoverySignal` only
// reads `state.biometrics` and `state.appleHealth`, so the rest of
// `UserState` is irrelevant noise for this suite.
const mk = (appleHealth: Record<string, unknown> | undefined): UserState =>
  ({ appleHealth, biometrics: undefined } as unknown as UserState);

describe('computeRecoverySignal — legacy appleHealth fallback hint spacing (RC-2 #595 verdict S2)', () => {
  it('spaces the HRV unit — high band', () => {
    const r = computeRecoverySignal(mk({ hrvSdnn: 65, fetchedAt: NOW }));
    expect(r.hint).toContain('HRV 65 ms (high)');
    expect(r.hint).not.toContain('65ms');
  });

  it('spaces the HRV unit — mid band (no qualifier)', () => {
    const r = computeRecoverySignal(mk({ hrvSdnn: 45, fetchedAt: NOW }));
    expect(r.hint).toContain('HRV 45 ms');
    expect(r.hint).not.toContain('45ms');
  });

  it('spaces the HRV unit — low band', () => {
    const r = computeRecoverySignal(mk({ hrvSdnn: 20, fetchedAt: NOW }));
    expect(r.hint).toContain('HRV 20 ms (low)');
    expect(r.hint).not.toContain('20ms');
  });

  it('spaces the sleep unit — short band', () => {
    const r = computeRecoverySignal(mk({ sleepHoursLastNight: 5, fetchedAt: NOW }));
    expect(r.hint).toContain('Sleep 5.0 h (short)');
    expect(r.hint).not.toContain('5.0h');
  });

  it('spaces the sleep unit — deficit band', () => {
    const r = computeRecoverySignal(mk({ sleepHoursLastNight: 3, fetchedAt: NOW }));
    expect(r.hint).toContain('Sleep 3.0 h (deficit)');
    expect(r.hint).not.toContain('3.0h');
  });

  it('spaces the sleep unit — optimal band (no qualifier)', () => {
    const r = computeRecoverySignal(mk({ sleepHoursLastNight: 8, fetchedAt: NOW }));
    expect(r.hint).toContain('Sleep 8.0 h');
    expect(r.hint).not.toContain('8.0h');
  });
});
