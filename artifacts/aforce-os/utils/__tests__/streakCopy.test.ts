/**
 * Section 63 — streak-copy language guard.
 *
 * The rule (spec §63, applied to EVERY streak display, not Cruise-only):
 * a streak surface never threatens loss of a streak if a day is missed and
 * never uses do-not-break-the-chain framing. A missed day is a new cycle,
 * framed neutrally; progress carries forward.
 *
 * This test builds a corpus of the real streak-context strings from both
 * sources — the RN-component copy (via the pure `streakCopy` builders) and
 * the i18n bundle (locales/en.json) — and asserts none of them match any
 * loss-threat / chain pattern. It also pins the reframes made in this pass.
 */
import { describe, it, expect } from 'vitest';
import en from '../../locales/en.json';
import {
  athleteModeSub, athleteModeRemaining, streakHeroHeadline, streakHeroSub,
} from '../streak/streakCopy';

// Loss-threat / chain framing. The corpus is already streak-scoped, so these
// stay strict without risking false hits on unrelated copy ("sodium lost").
const LOSS_THREAT: RegExp[] = [
  /\bbreak(ing)? the chain\b/i,
  /\bdon'?t (break|lose|miss)\b/i,
  /\b(lose|lost|losing|loses) (your |the |this |a )?(streak|chain|progress|momentum)\b/i,
  /\bstreak (ends|ended|will end|resets?|is over|broke|broken|gone|disappears?)\b/i,
  /\byou'?ll lose\b/i,
  /\bor (you )?(lose|forfeit)\b/i,
  /\bforfeit\b/i,
  /\bkeep (it|the streak|your streak)[^.]*\bor\b/i,
];

// The streak semantic field — any string that talks about the streak surface.
const STREAK_FIELD = /(streak|the chain|momentum|carr(y|ies|ied) forward)/i;

/** Recursively collect every streak-context string value in the i18n bundle. */
function collectStreakStrings(node: unknown, keyPath = ''): string[] {
  if (typeof node === 'string') {
    return STREAK_FIELD.test(node) || /streak/i.test(keyPath) ? [node] : [];
  }
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>)
      .flatMap(([k, v]) => collectStreakStrings(v, `${keyPath}.${k}`));
  }
  return [];
}

// Component-rendered streak copy, exercised across the states a user hits:
// fresh (0), first day (1), mid-run (5), at a milestone, and top reached.
const componentCopy: string[] = [
  athleteModeSub(0, 7), athleteModeSub(1, 7), athleteModeSub(5, 14), athleteModeSub(90, 90),
  athleteModeRemaining({ achievedTop: false, daysRemaining: 6 }),
  athleteModeRemaining({ achievedTop: false, daysRemaining: 1 }),
  athleteModeRemaining({ achievedTop: true, daysRemaining: 0 }),
  streakHeroHeadline(0), streakHeroHeadline(7),
  streakHeroSub(0), streakHeroSub(4),
];

const i18nCopy = collectStreakStrings(en);
const corpus = [...componentCopy, ...i18nCopy];

describe('Section 63 — streak copy never threatens loss', () => {
  it('collects a real, non-trivial streak-copy corpus (guard is not vacuous)', () => {
    // sanity: both sources contributed
    expect(componentCopy.length).toBeGreaterThan(6);
    expect(i18nCopy.length).toBeGreaterThan(3);
  });

  it('no streak string anywhere uses loss-threat or break-the-chain framing', () => {
    const offenders = corpus.filter((s) => LOSS_THREAT.some((re) => re.test(s)));
    expect(offenders).toEqual([]);
  });

  it('every loss-threat pattern is exercised against the whole corpus', () => {
    for (const s of corpus) {
      for (const re of LOSS_THREAT) {
        expect(s).not.toMatch(re);
      }
    }
  });
});

describe('Section 63 — reframes are in place', () => {
  it('a missed day (streak 0) reads as a fresh cycle, never "0-day streak"', () => {
    expect(athleteModeSub(0, 7)).toBe('New cycle · target 7');
    expect(athleteModeSub(0, 7)).not.toMatch(/0-day/);
  });

  it('an active streak still states the count and target plainly', () => {
    expect(athleteModeSub(5, 14)).toBe('5-day streak · target 14');
  });

  it('the milestone line keeps aspirational "days remaining" (kept by decision)', () => {
    expect(athleteModeRemaining({ achievedTop: false, daysRemaining: 3 })).toBe('3 days remaining');
    expect(athleteModeRemaining({ achievedTop: false, daysRemaining: 1 })).toBe('1 day remaining');
    expect(athleteModeRemaining({ achievedTop: true, daysRemaining: 0 })).toBe('Top milestone reached');
  });

  it('StreakHero active state carries forward; empty state is a plain start', () => {
    expect(streakHeroSub(4)).toContain('Carried forward');
    expect(streakHeroSub(0)).toBe('Log an intake to begin.');
    expect(streakHeroHeadline(0)).toBe('Begin your first cycle');
  });

  it('next-week consistency nudge uses carries-forward framing, not build-your-streak', () => {
    const line = (en as Record<string, any>).reports.sections.nextWeekFocus.consistency as string;
    expect(line).toContain('carries forward');
    expect(line).not.toMatch(/build your streak/i);
  });
});
