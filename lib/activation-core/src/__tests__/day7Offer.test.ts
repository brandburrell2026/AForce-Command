import { describe, it, expect } from 'vitest';
import {
  deriveDay7Offer,
  countdownParts,
  MS_PER_DAY,
  MS_PER_HOUR,
  DEFAULT_OFFER_DAY,
  DEFAULT_WINDOW_HOURS,
} from '../day7Offer';

const ANCHOR = '2026-06-01T00:00:00.000Z';
const opensMs = Date.parse(ANCHOR) + DEFAULT_OFFER_DAY * MS_PER_DAY;
const closesMs = opensMs + DEFAULT_WINDOW_HOURS * MS_PER_HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

describe('deriveDay7Offer', () => {
  it('unanchored when the anchor is missing or unparseable (never a fabricated offer)', () => {
    for (const bad of [null, undefined, '', 'not-a-date']) {
      const s = deriveDay7Offer(bad, ANCHOR);
      expect(s.phase).toBe('unanchored');
      expect(s.opensAt).toBeNull();
      expect(s.closesAt).toBeNull();
      expect(s.isOpen).toBe(false);
      expect(s.hasExpired).toBe(false);
    }
  });

  it('pending before the offer opens: counts down to open, never claimable', () => {
    // 2 days after anchor, well before the day-7 open.
    const now = iso(Date.parse(ANCHOR) + 2 * MS_PER_DAY);
    const s = deriveDay7Offer(ANCHOR, now);
    expect(s.phase).toBe('pending');
    expect(s.isOpen).toBe(false);
    expect(s.hasExpired).toBe(false);
    expect(s.opensAt).toBe(iso(opensMs));
    expect(s.closesAt).toBe(iso(closesMs));
    expect(s.msUntilOpen).toBe(opensMs - Date.parse(now));
    expect(s.msUntilClose).toBeNull();
  });

  it('open during the claim window: counts down to close', () => {
    // 1 hour into the open window.
    const now = iso(opensMs + 1 * MS_PER_HOUR);
    const s = deriveDay7Offer(ANCHOR, now);
    expect(s.phase).toBe('open');
    expect(s.isOpen).toBe(true);
    expect(s.hasExpired).toBe(false);
    expect(s.msUntilOpen).toBeNull();
    expect(s.msUntilClose).toBe(closesMs - Date.parse(now));
  });

  it('open exactly at the opening instant (inclusive lower bound)', () => {
    const s = deriveDay7Offer(ANCHOR, iso(opensMs));
    expect(s.phase).toBe('open');
    expect(s.msUntilClose).toBe(closesMs - opensMs);
  });

  it('expired once the window has elapsed (exclusive upper bound)', () => {
    const s = deriveDay7Offer(ANCHOR, iso(closesMs));
    expect(s.phase).toBe('expired');
    expect(s.isOpen).toBe(false);
    expect(s.hasExpired).toBe(true);
    expect(s.msUntilOpen).toBeNull();
    expect(s.msUntilClose).toBeNull();
  });

  it('honors custom offerDay / windowHours, and falls back on invalid options', () => {
    const now = iso(Date.parse(ANCHOR) + 1 * MS_PER_DAY + 1);
    const s = deriveDay7Offer(ANCHOR, now, { offerDay: 1, windowHours: 24 });
    expect(s.phase).toBe('open');
    expect(s.opensAt).toBe(iso(Date.parse(ANCHOR) + 1 * MS_PER_DAY));

    // invalid options fall back to the day-7 / 72h defaults.
    const fallback = deriveDay7Offer(ANCHOR, iso(opensMs + 1), {
      offerDay: -3,
      windowHours: 0,
    });
    expect(fallback.opensAt).toBe(iso(opensMs));
    expect(fallback.closesAt).toBe(iso(closesMs));
  });
});

describe('countdownParts', () => {
  it('breaks a duration into whole d/h/m/s', () => {
    const ms = 2 * MS_PER_DAY + 3 * MS_PER_HOUR + 4 * 60 * 1000 + 5 * 1000;
    expect(countdownParts(ms)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      totalMs: ms,
    });
  });

  it('clamps negative / non-finite input to zero (never a negative countdown)', () => {
    for (const bad of [-1000, NaN, Infinity, null, undefined]) {
      expect(countdownParts(bad as number)).toEqual({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalMs: 0,
      });
    }
  });
});
