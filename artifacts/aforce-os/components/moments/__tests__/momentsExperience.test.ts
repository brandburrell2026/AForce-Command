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

  it('renders nothing at all when there is no next moment', () => {
    expect(HOME_SECTION).toMatch(/if \(!data\.hydrated \|\| !data\.next\) return null;/);
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
    expect(NEXT_CARD).toContain("t('moments.all_today')");
    expect(moments).toHaveProperty('all_today');
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
