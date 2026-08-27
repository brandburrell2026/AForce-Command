/**
 * §18 INTELLIGENCE EVALUATION SUITE — tranche 1 (founder-approved lane,
 * 2026-08-27).
 *
 * Behavioral invariants over the PURE intelligence seams — never brittle
 * sentence-matching (§18's own rule). Scenarios are constructed from the
 * canonical store fixtures; the scoring engine is consumed READ-ONLY
 * (off-limits to modify — anything a scenario reveals is a REPORT, not a
 * quiet fix).
 *
 * Tranche 1 covers: first-time user / no wearable / nothing logged ·
 * signal-lattice confidence ordering · stale + future-dated provider data ·
 * extreme numerical inputs · RecoveryCommand construction invariants
 * (recheck clamp, window anchoring, no fabricated dose, the §2/§11
 * recheck-contradiction guard).
 *
 * Later tranches (harness decisions pending): duplicate-confirmation
 * idempotency (reducer seam) · command-level appropriate-silence metric ·
 * time-zone transition · calendar withdrawal · provider conflict/dedupe ·
 * prompt-injection + BOLA (api-server harness) — tracked in the program
 * ledger, added one lane at a time.
 */
import { describe, expect, it } from 'vitest';
import { calculateScore } from '../../utils/scoringEngine';
import {
  deriveCommandConfidence,
  commandConfidenceInputsFromState,
  freshBiometricAnchorMs,
} from '../../utils/scoring/commandConfidence';
import {
  buildRecoveryCommand,
  parseEngineActionCopy,
  type RecoveryCommandSource,
} from '../../utils/recovery/recoveryCommandFromStore';
import { makeUserState, FIXED_NOW } from '../../store/__tests__/_fixtures';

const NOW = FIXED_NOW;

/**
 * A member with no history, no providers, no weather — minute one, modeled
 * exactly as the store seeds it: `UserState.lastIntakeTime` is `Date` by
 * TYPE (non-null) and realApi coalesces a null profile to `new Date()` —
 * a recorded W3-PR10 decision (nullable would ripple through the scoring
 * engine's decay math). The eval suite honors that contract rather than
 * feeding the engine a state production cannot produce.
 */
function firstTimeUser() {
  return makeUserState({
    unitsConsumedToday: 0,
    aforceUnitsToday: 0,
    ozConsumedToday: 0,
    lastIntakeTime: new Date(NOW),
    intakeEvents: [] as never,
    appleHealth: undefined as never,
    biometrics: undefined as never,
    weatherTempC: undefined as never,
    weatherFetchedAt: undefined as never,
    complianceStreak: 0,
  });
}

describe('§18 — first-time user, no wearable, nothing logged', () => {
  it('the engine still produces a bounded, finite state — Foundation guidance exists', () => {
    const out = calculateScore(firstTimeUser(), NOW);
    expect(Number.isFinite(out.score)).toBe(true);
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(100);
    expect(out.performanceState.level).toBeTruthy();
    expect(out.command).toBeTruthy();
  });

  it('confidence is LOW — the system may not act confident without evidence (Final Principle)', () => {
    const inputs = commandConfidenceInputsFromState(firstTimeUser(), NOW);
    expect(inputs).toEqual({ hasTodayBehavior: false, hasFreshBiometrics: false, hasWeather: false });
    expect(deriveCommandConfidence(inputs)).toBe('low');
  });
});

describe('§18 — the confidence lattice: more real evidence never lowers confidence', () => {
  const RANK = { low: 0, medium: 1, high: 2 } as const;
  const combos: Array<[boolean, boolean, boolean]> = [];
  for (const a of [false, true]) for (const b of [false, true]) for (const c of [false, true]) combos.push([a, b, c]);

  it('monotone over every signal-superset pair (8 states, 12 covered edges)', () => {
    for (const [a, b, c] of combos) {
      for (const [a2, b2, c2] of combos) {
        const superset = (a2 || !a) && (b2 || !b) && (c2 || !c);
        if (!superset) continue;
        const lo = deriveCommandConfidence({ hasTodayBehavior: a, hasFreshBiometrics: b, hasWeather: c });
        const hi = deriveCommandConfidence({ hasTodayBehavior: a2, hasFreshBiometrics: b2, hasWeather: c2 });
        expect(RANK[hi]).toBeGreaterThanOrEqual(RANK[lo]);
      }
    }
  });

  it('behavior plus any fresh context reads high; a single signal reads medium', () => {
    expect(deriveCommandConfidence({ hasTodayBehavior: true, hasFreshBiometrics: true, hasWeather: false })).toBe('high');
    expect(deriveCommandConfidence({ hasTodayBehavior: true, hasFreshBiometrics: false, hasWeather: false })).toBe('medium');
    expect(deriveCommandConfidence({ hasTodayBehavior: false, hasFreshBiometrics: true, hasWeather: false })).toBe('medium');
  });
});

describe('§18 — stale and implausible provider data must not count as fresh', () => {
  const appleWith = (fetchedAt: number) =>
    makeUserState({
      appleHealth: {
        fetchedAt,
        sleepHours: 6.5,
        restingHeartRate: 52,
      } as never,
    });

  it('ten-day-old biometrics anchor nothing', () => {
    expect(freshBiometricAnchorMs(appleWith(NOW - 10 * 24 * 3600 * 1000), NOW)).toBeNull();
  });

  it('future-dated biometrics (broken provider clock) anchor nothing', () => {
    expect(freshBiometricAnchorMs(appleWith(NOW + 10 * 3600 * 1000), NOW)).toBeNull();
  });

  it('non-finite fetch anchors nothing', () => {
    expect(freshBiometricAnchorMs(appleWith(Number.POSITIVE_INFINITY), NOW)).toBeNull();
    expect(freshBiometricAnchorMs(appleWith(Number.NaN), NOW)).toBeNull();
  });
});

describe('§18 — extreme numerical inputs stay bounded (read-only engine consumption)', () => {
  it('absurd magnitudes cannot push the score outside [0,100] or into NaN', () => {
    const out = calculateScore(
      makeUserState({
        ozConsumedToday: 1e9,
        unitsConsumedToday: 1e6,
        overnightLossOz: 1e9,
        heatLoad: 1e9,
        sweatRate: 1e9,
        activityLevel: 1e9,
        urineSignal: 99,
        complianceStreak: 1e6,
      }),
      NOW,
    );
    expect(Number.isFinite(out.score)).toBe(true);
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(100);
  });

  it('zeroed magnitudes cannot push the score below 0 or into NaN', () => {
    const out = calculateScore(
      makeUserState({ ozConsumedToday: 0, unitsConsumedToday: 0, overnightLossOz: 0, urineSignal: 1 }),
      NOW,
    );
    expect(Number.isFinite(out.score)).toBe(true);
    expect(out.score).toBeGreaterThanOrEqual(0);
  });
});

describe('§18 — RecoveryCommand construction invariants', () => {
  const src = (over: Partial<RecoveryCommandSource> = {}): RecoveryCommandSource => ({
    commandId: 'cmd-eval-1',
    title: 'Start with water',
    instruction: 'Drink 12 oz of water now.',
    primaryActionLabel: "I've had the water",
    rationale: 'Behind pace for the morning window.',
    recheckInSeconds: 900,
    sourceVersion: 'eval-1',
    ...over,
  });

  it('a negative recheck clamps to zero — a command can never count backwards', () => {
    const cmd = buildRecoveryCommand(src({ recheckInSeconds: -30 }), NOW);
    expect(Date.parse(cmd.recheckAt as unknown as string)).toBeGreaterThanOrEqual(NOW);
  });

  it('elapsed time anchors createdAt so window = elapsed + remaining (spec §11 agreement)', () => {
    const cmd = buildRecoveryCommand(src({ recheckInSeconds: 300, elapsedSeconds: 600 }), NOW);
    const created = Date.parse(cmd.createdAt as unknown as string);
    const recheck = Date.parse(cmd.recheckAt as unknown as string);
    expect(created).toBe(NOW - 600_000);
    expect(recheck).toBe(NOW + 300_000);
    expect(recheck - created).toBe(900_000);
  });

  it('no dose is ever fabricated — quantity absent stays absent', () => {
    const cmd = buildRecoveryCommand(src(), NOW);
    expect(cmd.quantity).toBeUndefined();
  });

  it('the §2/§11 contradiction guard: "Recheck in …" never survives into the instruction', () => {
    const parsed = parseEngineActionCopy('Start with water — 20 oz now. Recheck in 15 minutes.');
    expect(parsed.instruction).not.toMatch(/recheck/i);
    expect(parsed.title.toLowerCase()).toContain('start with water');
  });
});
