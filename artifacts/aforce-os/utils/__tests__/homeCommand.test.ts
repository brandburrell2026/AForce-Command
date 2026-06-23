import { describe, it, expect } from 'vitest';
import {
  homeCommand,
  type HomeCommand,
  type HomeCommandInput,
} from '../homeCommand';

/**
 * homeCommand is the pure Phase 3 helper that derives the single Home command.
 * These tests cover the spec's verification points that apply to the helper:
 *   - priority order (water > recovery > protocol > scan)
 *   - Score-Protection (read-only; never mutates inputs)
 *   - product support never appears before the water command
 *   - the primary CTA is always behavior-first
 */

const VALID_ACTIONS = ['log_water', 'start_protocol', 'scan_drink', 'recover'];
const VALID_CTA_LABELS = ['LOG WATER', 'START PROTOCOL', 'SCAN DRINK', 'RECOVER NOW'];
// Words that would signal a product-first command — must never appear.
const PRODUCT_WORDS = ['buy', 'shop', 'subscribe', 'bundle', 'purchase', 'product', 'aforce stick', 'rtd'];

// A score that lands in OPTIMAL (>= 85) and an "on pace" intake recency so the
// water branch yields and lower-priority branches can be exercised.
const OPTIMAL_ON_PACE: HomeCommandInput = {
  score: 92,
  minutesSinceLastIntake: 10,
  unitsConsumedToday: 64,
};

function allOutputs(): HomeCommand[] {
  const out: HomeCommand[] = [];
  for (const score of [0, 15, 29, 30, 49, 50, 69, 70, 84, 85, 95, 100]) {
    for (const mins of [null, 0, 30, 59, 60, 120]) {
      for (const inRecoveryWindow of [false, true]) {
        for (const protocolAvailable of [false, true]) {
          out.push(homeCommand({ score, minutesSinceLastIntake: mins, inRecoveryWindow, protocolAvailable }));
        }
      }
    }
  }
  return out;
}

describe('homeCommand — priority order', () => {
  it('leads with WATER whenever the band is below optimal (correction)', () => {
    for (const score of [0, 29, 30, 49, 50, 69, 70, 84]) {
      const cmd = homeCommand({ score, minutesSinceLastIntake: 10, inRecoveryWindow: true, protocolAvailable: true });
      expect(cmd.priority).toBe('water');
      expect(cmd.actionType).toBe('log_water');
    }
  });

  it('leads with WATER when behind pace even at an optimal score', () => {
    const cmd = homeCommand({ score: 95, minutesSinceLastIntake: 120, inRecoveryWindow: true, protocolAvailable: true });
    expect(cmd.priority).toBe('water');
  });

  it('leads with WATER when nothing has been logged yet today', () => {
    const cmd = homeCommand({ score: 95, minutesSinceLastIntake: null, inRecoveryWindow: true, protocolAvailable: true });
    expect(cmd.priority).toBe('water');
  });

  it('falls to RECOVERY when optimal + on pace + recovery window open', () => {
    const cmd = homeCommand({ ...OPTIMAL_ON_PACE, inRecoveryWindow: true, protocolAvailable: true });
    expect(cmd.priority).toBe('recovery');
    expect(cmd.actionType).toBe('recover');
  });

  it('falls to PROTOCOL when optimal + on pace + no recovery + protocol available', () => {
    const cmd = homeCommand({ ...OPTIMAL_ON_PACE, inRecoveryWindow: false, protocolAvailable: true });
    expect(cmd.priority).toBe('protocol');
    expect(cmd.actionType).toBe('start_protocol');
  });

  it('falls to SCAN only when nothing else is due', () => {
    const cmd = homeCommand({ ...OPTIMAL_ON_PACE, inRecoveryWindow: false, protocolAvailable: false });
    expect(cmd.priority).toBe('scan');
    expect(cmd.actionType).toBe('scan_drink');
  });

  it('water beats recovery, recovery beats protocol, protocol beats scan', () => {
    // water > recovery
    expect(homeCommand({ score: 60, minutesSinceLastIntake: 10, inRecoveryWindow: true }).priority).toBe('water');
    // recovery > protocol
    expect(homeCommand({ ...OPTIMAL_ON_PACE, inRecoveryWindow: true, protocolAvailable: true }).priority).toBe('recovery');
    // protocol > scan
    expect(homeCommand({ ...OPTIMAL_ON_PACE, protocolAvailable: true }).priority).toBe('protocol');
  });
});

describe('homeCommand — Water-First / unitsConsumedToday pace', () => {
  it('leads with WATER when no fluid has been logged today, even optimal + on pace', () => {
    // Optimal score AND a recent last-intake timestamp, but zero real units →
    // water must still lead (no water logged yet = behind pace).
    const cmd = homeCommand({
      score: 95,
      minutesSinceLastIntake: 10,
      unitsConsumedToday: 0,
      inRecoveryWindow: true,
      protocolAvailable: true,
    });
    expect(cmd.priority).toBe('water');
    expect(cmd.actionType).toBe('log_water');
  });

  it('lets lower-priority commands surface once real fluid is logged + on pace', () => {
    // Same optimal/on-pace state but with real units logged → water yields,
    // proving unitsConsumedToday actually gates the water branch.
    const cmd = homeCommand({
      score: 95,
      minutesSinceLastIntake: 10,
      unitsConsumedToday: 32,
      inRecoveryWindow: false,
      protocolAvailable: false,
    });
    expect(cmd.priority).toBe('scan');
  });
});

describe('homeCommand — Water-First / no product before water', () => {
  it('never emits product-first copy in any reachable command', () => {
    for (const cmd of allOutputs()) {
      const haystack = `${cmd.eyebrow} ${cmd.title} ${cmd.body} ${cmd.ctaLabel}`.toLowerCase();
      for (const word of PRODUCT_WORDS) {
        expect(haystack.includes(word)).toBe(false);
      }
    }
  });

  it('the water command leads with hydration language', () => {
    const cmd = homeCommand({ score: 55, minutesSinceLastIntake: 90 });
    expect(cmd.title.toLowerCase()).toContain('hydrate now');
    expect(cmd.body.toLowerCase()).toContain('water');
  });
});

describe('homeCommand — behavior-first CTA', () => {
  it('every command uses a behavior-first action + CTA label', () => {
    for (const cmd of allOutputs()) {
      expect(VALID_ACTIONS).toContain(cmd.actionType);
      expect(VALID_CTA_LABELS).toContain(cmd.ctaLabel);
    }
  });
});

describe('homeCommand — Score-Protection (read-only)', () => {
  it('does not mutate its input', () => {
    const input: HomeCommandInput = {
      score: 42,
      unitsConsumedToday: 16,
      minutesSinceLastIntake: 75,
      inRecoveryWindow: true,
      protocolAvailable: true,
    };
    const snapshot = JSON.stringify(input);
    homeCommand(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('is deterministic and returns a fresh object each call', () => {
    const input: HomeCommandInput = { score: 95, minutesSinceLastIntake: 5 };
    const a = homeCommand(input);
    const b = homeCommand(input);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('handles non-finite scores safely (degrades to a water command)', () => {
    const cmd = homeCommand({ score: Number.NaN, minutesSinceLastIntake: 10 });
    expect(cmd.priority).toBe('water');
  });
});
