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
 * Tranche 2 (2026-08-27): duplicate-confirmation idempotency — full
 * lifecycle compositions over the pure outbox core (the unit suite owns
 * the primitives; these pin the multi-step §18 scenarios: double-tap,
 * crash mid-sync, late duplicate, API-failure storm, overlay honesty).
 *
 * Tranche 3 (2026-08-27, founder-ratified silence definition):
 * appropriate silence = maintain-class command + no interruption planned.
 * Compositions only — the commandCategory and momentNotifications unit
 * suites own the primitives. The Stage-4 silence/intervention COUNTERS
 * are founder-held for Stage 4; nothing here fakes them.
 *
 * Later tranches (harness decisions pending): time-zone transition ·
 * calendar withdrawal · provider conflict/dedupe · prompt-injection +
 * BOLA (api-server harness) — tracked in the program ledger, one lane
 * at a time.
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

// ─── Tranche 2 — duplicate-confirmation idempotency (§6 + §18) ────────────────
import {
  mergeOutboxItems,
  markSyncing,
  markSynced,
  markFailed,
  dueItems,
  pruneSynced,
  pendingOverlay,
  type OutboxItem,
} from '../../utils/intakeOutbox';

function outboxItem(cid: string, overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    prepared: {
      clientEventId: cid,
      fluidType: 'water',
      ozAmount: 16,
      scoreBefore: 90,
      scoreAfter: 92,
      event: {
        id: `evt-${cid}`,
        fluidType: 'water',
        oz: 16,
        loggedAt: new Date(NOW).toISOString(),
        baseImpact: 5,
        capAdjusted: 5,
        immediate: 3,
        delayed: 2,
        delayedDurationMin: 30,
        heatGuardActiveAtLog: false,
        scoreBeforeAtLog: 90,
      },
    },
    status: 'pending',
    attempts: 0,
    createdAtMs: NOW,
    nextAttemptAtMs: NOW,
    ...overrides,
  } as OutboxItem;
}

describe('§18 — a double-tapped confirmation credits exactly once, end to end', () => {
  it('same clientEventId enqueued twice + a disk replay + a sync cycle -> one item, frozen scores verbatim', () => {
    const tap1 = outboxItem('cid-double');
    const tap2 = outboxItem('cid-double'); // the second tap of the same confirmation
    let queue = mergeOutboxItems([tap1], [tap2]);
    expect(queue).toHaveLength(1);

    // App restarts mid-queue: the persisted copy replays into the merge.
    queue = mergeOutboxItems(queue, [outboxItem('cid-double')]);
    expect(queue).toHaveLength(1);

    queue = markSynced(markSyncing(queue, 'cid-double'), 'cid-double');
    expect(queue).toHaveLength(1);
    expect(queue[0]?.status).toBe('synced');
    // Score-Protection: the frozen numbers replayed byte-identically —
    // nothing along the lifecycle recomputed them.
    expect(queue[0]?.prepared.scoreBefore).toBe(90);
    expect(queue[0]?.prepared.scoreAfter).toBe(92);
  });
});

describe('§18 — a crash mid-sync neither strands nor duplicates the intake', () => {
  it("an item killed while 'syncing' is still one item, still unsynced, and becomes due again", () => {
    const inFlight = markSyncing([outboxItem('cid-crash')], 'cid-crash');
    // Restart: the disk copy (still status syncing) merges with itself.
    const afterRestart = mergeOutboxItems(inFlight, [inFlight[0]]);
    expect(afterRestart).toHaveLength(1);
    expect(afterRestart[0]?.status).not.toBe('synced');
    // Once its retry time passes it is offered to the flusher again —
    // replaying is safe because the server dedupes on clientEventId.
    expect(dueItems(afterRestart, NOW + 1)).toHaveLength(1);
  });
});

describe('§18 — a late duplicate can never double-credit a confirmed intake', () => {
  it('a synced item wins over a stale pending copy of the same confirmation', () => {
    const confirmed = markSynced(markSyncing([outboxItem('cid-late')], 'cid-late'), 'cid-late');
    const staleDuplicate = outboxItem('cid-late'); // e.g. an old persisted copy
    const merged = mergeOutboxItems(confirmed, [staleDuplicate]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe('synced');
  });

  it('pruning after reconcile leaves nothing that could replay the credit', () => {
    const confirmed = markSynced([outboxItem('cid-pruned')], 'cid-pruned');
    expect(pruneSynced(confirmed)).toHaveLength(0);
  });
});

describe('§18 — an API-failure storm retries without losing identity or the queue', () => {
  it('attempts increment, the schedule never moves backwards, and the payload stays byte-stable', () => {
    let queue: OutboxItem[] = [outboxItem('cid-storm')];
    let lastNext = queue[0]!.nextAttemptAtMs;
    for (let n = 0; n < 6; n += 1) {
      queue = markFailed(queue, 'cid-storm', NOW + n);
      const it = queue[0]!;
      expect(queue).toHaveLength(1);
      expect(it.status).toBe('failed');
      expect(it.attempts).toBe(n + 1);
      expect(it.nextAttemptAtMs).toBeGreaterThanOrEqual(lastNext);
      lastNext = it.nextAttemptAtMs;
      expect(it.prepared.clientEventId).toBe('cid-storm');
      expect(it.prepared.event.id).toBe('evt-cid-storm');
      expect(it.prepared.scoreAfter).toBe(92);
    }
    // Still queued for the flusher once its backoff passes — never dropped.
    expect(dueItems(queue, lastNext + 1)).toHaveLength(1);
  });
});

describe('§18 — the offline overlay never fabricates "today" numbers', () => {
  it('stale items still count on the badge but contribute no numeric delta', () => {
    const fresh = outboxItem('cid-fresh');
    const stale = outboxItem('cid-stale', {
      createdAtMs: NOW - 48 * 3600 * 1000,
      nextAttemptAtMs: NOW - 48 * 3600 * 1000,
    });
    stale.prepared.event.loggedAt = new Date(NOW - 48 * 3600 * 1000).toISOString();
    const overlay = pendingOverlay([fresh, stale], NOW);
    expect(overlay.count).toBe(2);
    expect(overlay.ozPending).toBe(16); // the fresh 16 oz only
    expect(overlay.unitsPending).toBe(1);
  });
});

// ─── Tranche 3 — appropriate silence (§10, founder-ratified definition) ──────
import { categorizeCommand } from '../../utils/intelligence/commandCategory';
import { planMomentNotifications, DEFAULT_MOMENT_NOTIFY_PREFS } from '../momentNotifications';
import type { Moment } from '../../types/moments';

/** A member genuinely on track: target nearly met, intake minutes ago. */
function onTrackUser() {
  return makeUserState({
    ozConsumedToday: 90,
    unitsConsumedToday: 7,
    aforceUnitsToday: 3,
    lastIntakeTime: new Date(NOW - 10 * 60 * 1000),
    urineSignal: 3,
    symptomState: 'none',
  });
}

function moment(id: string, startAtIso: string, over: Partial<Moment> = {}): Moment {
  return {
    id,
    source: 'manual',
    title: `Moment ${id}`,
    type: 'work',
    importance: 'high',
    startAtIso,
    ...over,
  } as Moment;
}

// The planner's quiet window wraps 22:00→07:00 local; keep every scenario
// fire-time inside the local afternoon so quiet-hours (unit-covered) never
// interferes with what these compositions assert.
const DAY = new Date(NOW);
DAY.setHours(12, 0, 0, 0);
const T0 = DAY.getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('§10 — silence is reachable from the real engine, and need is never silenced', () => {
  it('an on-track member resolves to a maintain-class command — "nothing needed" exists', () => {
    const out = calculateScore(onTrackUser(), NOW);
    const category = categorizeCommand({
      level: out.performanceState.level,
      score: out.score,
      urgencyLevel: out.command.urgencyLevel,
    });
    expect(['hydration_maintain', 'performance_activation']).toContain(category);
  });

  it('the inverse guard: a depleted member is never silenced (Water-First)', () => {
    const out = calculateScore(
      makeUserState({
        ozConsumedToday: 0,
        unitsConsumedToday: 0,
        aforceUnitsToday: 0,
        lastIntakeTime: new Date(NOW - 9 * 3600 * 1000),
        urineSignal: 6,
      }),
      NOW,
    );
    const category = categorizeCommand({
      level: out.performanceState.level,
      score: out.score,
      urgencyLevel: out.command.urgencyLevel,
    });
    expect(['hydration_urgent', 'recovery_reset']).toContain(category);
    expect(category).not.toBe('performance_activation');
  });
});

describe('§10 — the full silent day: prepared moments + on-track state plan ZERO interruptions', () => {
  it('every moment already prepared -> empty plan (silence is a computed outcome)', () => {
    const moments = [
      moment('m1', iso(T0 + 3 * 3600 * 1000), { preparedAtIso: iso(T0) }),
      moment('m2', iso(T0 + 5 * 3600 * 1000), { preparedAtIso: iso(T0) }),
      moment('m3', iso(T0 + 7 * 3600 * 1000), { preparedAtIso: iso(T0) }),
    ];
    const plan = planMomentNotifications(moments, DEFAULT_MOMENT_NOTIFY_PREFS, iso(T0));
    expect(plan).toEqual([]);
  });

  it('no eligible evidence at all -> empty plan, not a guessed ping', () => {
    expect(planMomentNotifications([], DEFAULT_MOMENT_NOTIFY_PREFS, iso(T0))).toEqual([]);
  });
});

describe('§10 — the attention budget holds under calendar pressure', () => {
  it('eight eligible important moments still plan at most the daily cap, spaced and chronological', () => {
    const moments = Array.from({ length: 8 }, (_, i) =>
      moment(`p${i}`, iso(T0 + (2 + i) * 3600 * 1000)),
    );
    const plan = planMomentNotifications(moments, DEFAULT_MOMENT_NOTIFY_PREFS, iso(T0));
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(3);
    const fires = plan.map((pl) => Date.parse(pl.fireAtIso));
    for (let i = 1; i < fires.length; i += 1) {
      expect(fires[i]! - fires[i - 1]!).toBeGreaterThanOrEqual(60 * 60 * 1000);
      expect(fires[i]!).toBeGreaterThan(fires[i - 1]!);
    }
  });
});
