/**
 * LANE A — a fresh behavioural event must not launder stale environmental
 * evidence into appearing current.
 *
 * The Night Out card carries one freshness line. It was computed as the
 * FRESHEST of two unlike things: `lastIntakeTime` (something the member just
 * DID) and `weatherFetchedAt` (something the world last TOLD us). Taking the
 * max means the most recent signal speaks for the whole card — so logging a
 * drink rewrote "Updated 180 min ago" into "Updated just now" while the
 * conditions behind the command were three hours stale.
 *
 * Nothing about the environment changed. The member simply had a drink, and
 * the card began describing old weather as current.
 *
 * THE REPAIR IS TIMESTAMP SEMANTICS ONLY: the line reports the WEAKEST link
 * among the signals actually present, because it is a claim about the picture
 * behind the command, not about its most flattering component. No copy is
 * rewritten, no UI is added, no confidence rule moves.
 */
import { describe, it, expect } from 'vitest';
import { evidenceAgeMs, freshnessLabel } from '../../services/nightOut/commandPresentation';
import { weatherFreshWindowMs } from '../environment/weatherFreshness';
import { CLOCK_SKEW_MS } from '../environment/environmentalEvidence';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);
const MIN = 60_000;
const WINDOW = weatherFreshWindowMs();

/** The label a member actually reads, for a given pair of signal ages. */
const labelFor = (intakeAgeMs: number | null, weatherAgeMs: number | null) => {
  const sources = {
    lastIntakeTime: intakeAgeMs == null ? null : new Date(T0 - intakeAgeMs),
    weatherTempC: weatherAgeMs == null ? null : 30,
    weatherFetchedAt: weatherAgeMs == null ? null : T0 - weatherAgeMs,
  };
  // Confidence is held at a non-`low` level throughout: this lane is about the
  // TIMESTAMP, and routing through the low-confidence copy would mask it.
  return freshnessLabel(evidenceAgeMs(sources, T0), 'medium');
};

// ── 1 · the defect ──────────────────────────────────────────────────────────

describe('LAW 1 — a fresh drink cannot make stale weather read as current', () => {
  it('THE REPRODUCTION: 3-hour-old weather + a drink just logged', () => {
    // Before the repair this returned 'Updated just now'.
    const label = labelFor(30_000, 3 * 60 * MIN);
    expect(label).not.toBe('Updated just now');
    expect(label).toBe('Updated 180 min ago');
  });

  it('and logging a drink does not IMPROVE the stated freshness', () => {
    // The sharpest statement of the defect: same weather, the only difference
    // is whether the member happened to log something. The line must not move.
    const withoutDrink = labelFor(3 * 60 * MIN, 3 * 60 * MIN);
    const withDrink = labelFor(10_000, 3 * 60 * MIN);
    expect(withDrink).toBe(withoutDrink);
  });

  it('across the whole range — a drink never buys a better number', () => {
    for (const weatherAge of [2 * MIN, 45 * MIN, WINDOW, WINDOW + CLOCK_SKEW_MS + MIN, 9 * 60 * MIN]) {
      const stale = evidenceAgeMs(
        { lastIntakeTime: new Date(T0 - weatherAge), weatherTempC: 30, weatherFetchedAt: T0 - weatherAge },
        T0,
      );
      const drinkJustNow = evidenceAgeMs(
        { lastIntakeTime: new Date(T0 - 1_000), weatherTempC: 30, weatherFetchedAt: T0 - weatherAge },
        T0,
      );
      expect(drinkJustNow, `weather ${weatherAge / MIN} min old`).toBe(stale);
    }
  });
});

// ── 2 · it still tells the truth in the other direction ─────────────────────

describe('LAW 2 — the line is not merely pessimistic', () => {
  it('everything genuinely fresh still reads "just now"', () => {
    expect(labelFor(20_000, 30_000)).toBe('Updated just now');
  });

  it('no weather at all — the line describes the intake it actually has', () => {
    // Absence must not be punished as staleness: with no environmental signal
    // present there is no weaker link to report.
    expect(labelFor(20_000, null)).toBe('Updated just now');
    expect(labelFor(40 * MIN, null)).toBe('Updated 40 min ago');
  });

  it('weather present but no intake — the weather age is reported honestly', () => {
    expect(labelFor(null, 25 * MIN)).toBe('Updated 25 min ago');
  });

  it('no signals at all — nothing is claimed', () => {
    expect(evidenceAgeMs({ lastIntakeTime: null, weatherTempC: null, weatherFetchedAt: null }, T0))
      .toBeNull();
    expect(labelFor(null, null)).toBe('Waiting for fresher confirmed signals');
  });

  it('and low confidence still overrides the line entirely', () => {
    // Untouched by this lane — pinned so the repair cannot be mistaken for a
    // change to the confidence path.
    expect(freshnessLabel(30_000, 'low')).toBe('Waiting for fresher confirmed signals');
  });
});

// ── 3 · the weakest link is the rule ────────────────────────────────────────

describe('LAW 3 — the line reports the picture, not its best part', () => {
  it('whichever signal is older governs, in both orders', () => {
    expect(labelFor(90 * MIN, 5 * MIN)).toBe('Updated 90 min ago');
    expect(labelFor(5 * MIN, 90 * MIN)).toBe('Updated 90 min ago');
  });

  it('a weather timestamp without a reading is not a signal', () => {
    // An anchor with no value behind it describes nothing, and must not drag
    // the line down as though it were evidence the member is missing.
    const label = freshnessLabel(
      evidenceAgeMs({ lastIntakeTime: new Date(T0 - 20_000), weatherTempC: null, weatherFetchedAt: T0 - 5 * 60 * MIN }, T0),
      'medium',
    );
    expect(label).toBe('Updated just now');
  });

  it('a non-positive weather epoch is a sentinel, not an instant', () => {
    // The same rule PR5.1 unified across the freshness classifiers. Counted as
    // a real timestamp it would make the weakest link ~56 years old and render
    // "Updated 29768000 min ago" beside a live command.
    const label = freshnessLabel(
      evidenceAgeMs({ lastIntakeTime: new Date(T0 - 20_000), weatherTempC: 30, weatherFetchedAt: 0 }, T0),
      'medium',
    );
    expect(label).toBe('Updated just now');
    expect(evidenceAgeMs({ weatherTempC: 30, weatherFetchedAt: -1 }, T0)).toBeNull();
  });

  it('a future-dated signal never produces a negative age', () => {
    expect(evidenceAgeMs({ lastIntakeTime: new Date(T0 + 10 * MIN) }, T0)).toBe(0);
  });

  it('an unparseable intake timestamp is ignored, not counted as now', () => {
    expect(evidenceAgeMs({ lastIntakeTime: 'not-a-date', weatherTempC: 30, weatherFetchedAt: T0 - 12 * MIN }, T0))
      .toBe(12 * MIN);
  });
});
