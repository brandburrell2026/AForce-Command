/**
 * Section 63 — streak-copy language guard.
 *
 * The rule (spec §63, applied to EVERY streak display, not Cruise-only):
 * a streak surface never threatens loss of a streak if a day is missed and
 * never uses do-not-break-the-chain framing. A missed day is a new cycle,
 * framed neutrally; the copy is additive, never a continuity/loss claim.
 *
 * The guard builds a corpus of the real streak-context strings from BOTH
 * sources — the RN-component copy (via the pure `streakCopy` builders) and
 * EVERY shipped locale bundle — and asserts none match a loss-threat / chain
 * pattern. It also proves its own detector fires (positive control), so a
 * neutered regex can't leave the suite green while catching nothing.
 *
 * Note: the loss-threat patterns are English. Scanning every locale guards the
 * English-fallback locales (which ship literal English today) against a
 * regression; semantic review of fully-translated locales is a separate
 * localization gate, not this unit test.
 */
import { describe, it, expect } from 'vitest';
import ar from '../../locales/ar.json';
import de from '../../locales/de.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import hi from '../../locales/hi.json';
import itLocale from '../../locales/it.json';
import ja from '../../locales/ja.json';
import ko from '../../locales/ko.json';
import pt from '../../locales/pt.json';
import zh from '../../locales/zh.json';
import {
  athleteModeSub, athleteModeRemaining, streakHeroHeadline, streakHeroSub,
} from '../streak/streakCopy';

const LOCALES: Record<string, unknown> = { ar, de, en, es, fr, hi, it: itLocale, ja, ko, pt, zh };

// Loss-threat / chain framing. Corpus is streak-scoped, so these stay strict
// without false hits on unrelated copy ("sodium lost", physiological "decay").
const LOSS_THREAT: RegExp[] = [
  /\bbreak(ing)? the chain\b/i,
  /\bdon'?t (break|lose|miss)\b/i,
  /\b(lose|lost|losing|loses) (your |the |this |a )?(streak|chain|progress|momentum)\b/i,
  /\byou lose\b/i,
  /\byou'?ll lose\b/i,
  /\bor (you )?(lose|forfeit)\b/i,
  /\bforfeit\b/i,
  // preservation-urgency — the most common streak dark pattern
  /\b(keep|save|protect)[^.]*\bstreak\b/i,
  /\bstreak[^.]*\b(alive|at risk|in jeopardy|on the line|slipping|about to)\b/i,
  /\bstreak (will |could |might |is )?(disappear|vanish|reset(s|ting)?|ends?|ending|break(s|ing)?|be lost|gone|over)\b/i,
  // reset / start-over framing
  /\breset(s|ting)? (to|back to) (zero|day (one|1|zero))\b/i,
  /\bback to (zero|day (one|1|zero)|the start|square one)\b/i,
  /\bstart(ing)? (over|from zero|again)\b/i,
  /\bslip(ping| away)\b/i,
];

// The streak semantic field — broadened past the topic word so a loss-threat
// phrased WITHOUT "streak" (e.g. "back to day one") still enters the corpus.
const STREAK_FIELD =
  /(streak|the chain|momentum|carr(y|ies|ied) forward|back to day|day one\b|start over|starting over|in a row|keep it going|on a roll)/i;

/** Recursively collect every streak-context string value in a bundle. */
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

// Component-rendered streak copy across the states a user actually hits —
// fresh (0), first day (1), mid-run, milestone, top reached — PLUS invalid
// inputs (negative / NaN / Infinity) so a dropped clamp can't ship garbage.
const componentCopy: string[] = [
  athleteModeSub(0, 7), athleteModeSub(1, 7), athleteModeSub(5, 14), athleteModeSub(90, 90),
  athleteModeSub(-1, 7), athleteModeSub(NaN, 7), athleteModeSub(Infinity, 7),
  athleteModeRemaining({ achievedTop: false, daysRemaining: 6 }),
  athleteModeRemaining({ achievedTop: false, daysRemaining: 1 }),
  athleteModeRemaining({ achievedTop: false, daysRemaining: -1 }),
  athleteModeRemaining({ achievedTop: true, daysRemaining: 0 }),
  streakHeroHeadline(0), streakHeroHeadline(1), streakHeroHeadline(7), streakHeroHeadline(-3),
  streakHeroSub(0), streakHeroSub(1), streakHeroSub(4), streakHeroSub(NaN),
];

const i18nByLocale = Object.fromEntries(
  Object.entries(LOCALES).map(([code, bundle]) => [code, collectStreakStrings(bundle)]),
);
const i18nCopy = Object.values(i18nByLocale).flat();
const corpus = [...componentCopy, ...i18nCopy];

describe('Section 63 — streak copy never threatens loss', () => {
  it('collects a real, non-trivial corpus from both sources and every locale', () => {
    expect(componentCopy.length).toBeGreaterThan(12);
    // every locale contributed at least the reframed nudge + a count string
    for (const [code, strings] of Object.entries(i18nByLocale)) {
      expect(strings.length, `locale ${code}`).toBeGreaterThan(0);
    }
  });

  it('the guarded corpus contains the known streak-vocabulary keys (collection can’t silently drop them)', () => {
    // The reframed nudge is deliberately NOT here — it no longer mentions the
    // streak, so it isn't a streak-surface string; it's guarded directly by the
    // per-locale reframe test below. These two DO name the streak and must be
    // collected, proving the walker reaches real streak copy.
    expect(i18nCopy).toContain((en as any).coach.pattern_streak as string);
    expect(i18nCopy).toContain((en as any).reports.sections.habitVelocity.streak as string);
  });

  it('no streak string in any source or locale uses loss-threat / break-the-chain framing', () => {
    const offenders = corpus.filter((s) => LOSS_THREAT.some((re) => re.test(s)));
    expect(offenders).toEqual([]);
  });

  it('every loss-threat pattern is exercised against the whole corpus', () => {
    for (const s of corpus) {
      for (const re of LOSS_THREAT) {
        expect(s, s).not.toMatch(re);
      }
    }
  });
});

describe('Section 63 — the detector actually fires (positive control)', () => {
  // If any of these known dark patterns stops matching, a regex was neutered.
  const KNOWN_BAD = [
    "Don't break the chain.",
    "You'll lose your streak.",
    'You lose your progress.',
    'Keep your streak alive — log today.',
    'Save your streak before midnight.',
    'Your streak is at risk.',
    'Your streak will disappear if you miss.',
    'Streak resets tonight.',
    'Miss today and reset to zero.',
    'Back to day one.',
    'Log daily or you forfeit it.',
    "Don't let your momentum slip away.",
  ];
  it('each known loss-threat string matches at least one pattern', () => {
    for (const bad of KNOWN_BAD) {
      expect(LOSS_THREAT.some((re) => re.test(bad)), bad).toBe(true);
    }
  });
});

describe('Section 63 — reframes are in place (no false continuity claim)', () => {
  it('a missed day (streak 0) reads as a fresh cycle, never "0-day streak"', () => {
    expect(athleteModeSub(0, 7)).toBe('New cycle · target 7');
    expect(athleteModeSub(0, 7)).not.toMatch(/0-day/);
  });

  it('an active streak states the count and target plainly', () => {
    expect(athleteModeSub(5, 14)).toBe('5-day streak · target 14');
  });

  it('the milestone line keeps aspirational "days remaining" (kept by decision)', () => {
    expect(athleteModeRemaining({ achievedTop: false, daysRemaining: 3 })).toBe('3 days remaining');
    expect(athleteModeRemaining({ achievedTop: false, daysRemaining: 1 })).toBe('1 day remaining');
    expect(athleteModeRemaining({ achievedTop: true, daysRemaining: 0 })).toBe('Top milestone reached');
  });

  it('the empty headline is "a new cycle", never "first" (true for a returning-after-miss user)', () => {
    expect(streakHeroHeadline(0)).toBe('Begin a new cycle');
    expect(streakHeroHeadline(0)).not.toMatch(/first/i);
  });

  it('StreakHero makes NO carried-forward continuity claim (unbacked until decay ships)', () => {
    // day 1 is "building" (no span-implying "holding"); 2+ is "holding"
    expect(streakHeroSub(1)).toBe('Recovery rhythm building. Every day counts.');
    expect(streakHeroSub(2)).toBe('Recovery rhythm holding. Every day counts.');
    expect(streakHeroSub(4)).not.toMatch(/carried forward|carries forward|from yesterday/i);
    expect(streakHeroSub(0)).toBe('Log an intake to begin.');
  });

  it('the next-week nudge is additive in EVERY locale — no "build your streak", no "carries forward"', () => {
    for (const [code, bundle] of Object.entries(LOCALES)) {
      const line = (bundle as any).reports?.sections?.nextWeekFocus?.consistency as string | undefined;
      if (!line) continue;
      expect(line, `locale ${code}`).not.toMatch(/build your streak/i);
      expect(line, `locale ${code}`).not.toMatch(/carries forward/i);
    }
  });

  it('invalid builder inputs collapse to the neutral zero state, never render NaN/Infinity', () => {
    expect(athleteModeSub(Infinity, 7)).toBe('New cycle · target 7');
    expect(athleteModeSub(NaN, 7)).toBe('New cycle · target 7');
    expect(athleteModeSub(-5, 7)).toBe('New cycle · target 7');
    expect(streakHeroHeadline(Infinity)).toBe('Begin a new cycle');
    expect(corpus.join(' ')).not.toMatch(/NaN|Infinity/);
  });
});
