/**
 * P0 LAW — UNKNOWN ≠ ZERO ≠ DEPLETED, enforced at the command authority.
 *
 * THE DEFECT THESE LAWS PIN. Executed on the real production path, a member
 * AForce had never observed and a genuinely depleted member with three days of
 * history and a urine reading of 7 produced BYTE-IDENTICAL commands:
 * `cmd-depleted`, "Recovery needed: 20 oz water + 2 sticks.", urgency critical,
 * "+18 to score". Home simultaneously rendered "Building your baseline —
 * AForce is learning how your body responds" directly above it, because the
 * Wave-5 evidence gate covered the hero and the command lane never consulted it.
 *
 * WHY THE LAWS LIVE HERE. `utils/scoring/__tests__/` matches NO include glob in
 * vitest.config.ts — a law placed beside the source would silently never run,
 * a trap that config documents three separate times. `utils/__tests__/` IS
 * matched.
 *
 * WHY THESE ASSERT THROUGH `calculateScore` AND NOT `generateCommand`. Nine
 * surfaces read `engineOutput.command` directly. Testing the generator in
 * isolation would prove the branch exists while leaving the engine free to
 * hand a DEPLETED command to all nine. These laws therefore drive the same
 * entry point the store drives.
 */
import { describe, it, expect } from 'vitest';
import { resolveInitialUserState } from '../../data/initialUserState';
import { calculateScore } from '../scoringEngine';
import { computeEventImpact } from '../../services/hydrationScoreService';
import { resolveHomeEvidence, countRealHistoryEntries } from '../../components/home/homeBaselineState';
import i18n from '../../services/i18nService';
import {
  resolveHydroEvidence,
  EVIDENCE_UNKNOWN,
  EVIDENCE_OBSERVED,
} from '../scoring/hydroEvidence';

const NOW = new Date('2026-09-04T15:00:00.000Z');
const H = 3_600_000;

const realHistory = (d: number) => ({
  id: `h${d}`, timestamp: new Date(NOW.getTime() - d * 86_400_000),
  score: 80, state: 'BALANCED', action: 'Logged', unitsTaken: 1, isSynthetic: false,
});

/** Built by the CANONICAL production builder so materialization is real. */
function makeEvent(agoH: number, oz: number, prior: unknown[], scoreBefore: number) {
  const at = new Date(NOW.getTime() - agoH * H);
  const i = computeEventImpact('water' as never, undefined, oz, prior as never, at,
    { heatGuardActive: false, scoreBefore });
  return {
    id: `e${agoH}`, fluidType: 'water', oz, loggedAt: at,
    baseImpact: i.baseImpact, capAdjusted: i.capAdjusted, immediate: i.immediate,
    delayed: i.delayed, delayedDurationMin: i.delayedDurationMin,
    heatGuardActiveAtLog: false, scoreBeforeAtLog: scoreBefore,
  };
}

const SEED = () => resolveInitialUserState(false) as unknown as Record<string, unknown>;

interface Member { state: Record<string, unknown>; history: unknown[] }

/** Row 1 — nothing ever observed. */
const unknownMember = (): Member => ({ state: { ...SEED(), lastIntakeTime: NOW }, history: [] });

/** Row 2 — observed member who genuinely drank nothing today. */
const measuredZeroMember = (): Member => ({
  state: { ...SEED(), ozConsumedToday: 0, intakeEvents: [], lastIntakeTime: new Date(NOW.getTime() - 30 * H) },
  history: [realHistory(1), realHistory(2)] as unknown[],
});

/** Row 4 — observed and genuinely depleted. */
const trueDepletedMember = (): Member => {
  const old = makeEvent(40, 8, [], 40);
  return {
    state: { ...SEED(), ozConsumedToday: 8, unitsConsumedToday: 1, intakeEvents: [old],
      lastIntakeTime: old.loggedAt, urineSignal: 7, symptomState: 'mild', symptoms: ['headache'] },
    history: [realHistory(1), realHistory(2), realHistory(3)] as unknown[],
  };
};

/** Drives the engine exactly as the store does — evidence resolved, then passed. */
function run(m: Member) {
  const evidence = resolveHydroEvidence({
    intakeEventCount: (m.state['intakeEvents'] as unknown[])?.length ?? 0,
    loggedDayCount: countRealHistoryEntries(m.history as never),
  });
  return { evidence, out: calculateScore(m.state as never, NOW.getTime(), evidence) };
}

const BAND_WORDS = /\b(DEPLETED|RECOVERING|BALANCED|PEAK)\b/i;
const OUNCES = /(\d+(?:\.\d+)?)\s*(oz|ounce)/i;
/**
 * A PRODUCT PRESCRIPTION — not merely the brand name.
 *
 * A first draft of this banned the bare word "aforce" and false-positived on
 * "AForce personalizes guidance from what it observes", where the brand is the
 * SUBJECT OF A SENTENCE, not a thing being pushed. Banning the company's own
 * name outright is the same over-broad-regex mistake that made an acceptance
 * checker fail forever on `aforceUnitsToday`.
 *
 * So this matches the prescription vocabulary itself, plus the brand only when
 * it modifies a product noun. "Add an AForce stick" is caught twice over;
 * "AForce is learning" is legal.
 */
const PRODUCT = /\b(sticks?|sachets?|electrolytes?|powder|tablets?)\b|\baforce\s+(stick|product|unit)/i;
const SCORE_CLAIM = /[+-]\s*\d+\s*(to score|points|pts)/i;

describe('LAW 1 — UNKNOWN is not ZERO', () => {
  it('an unobserved member and a measured-zero member get DIFFERENT commands', () => {
    const unknown = run(unknownMember());
    const zero = run(measuredZeroMember());

    expect(unknown.evidence.kind).toBe('unknown');
    expect(zero.evidence.kind).toBe('observed');

    // The defect was these being byte-identical.
    expect(unknown.out.command.id).not.toBe(zero.out.command.id);
    expect(unknown.out.command.action).not.toBe(zero.out.command.action);
    expect(unknown.out.command.urgencyLevel).not.toBe(zero.out.command.urgencyLevel);
  });

  it('MEASURED ZERO REMAINS A REAL OBSERVATION — still the depleted command', () => {
    // The repair must not "fix" a legitimate zero into an unknown. A member who
    // has been observed and drank nothing IS depleted, and must be told so.
    const zero = run(measuredZeroMember());
    expect(zero.out.command.id).toBe('cmd-depleted');
    expect(zero.out.performanceState.level).toBe('DEPLETED');
    expect(zero.out.command.action).toMatch(OUNCES);
  });
});

describe('LAW 2 — UNKNOWN is not DEPLETED', () => {
  it('an unobserved member never receives the depleted command', () => {
    const { out } = run(unknownMember());
    expect(out.command.id).not.toBe('cmd-depleted');
    expect(out.command.id).toBe('cmd-baseline-unknown');
  });

  it('and never receives ANY band-derived command id', () => {
    const { out } = run(unknownMember());
    for (const banned of ['cmd-depleted', 'cmd-recovering', 'cmd-balanced', 'cmd-peak']) {
      expect(out.command.id).not.toBe(banned);
    }
  });
});

describe('LAW 3 — no physiological verdict without evidence', () => {
  it('no band word appears anywhere in the visible command', () => {
    const { out } = run(unknownMember());
    const visible = `${out.command.action} ${out.command.explanation}`;
    expect(visible).not.toMatch(BAND_WORDS);
  });

  it('urgency is not escalated from HydroState', () => {
    const { out } = run(unknownMember());
    expect(out.command.urgencyLevel).not.toBe('critical');
    expect(out.command.urgencyLevel).not.toBe('high');
  });

  it('THE OVERLAY CANNOT SMUGGLE STATE-DERIVED COPY BACK IN', () => {
    // composeExplanation folds heat, time-of-day and streak into the
    // explanation. Ungated it appended "It's late, and this window sets up
    // your tomorrow." onto the baseline command — the same fabrication one
    // field over.
    //
    // ASSERTED AS EXACT EQUALITY, NOT AS A KEYWORD SCAN. A first draft grepped
    // for /it's late|streak|heat/ and SURVIVED the mutation that removes the
    // gate, because those phrases are time-of-day and weather dependent and
    // simply were not produced at this fixture's timestamp. A keyword scan can
    // only catch the appends it happens to enumerate, on the clock it happens
    // to run. Equality catches every append, at every hour.
    const { out } = run(unknownMember());
    expect(out.command.explanation).toBe(i18n.t('coach.baseline_explanation'));
  });

  it('and the overlay stays gated at EVERY hour of the day', () => {
    // Belt and braces for the time-dependence that hid the survivor: drive the
    // same unobserved member around the clock and require the explanation to
    // never pick up a single extra character.
    const m = unknownMember();
    const baseline = i18n.t('coach.baseline_explanation');
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(Date.UTC(2026, 8, 4, hour, 0, 0)).getTime();
      const out = calculateScore(m.state as never, at, EVIDENCE_UNKNOWN);
      expect(out.command.explanation, `hour ${hour} appended overlay copy`).toBe(baseline);
    }
  });
});

describe('LAW 4 — no dose and no product without evidence', () => {
  it('prescribes no ounces', () => {
    const { out } = run(unknownMember());
    expect(`${out.command.action} ${out.command.explanation}`).not.toMatch(OUNCES);
  });

  it('PRESCRIBES NO STICKS OR PRODUCT — the commercial line', () => {
    // "Recovery needed: 20 oz water + 2 sticks" to a body never measured is a
    // product push dressed as physiology. The brand name must not appear either.
    const { out } = run(unknownMember());
    expect(`${out.command.action} ${out.command.explanation}`).not.toMatch(PRODUCT);
  });
});

describe('LAW 5 — no score-impact claim without evidence', () => {
  it('estimatedImpact carries no numeric promise', () => {
    const { out } = run(unknownMember());
    expect(out.command.estimatedImpact).not.toMatch(SCORE_CLAIM);
    expect(out.command.estimatedImpact).toBe('');
  });

  it('and the visible copy makes none either', () => {
    const { out } = run(unknownMember());
    expect(`${out.command.action} ${out.command.explanation}`).not.toMatch(SCORE_CLAIM);
  });
});

describe('LAW 6 — Home and the command authority cannot contradict each other', () => {
  it('whenever the hero withholds the reading, the command is the baseline one', () => {
    const m = unknownMember();
    const heroEvidence = resolveHomeEvidence({
      intakeEventCount: (m.state['intakeEvents'] as unknown[])?.length ?? 0,
      loggedDayCount: countRealHistoryEntries(m.history as never),
    });
    const { out } = run(m);

    // The exact contradiction that made this defect visible on screen.
    expect(heroEvidence).not.toBe('established');
    expect(out.command.id).toBe('cmd-baseline-unknown');
  });

  it('and whenever the hero shows the reading, the command is band-derived', () => {
    const m = measuredZeroMember();
    const heroEvidence = resolveHomeEvidence({
      intakeEventCount: (m.state['intakeEvents'] as unknown[])?.length ?? 0,
      loggedDayCount: countRealHistoryEntries(m.history as never),
    });
    expect(heroEvidence).toBe('established');
    expect(run(m).out.command.id).toBe('cmd-depleted');
  });
});

describe('LAW 7 — genuine observed DEPLETED is untouched', () => {
  it('a truly depleted observed member keeps the existing command verbatim', () => {
    const { out } = run(trueDepletedMember());
    expect(out.command.id).toBe('cmd-depleted');
    expect(out.command.urgencyLevel).toBe('critical');
    expect(out.command.estimatedImpact).toBe('+18 to score');
    expect(out.command.action).toMatch(OUNCES);
    expect(out.command.action).toMatch(PRODUCT);
  });
});

describe('LAW 8 — GOLDEN: the default preserves every existing caller', () => {
  it('omitting evidence is byte-identical to passing observed', () => {
    // This is what protects rows 2-4 across the whole app: every call site that
    // does not pass evidence keeps today's behaviour exactly.
    for (const m of [measuredZeroMember(), trueDepletedMember()]) {
      const withDefault = calculateScore(m.state as never, NOW.getTime());
      const explicit = calculateScore(m.state as never, NOW.getTime(), EVIDENCE_OBSERVED);
      expect(JSON.stringify(withDefault.command)).toBe(JSON.stringify(explicit.command));
      expect(withDefault.score).toBe(explicit.score);
      expect(withDefault.performanceState.level).toBe(explicit.performanceState.level);
    }
  });

  it('EVIDENCE NEVER MOVES THE SCORE OR THE BAND — only the command', () => {
    // Score-Protection: the epistemic tag gates INTERPRETATION, never math.
    const m = unknownMember();
    const asUnknown = calculateScore(m.state as never, NOW.getTime(), EVIDENCE_UNKNOWN);
    const asObserved = calculateScore(m.state as never, NOW.getTime(), EVIDENCE_OBSERVED);
    expect(asUnknown.score).toBe(asObserved.score);
    expect(asUnknown.performanceState.level).toBe(asObserved.performanceState.level);
    expect(asUnknown.command.id).not.toBe(asObserved.command.id);
  });
});

describe('LAW 9 — the voice coach cannot speak a verdict it has not earned', () => {
  it('THE EXACT FIELDS voiceService reads are safe for an unobserved member', () => {
    // services/voiceService.ts:112 sends `command_action` and :489-490 sends
    // `urgency` + `commandAction` — it speaks `command.action` VERBATIM. Before
    // this repair a member AForce had never observed would have HEARD
    // "Recovery needed: 20 oz water + 2 sticks." out loud on first launch.
    // Asserting the precise fields the voice path reads, not a proxy.
    const { out } = run(unknownMember());
    const spoken = out.command.action;

    expect(spoken).not.toMatch(OUNCES);
    expect(spoken).not.toMatch(PRODUCT);
    expect(spoken).not.toMatch(BAND_WORDS);
    expect(spoken).not.toMatch(/recovery needed/i);
    expect(out.command.urgencyLevel).toBe('low');
  });
});

describe('LAW 10 — no second command source', () => {
  it('the baseline command comes from the same authority and satisfies Command', () => {
    const { out } = run(unknownMember());
    // Same shape, same field set — a consumer cannot tell it apart structurally,
    // which is what makes a parallel recommendation system unnecessary.
    expect(Object.keys(out.command).sort()).toEqual(
      ['action', 'estimatedImpact', 'explanation', 'id', 'urgencyLevel'].sort(),
    );
    expect(typeof out.command.action).toBe('string');
    expect(out.command.action.length).toBeGreaterThan(0);
  });

  it('the unknown arm carries NO score field to misread', () => {
    // Structural: the tagged union has nothing numeric on the unknown arm, so a
    // consumer cannot recover a band from it by reading a property.
    expect(Object.keys(EVIDENCE_UNKNOWN)).toEqual(['kind']);
    expect((EVIDENCE_UNKNOWN as Record<string, unknown>)['score']).toBeUndefined();
  });
});
