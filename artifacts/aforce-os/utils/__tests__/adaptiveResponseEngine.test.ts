import { describe, it, expect } from 'vitest';
import { deriveAdaptiveResponseProfile } from '../intelligence/adaptiveResponseEngine';
import type { CommandEvent } from '../intelligence/commandEvents';
import { RESPONSE_CATEGORIES } from '../../types/adaptiveResponse';
import {
  ADAPTIVE_RESPONSE_MIN_SAMPLES,
  ADAPTIVE_RESPONSE_CONFIDENCE_FULL_SAMPLES,
} from '../../config/hydroStateModel';

const NOW = 1_700_000_000_000;

function conf(id: string, day: number, followed: boolean, commandType?: string): CommandEvent {
  return {
    id,
    kind: 'command_confirmation',
    occurredAtMs: NOW - 1000,
    localDayIndex: day,
    source: 'test',
    followed,
    // delta present on purpose — the engine must ignore it (Score-Protection).
    delta: 999,
    ...(commandType !== undefined ? { commandType } : {}),
  };
}

function checkin(id: string, day: number, energy: number): CommandEvent {
  return {
    id,
    kind: 'voice_checkin',
    occurredAtMs: NOW - 1000,
    localDayIndex: day,
    source: 'test',
    energy,
    stress: 2,
  };
}

describe('Section 59 — Adaptive Response Engine', () => {
  it('returns all 11 categories, all insufficient, on an empty ledger (no fabrication)', () => {
    const profile = deriveAdaptiveResponseProfile([], NOW);
    expect(Object.keys(profile).sort()).toEqual([...RESPONSE_CATEGORIES].sort());
    for (const c of RESPONSE_CATEGORIES) {
      expect(profile[c]).toMatchObject({ status: 'insufficient', sampleSize: 0, whatWorked: null, confidenceAfterAction: null });
    }
  });

  it('marks a category ready only at/above the sample threshold', () => {
    const below = Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES - 1 }, (_, i) =>
      conf(`h${i}`, i + 1, true, 'hydration_maintain'),
    );
    expect(deriveAdaptiveResponseProfile(below, NOW).hydration.status).toBe('insufficient');

    const atThreshold = Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) =>
      conf(`h${i}`, i + 1, true, 'hydration_maintain'),
    );
    const ready = deriveAdaptiveResponseProfile(atThreshold, NOW).hydration;
    expect(ready.status).toBe('ready');
    expect(ready.sampleSize).toBe(ADAPTIVE_RESPONSE_MIN_SAMPLES);
    expect(ready.whatWorked).toMatchObject({ followed: ADAPTIVE_RESPONSE_MIN_SAMPLES, followedRate: 1 });
    expect(ready.confidenceAfterAction).toBeCloseTo(
      ADAPTIVE_RESPONSE_MIN_SAMPLES / ADAPTIVE_RESPONSE_CONFIDENCE_FULL_SAMPLES,
    );
  });

  it('derives an "improved" outcome when action-day energy beats other-day energy', () => {
    const events: CommandEvent[] = [
      ...Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) =>
        conf(`h${i}`, i + 1, true, 'hydration_maintain'),
      ),
      ...Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) => checkin(`ce${i}`, i + 1, 5)),
      checkin('cx', 99, 2),
    ];
    expect(deriveAdaptiveResponseProfile(events, NOW).hydration.whatWorked?.outcome).toBe('improved');
  });

  it('reports outcome "unknown" when there is no self-reported energy to link (no fabrication)', () => {
    const events = Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) =>
      conf(`h${i}`, i + 1, true, 'hydration_maintain'),
    );
    expect(deriveAdaptiveResponseProfile(events, NOW).hydration.whatWorked?.outcome).toBe('unknown');
  });

  it('maps recovery_reset → recovery and performance_activation → training', () => {
    const rec = Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) => conf(`r${i}`, i + 1, true, 'recovery_reset'));
    const trn = Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) => conf(`t${i}`, i + 1, true, 'performance_activation'));
    const profile = deriveAdaptiveResponseProfile([...rec, ...trn], NOW);
    expect(profile.recovery.status).toBe('ready');
    expect(profile.training.status).toBe('ready');
  });

  it('ignores confirmations with unknown/missing commandType', () => {
    const events = [
      ...Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) => conf(`u${i}`, i + 1, true, 'not_a_category')),
      conf('n1', 1, true),
    ];
    const profile = deriveAdaptiveResponseProfile(events, NOW);
    for (const c of RESPONSE_CATEGORIES) expect(profile[c].status).toBe('insufficient');
  });

  it('drops events outside the rolling window', () => {
    const stale = Array.from({ length: ADAPTIVE_RESPONSE_MIN_SAMPLES }, (_, i) => ({
      ...conf(`s${i}`, i + 1, true, 'hydration_maintain'),
      occurredAtMs: NOW - 60 * 24 * 60 * 60 * 1000, // 60 days ago
    }));
    expect(deriveAdaptiveResponseProfile(stale, NOW).hydration.status).toBe('insufficient');
  });
});
