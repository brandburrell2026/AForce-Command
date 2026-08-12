/**
 * circleV3Presentation — unit tests (founder comp 2026-08-12 revision).
 * The contract under test: the You card mirrors the live-injected snapshot
 * row (ranks from the engine's re-rank, band accent via the shared module),
 * rows carry the comp's fields (verified, streak/title subtitles, band-
 * tinted scores, movement arrows), tabs slice the same snapshot (friends =
 * your team's roster re-ranked), and the own-baseline challenge never
 * invents a number without rollups.
 */
import { describe, it, expect } from 'vitest';

import { af } from '@/theme';
import { buildSnapshot } from '@/services/competitionEngine';
import { buildCircleV3Model, type CircleV3Inputs } from '../circleV3Presentation';

function snapshot(liveScore = 92) {
  return buildSnapshot({
    liveUserScore: liveScore,
    liveCompliance: 0.9,
    liveConsistency: 96,
    liveStateLabel: 'PEAK',
  });
}

function inputs(overrides: Partial<CircleV3Inputs> = {}): CircleV3Inputs {
  return {
    snapshot: snapshot(),
    cityOverride: null,
    hydrationDaysThisWeek: 5,
    tab: 'rank',
    ...overrides,
  };
}

describe('buildCircleV3Model — You card', () => {
  it('mirrors the live-injected snapshot row: band, ranks, spec score, delta pill', () => {
    const m = buildCircleV3Model(inputs());
    expect(m.you.name).toBe('You');
    expect(m.you.bandKey).toBe('peak');
    expect(m.you.accent).toBe(af.green);
    expect(m.you.cityLine).toBe('Miami, FL');
    // Ranks come from the engine's re-rank over the live-injected row.
    expect(m.you.globalRank).toBeGreaterThanOrEqual(1);
    expect(m.you.cityRank).toBeGreaterThanOrEqual(1);
    expect(m.you.teamRank).toBeGreaterThanOrEqual(1);
    // Spec formula over live values (0.35·92 + 0.25·90 + 0.20·96 + 0.20·82).
    const me = inputs().snapshot.context.user;
    expect(m.you.score).toBe(me.competitionScore);
    // Was 12: the mock's fabricated "+12 spots" was removed (founder ruling —
    // rank movement against other people is not a claim any source supports),
    // so the delta is now 0 and the pill collapses to null.
    expect(m.you.deltaSpots).toBeNull();
  });

  it('reports no rank at all when there is nobody else in the cohort', () => {
    const base = snapshot();
    const solo = {
      ...base,
      individuals: base.individuals.filter((u) => u.id === base.context.user.id),
    };
    const m = buildCircleV3Model(inputs({ snapshot: solo }));
    // The engine's context still hands over a rank; the view model refuses it
    // — a rank is a claim about others, and there are none. fmtRank → '—'.
    expect(typeof base.context.globalRank).toBe('number');
    expect(m.you.globalRank).toBeNull();
    expect(m.you.cityRank).toBeNull();
    expect(m.you.stateRank).toBeNull();
    expect(m.you.teamRank).toBeNull();
    // Your own score is real and survives — only the comparison is withheld.
    expect(m.you.score).toBe(base.context.user.competitionScore);
  });

  it('prefers the real server city when present', () => {
    const m = buildCircleV3Model(inputs({ cityOverride: 'Fort Lauderdale' }));
    expect(m.you.cityLine).toBe('Fort Lauderdale, FL');
  });
});

describe('buildCircleV3Model — rank rows (the comp leaderboard)', () => {
  const m = buildCircleV3Model(inputs());

  it('renders the full ranked cohort with You highlighted in place', () => {
    expect(m.rows.length).toBe(inputs().snapshot.individuals.length);
    expect(m.rows.filter((r) => r.isYou)).toHaveLength(1);
    // Ranks are the engine's, contiguous from 1.
    expect(m.rows.map((r) => r.rank)).toEqual(m.rows.map((_, i) => i + 1));
  });

  it('carries the comp fields: verified, title/city subtitles, streaks, movement', () => {
    const jordan = m.rows.find((r) => r.name === 'Jordan A.')!;
    expect(jordan).toMatchObject({
      verified: true,
      subtitleLeft: 'Miami, FL',
      streakDays: 7,
      move: { dir: 'up', n: 3 },
    });
    const alicia = m.rows.find((r) => r.name === 'Alicia R.')!;
    expect(alicia.subtitleLeft).toBe('Perfect Hydration'); // title wins over city
    expect(alicia.move).toEqual({ dir: 'flat', n: 0 });
    const sasha = m.rows.find((r) => r.name === 'Sasha P.')!;
    expect(sasha.move).toEqual({ dir: 'down', n: 1 });
  });

  it('tints scores by each row band through the shared accent module', () => {
    const jordan = m.rows.find((r) => r.name === 'Jordan A.')!;
    const cam = m.rows.find((r) => r.name === 'Cam B.')!;
    const tyler = m.rows.find((r) => r.name === 'Tyler M.')!;
    expect(jordan.scoreAccent).toBe(af.green); // PEAK
    expect(cam.scoreAccent).toBe(af.cyan); // BALANCED
    expect(tyler.scoreAccent).toBe(af.amber); // RECOVERING
  });
});

describe('buildCircleV3Model — tabs', () => {
  it('cities slices the ranked city table', () => {
    const m = buildCircleV3Model(inputs({ tab: 'cities' }));
    expect(m.rows.length).toBe(inputs().snapshot.cities.length);
    expect(m.rows[0]!.rank).toBe(1);
    expect(m.rows.some((r) => r.isYou)).toBe(true); // your city highlighted
  });

  it('friends is your team roster re-ranked within the team', () => {
    const m = buildCircleV3Model(inputs({ tab: 'friends' }));
    expect(m.rows.length).toBeGreaterThan(1);
    expect(m.rows.every((r, i) => r.rank === i + 1)).toBe(true);
    expect(m.rows.filter((r) => r.isYou)).toHaveLength(1);
  });

  it('challenge renders no list rows', () => {
    expect(buildCircleV3Model(inputs({ tab: 'challenge' })).rows).toEqual([]);
  });
});

describe('buildCircleV3Model — own-baseline hydration challenge', () => {
  it('is a real days-out-of-7 percentage', () => {
    const m = buildCircleV3Model(inputs({ hydrationDaysThisWeek: 5 }));
    expect(m.challengePct).toBe(71);
    expect(m.hydrationDays).toBe(5);
  });

  it('is omitted, never invented, without rollups', () => {
    const m = buildCircleV3Model(inputs({ hydrationDaysThisWeek: null }));
    expect(m.challengePct).toBeNull();
  });
});
