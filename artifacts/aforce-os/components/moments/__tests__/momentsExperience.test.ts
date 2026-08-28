/**
 * AForce Moments — Wave-5 experience + a11y guards.
 *
 * Every Moments surface is a CONNECTED screen (expo-router, the app store, the
 * moments store, i18n), so none of them can be mounted here — the convention
 * documented in `components/home/__tests__/homeScreenV2Wiring.test.ts` and
 * `components/ui/__tests__/AFCommandCard.wiring.test.ts` applies: the pure
 * DECISIONS are unit-tested where they live (momentsPresentation, covered in
 * momentsCore.test.ts) and this file pins that the screens actually consume
 * them, and that the removals stayed removed.
 *
 * What it locks:
 *   1. Home shows the NEXT moment SINGULAR — the TODAY'S MOMENTS list, its
 *      section label and its "View all" action are gone, and only one quiet
 *      link keeps the overview reachable.
 *   2. Moments stays visually subordinate to Home's command card.
 *   3. MomentDetailScreen's three audit defects: 44pt feedback pills, ritual
 *      stages as single accessibility elements, state that is announced and
 *      never carried by colour alone.
 *   4. MomentsScreen's UP NEXT has ONE priority card, not N equal ones.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import en from '../../../locales/en.json';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const read = (file: string) => strip(readFileSync(join(__dirname, '..', file), 'utf8'));

const HOME_SECTION = read('HomeMomentsSection.tsx');
const NEXT_CARD = read('NextMomentCard.tsx');
const DETAIL = read('MomentDetailScreen.tsx');
const OVERVIEW = read('MomentsScreen.tsx');

const moments = (en as { moments: Record<string, unknown> }).moments;

describe('Home — the NEXT moment, singular', () => {
  it('mounts one moment card and nothing that lists the rest', () => {
    expect(HOME_SECTION).toContain('<NextMomentCard');
    expect(HOME_SECTION).not.toContain('TodaysMomentsList');
    // The list component itself is gone, not merely unmounted.
    expect(NEXT_CARD).not.toContain('TodaysMomentsList');
  });

  it('says nothing until the store is hydrated (never flashes an empty doorway)', () => {
    expect(HOME_SECTION).toMatch(/if \(!data\.hydrated\) return null;/);
  });

  it('with no imminent moment, offers ONLY the subtle doorway — never a card or a list', () => {
    // Founder ruling 2026-08-28: keep the single-NEXT experience, but a member
    // who wants to inspect upcoming moments gets one quiet, persistent way in.
    // The no-next branch renders the parametrized AllTodayLink and nothing else
    // (no NextMomentCard, no list).
    expect(HOME_SECTION).toMatch(/if \(!data\.next\) \{\s*return <AllTodayLink labelKey="moments\.home_entry" \/>;\s*\}/);
    // The full card is still gated on an actual next moment.
    expect(HOME_SECTION).toMatch(/<NextMomentCard moment=\{data\.next\}/);
  });

  it('no longer heads a section of its own on Home', () => {
    // AFSectionLabel + "View all" made Moments look like a peer of Home's own
    // sections; both the component and the copy keys are retired.
    expect(NEXT_CARD).not.toContain('AFSectionLabel');
    expect(moments).not.toHaveProperty('todays_label');
    expect(moments).not.toHaveProperty('view_all');
  });

  it('keeps the overview reachable through one quiet, tappable line', () => {
    // Deleting the list must not orphan /moments (and with it PREPARE MY DAY
    // and ADD A MOMENT) — it was the only route in.
    expect(NEXT_CARD).toMatch(/router\.push\('\/moments'\)/);
    // The link renders t(labelKey); its default is the 'All of today' copy, so
    // the with-next-moment tap still reads exactly as before.
    expect(NEXT_CARD).toContain("labelKey = 'moments.all_today'");
    expect(NEXT_CARD).toContain('t(labelKey)');
    expect(moments).toHaveProperty('all_today');
    // The no-next doorway copy also exists.
    expect(moments).toHaveProperty('home_entry');
    // Quietest register the type scale has, and still a 44pt target.
    expect(NEXT_CARD).toMatch(/allTodayText: \{ \.\.\.afType\.caption, color: af\.textTertiary \}/);
    expect(NEXT_CARD).toMatch(/allToday: \{[\s\S]*?minHeight: afLayout\.controlMinHeight/);
  });
});

describe('Home — Moments never competes with the command card', () => {
  it('sits on a standard surface; the command card stays the only raised one', () => {
    expect(NEXT_CARD).not.toMatch(/<AFCard\s+variant="raised"/);
  });

  it('does not spend a second accent colour on its eyebrow', () => {
    // The active left rail already carries green when prep is live.
    expect(NEXT_CARD).toMatch(/eyebrow: \{ \.\.\.afType\.eyebrow, color: af\.textTertiary \}/);
  });
});

describe('MomentDetailScreen — feedback pills clear the 44pt floor', () => {
  it('gives the pill a real minimum height and a hitSlop', () => {
    // caption lineHeight 18 + 2×10 padding = 38pt; the touch target was the
    // pill and nothing more.
    expect(DETAIL).toMatch(/feedbackPill: \{[\s\S]*?minHeight: afLayout\.controlMinHeight/);
    expect(DETAIL).toMatch(/feedbackPill: \{[\s\S]*?justifyContent: 'center'/);
    const pillPressable = DETAIL.slice(
      DETAIL.indexOf('styles.feedbackPill'),
      DETAIL.indexOf('moment-feedback-${k}'),
    );
    expect(pillPressable).toContain('hitSlop={8}');
  });
});

describe('MomentDetailScreen — a ritual stage is ONE accessibility element', () => {
  it('groups title, state and instruction into a single composed label', () => {
    // Three sibling Texts in a plain View read as three loose fragments per
    // stage — twelve for the four-stage ritual.
    expect(DETAIL).toMatch(/accessibilityLabel=\{ritualStageA11yLabel\(title, meta, instruction\)\}/);
    const stageRow = DETAIL.slice(DETAIL.indexOf('function RitualStageRow'));
    expect(stageRow).toMatch(/style=\{styles\.stageRow\}\s*\n\s*accessible\b/);
  });

  it('says its state in words and exposes it as state, not as a green', () => {
    expect(DETAIL).toContain("import {");
    expect(DETAIL).toMatch(/const stateKey = stageStateLabelKey\(stage\.state\);/);
    expect(DETAIL).toMatch(/const meta = stateKey \? t\(stateKey\) : clockLabel\(stage\.atIso\);/);
    expect(DETAIL).toMatch(/accessibilityState=\{\{ selected: active \}\}/);
    expect(moments).toHaveProperty('stage_done');
  });

  it('announces when the ritual advances, on both platforms', () => {
    // accessibilityLiveRegion is @platform android; iOS needs the explicit
    // announcement, and it must key off the ACTIVE STAGE, never the 30s tick.
    expect(DETAIL).toContain('accessibilityLiveRegion="polite"');
    expect(DETAIL).toContain('AccessibilityInfo.announceForAccessibility(activeAnnouncementRef.current)');
    expect(DETAIL).toMatch(/\}, \[activeStageKey\]\);/);
    expect(DETAIL).toMatch(/if \(Platform\.OS !== 'ios'\) return;/);
    // No announcement on first mount — VoiceOver already reads the focused row.
    expect(DETAIL).toMatch(/if \(!hasMountedRef\.current\)/);
  });

  it('dropped the WHY THIS sheet that no control could open', () => {
    // WHY is answered inline in the moment-why block; the mounted sheet had
    // no setWhyOpen(true) anywhere on this screen.
    expect(DETAIL).not.toContain('WhyThisSheet');
    expect(DETAIL).not.toContain('whyOpen');
    expect(DETAIL).toContain('testID="moment-why"');
  });
});

describe('MomentsScreen — UP NEXT has one priority, not N', () => {
  it('gives the full card to the soonest moment only', () => {
    expect(OVERVIEW).toMatch(/<MomentOverviewCard\s+moment=\{upNext\[0\]!\}/);
    expect(OVERVIEW).not.toMatch(/upNext\.map\(/);
  });

  it('renders everything after it as quiet rows that still say WHEN prep matters', () => {
    expect(OVERVIEW).toMatch(/upNext\.slice\(1\)\.map\(/);
    expect(OVERVIEW).toContain('moments.status_prep');
    expect(OVERVIEW).toContain('moments.status_recovery');
    // A row is a hairline-divided line, not another bordered card.
    expect(OVERVIEW).toMatch(/laterRow: \{[\s\S]*?borderTopWidth: 1/);
    expect(OVERVIEW).toMatch(/laterRow: \{[\s\S]*?minHeight: afLayout\.controlMinHeight/);
    expect(OVERVIEW).toMatch(/accessibilityLabel=\{`\$\{row\.time\}, \$\{title\}, \$\{window\}`\}/);
  });

  it('dropped the decorative subtitle the summary card already said better', () => {
    expect(OVERVIEW).not.toContain('overview_subtitle');
    expect(moments).not.toHaveProperty('overview_subtitle');
    expect(OVERVIEW).toContain('moments.overview_summary');
  });
});

describe('Moments — no raw colour anywhere on these surfaces', () => {
  const CONCAT_RE = /\$\{[^}]*(af\.|accent|color)[^}]*\}[0-9a-fA-F]{2}/;

  it('self-test: the scanner really catches the pattern it is guarding against', () => {
    // The exact shapes these files carried before Wave 5.
    expect('backgroundColor: `${row.accent}1F`').toMatch(CONCAT_RE);
    expect('borderColor: `${af.green}44`').toMatch(CONCAT_RE);
    expect('backgroundColor: withAlpha(af.green, afAlpha.a16)').not.toMatch(CONCAT_RE);
  });

  it('uses withAlpha + afAlpha instead of `${token}NN` hex-suffix concatenation', () => {
    for (const [name, src] of [
      ['NextMomentCard.tsx', NEXT_CARD],
      ['MomentDetailScreen.tsx', DETAIL],
      ['MomentsScreen.tsx', OVERVIEW],
    ] as const) {
      expect(src, `${name} must not build colors by string concatenation`).not.toMatch(
        CONCAT_RE,
      );
    }
    expect(DETAIL).toContain('withAlpha(af.green, afAlpha.a16)');
  });
});

/**
 * WAVE 5 — LOADING STATES. Both Moments surfaces used the hydration window to
 * say something they did not know:
 *   • the overview rendered the "No moments yet" EMPTY STATE while the store
 *     was still reading, telling a member with a full day that their day was
 *     empty and then taking it back;
 *   • `/moment/[id]` returned `null` — a genuinely blank screen — for that same
 *     window, which on a deep link is the FIRST thing a member sees, and a
 *     black screen reads as a crash rather than a wait.
 * `useMomentsData` already exposes `hydrated`; both now wait on it.
 */
describe('Moments — empty is a conclusion, and it has to be earned', () => {
  const ROUTE = strip(readFileSync(join(__dirname, '..', '..', '..', 'app', 'moment', '[id].tsx'), 'utf8'));

  it('the overview waits for hydration before it can call the day empty', () => {
    expect(OVERVIEW).toContain("import { MomentsOverviewSkeleton } from './MomentsSkeleton';");
    expect(OVERVIEW).toMatch(/!data\.hydrated\s*\?\s*[\s\S]{0,600}?<MomentsOverviewSkeleton \/>/);
    // The empty state is still there — it just comes second now.
    expect(OVERVIEW).toContain('testID="moments-empty"');
    expect(OVERVIEW.indexOf('MomentsOverviewSkeleton')).toBeLessThan(
      OVERVIEW.indexOf('testID="moments-empty"'),
    );
  });

  it('PREPARE MY DAY waits too — it is deep-linkable, so the flash was reachable first', () => {
    const PLAN = read('PrepareMyDayScreen.tsx');
    expect(PLAN).toContain("import { MomentsOverviewSkeleton } from './MomentsSkeleton';");
    expect(PLAN).toMatch(/!data\.hydrated\s*\?\s*[\s\S]{0,600}?<MomentsOverviewSkeleton \/>/);
    expect(PLAN.indexOf('MomentsOverviewSkeleton \/>')).toBeLessThan(
      PLAN.indexOf('testID="plan-empty"'),
    );
    // The day strip is a selector, not a claim — it stays live while loading.
    expect(PLAN.indexOf('testID="plan-day-strip"')).toBeLessThan(
      PLAN.indexOf('!data.hydrated'),
    );
  });

  it('the empty state still teaches what happens next, with one action', () => {
    expect(OVERVIEW).toMatch(/action=\{\{ label: t\('moments\.add_moment'\)/);
    expect(moments.empty_title).toBeTruthy();
    expect(moments.empty_body).toBeTruthy();
  });

  it('the deep-linked ritual shapes itself instead of painting a blank screen', () => {
    expect(ROUTE).toContain("import { MomentRitualSkeleton } from '@/components/moments/MomentsSkeleton';");
    expect(ROUTE).toContain('<MomentRitualSkeleton />');
    // The `return null` that produced the blank screen is gone.
    expect(ROUTE).not.toMatch(/if \(!data\.hydrated\) return null;/);
    // …and an unknown id still redirects, only AFTER hydration settles.
    expect(ROUTE).toContain("<Redirect href=\"/moments\" />");
    expect(ROUTE.indexOf('MomentRitualSkeleton')).toBeLessThan(
      ROUTE.indexOf('href="/moments"'),
    );
  });
});
