/**
 * WeeklyReportV3 — navigation, chart-honesty and a11y wiring guard (Wave 5).
 *
 * `WeeklyReportV3` pulls in `expo-router`, `usePerformanceAge`, the analytics
 * snapshot fetch and the command ledger — the same category of connected
 * container this repo deliberately never mounts in tests. This file applies the
 * established source-guard pattern (see `readinessInsightsV2Wiring.test.ts`'s
 * header, and `connectedHealthContainer.render.test.tsx`'s before it): read the
 * component's source, strip comments, and assert the wiring the fix requires is
 * present and the pre-fix defect is absent.
 *
 * The numeric half of the chart fix — that a small change now LOOKS small — is
 * real behaviour and is covered properly in `weeklyV3Presentation.test.ts`
 * against `performanceAgeBarAxis`. This file only pins that the screen actually
 * calls it and no longer carries its own auto-ranging math.
 *
 * Three defects are locked here:
 *   1. NAVIGATION TRAP — the screen is a PUSHED route under a layout that sets
 *      `headerShown: false` (app/_layout.tsx), and its AFTopBar had no back
 *      affordance in either the loading or the loaded branch. A member who
 *      opened Week in Review could not leave it except by system gesture.
 *   2. AUTO-RANGED CHART — bars ranged to the series' own extremes, so a
 *      one-year Performance Age move (the smallest the engine can express)
 *      drew a full-height swing.
 *   3. A11Y — the screen had zero roles and zero labels; both charts were
 *      wholly unreadable to VoiceOver and async load completion was silent.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'WeeklyReportV3.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const GUARDED_BACK =
  /onBack=\{\(\)\s*=>\s*\(router\.canGoBack\(\)\s*\?\s*router\.back\(\)\s*:\s*router\.replace\('\/'\)\)\}/g;

describe('WeeklyReportV3 — back control on a pushed route (navigation trap)', () => {
  it('wires onBack to the guarded canGoBack() pattern, matching ReadinessInsightsV2 and the legacy screen', () => {
    expect(CODE).toMatch(GUARDED_BACK);
    expect(CODE).toContain("import { useRouter } from 'expo-router';");
    expect(CODE).toMatch(/const\s+router\s*=\s*useRouter\(\);/);
  });

  it('gives BOTH the loading branch and the loaded branch a back control — a slow load must not trap either', () => {
    expect(CODE.match(GUARDED_BACK)).toHaveLength(2);
    expect(CODE.match(/<AFTopBar/g)).toHaveLength(2);
  });

  it('never reintroduces the bare AFTopBar the trap came from, nor the unguarded router.back()', () => {
    expect(CODE).not.toMatch(
      /<AFTopBar\s+eyebrow=\{t\('reports\.v3\.eyebrow'\)\}\s+title=\{t\('reports\.v3\.title'\)\}\s*\/>/,
    );
    expect(CODE).not.toMatch(/onBack=\{\(\)\s*=>\s*router\.back\(\)\}/);
  });
});

describe('WeeklyReportV3 — Performance Age chart ranging (trust)', () => {
  it('delegates bar heights to performanceAgeBarAxis instead of ranging in the view', () => {
    expect(CODE).toMatch(/import\s*\{[\s\S]*?performanceAgeBarAxis[\s\S]*?\}\s*from\s*'\.\/weeklyV3Presentation';/);
    expect(CODE).toMatch(/const\s+paAxis\s*=\s*performanceAgeBarAxis\(paView\.bars\);/);
    expect(CODE).toContain('paAxis.fractions[i]!');
  });

  it('no longer computes the auto-ranged span/frac that exaggerated a one-year move', () => {
    expect(CODE).not.toContain('paBarMin');
    expect(CODE).not.toContain('paBarMax');
    expect(CODE).not.toMatch(/Math\.max\(1,\s*paBarMax\s*-\s*paBarMin\)/);
    expect(CODE).not.toMatch(/0\.25\s*\+\s*0\.75\s*\*/);
  });

  it('states the rendered scale next to the chart, so the slope can be calibrated', () => {
    expect(CODE).toMatch(/t\('reports\.v3\.pa_scale',\s*\{[\s\S]*?min:\s*Math\.round\(paAxis\.minAge\)/);
    expect(CODE).toMatch(/max:\s*Math\.round\(paAxis\.maxAge\)/);
  });

  it('keeps the Performance Age™ disclosure intact (standing founder ruling)', () => {
    expect(CODE).toContain("import { PERFORMANCE_AGE_DISCLAIMER } from '@/utils/performanceAge';");
    expect(CODE).toContain('{PERFORMANCE_AGE_DISCLAIMER}');
    // The honest "still accruing" posture must survive the rewrite too.
    expect(CODE).toContain("t('reports.v3.pa_collecting')");
  });
});

describe('WeeklyReportV3 — Signal Red restraint on an empty posture', () => {
  it('renders the top-command banner neutral while its section is awaiting data', () => {
    expect(CODE).toMatch(/const\s+topCommandAwaiting\s*=\s*topCommand\.status\s*===\s*'awaiting';/);
    expect(CODE).toMatch(/topCommandAwaiting\s*\?\s*styles\.bannerNeutral\s*:\s*styles\.bannerRed/);
    expect(CODE).toMatch(/topCommandAwaiting\s*\?\s*styles\.bannerIconNeutral\s*:\s*styles\.bannerIconRed/);
    expect(CODE).toMatch(/topCommandAwaiting\s*\?\s*af\.textTertiary\s*:\s*af\.redText/);
  });

  it('leaves the real Water-First focus banner as the one emphasized line', () => {
    expect(CODE).toMatch(/style=\{\[styles\.banner,\s*styles\.bannerGreen\]\}/);
  });
});

describe('WeeklyReportV3 — chart text alternatives (a11y)', () => {
  it('gives the weekly timeline a per-day composed label carrying the real score', () => {
    // AFCard is used purely for its Wave-5 composed-label fix; `padded={false}`
    // plus the existing tile style keep it pixel-identical to the old View.
    expect(CODE).toMatch(/<AFCard[\s\S]*?padded=\{false\}[\s\S]*?style=\{styles\.timelineDay\}/);
    expect(CODE).toMatch(
      /accessibilityLabel=\{t\('reports\.v3\.timeline_day_a11y',\s*\{[\s\S]*?day:\s*weekday,[\s\S]*?date:\s*shortDate\(d\.date\),[\s\S]*?score:\s*d\.score,/,
    );
  });

  it('gives the Performance Age bars a composed label with each day and the axis, instead of hiding them', () => {
    expect(CODE).toMatch(/accessibilityLabel=\{t\('reports\.v3\.pa_bars_a11y'/);
    expect(CODE).toMatch(/weekdayKeyForDayIndex\(b\.dayIndex\)/);
    // The bars used to be the only a11y treatment on the screen: hidden.
    expect(CODE).not.toMatch(
      /style=\{styles\.paBars\}\s+importantForAccessibility="no-hide-descendants"/,
    );
  });

  it('leaves the win/tracked dot strips hidden — they duplicate the number beside them', () => {
    expect(CODE.match(/style=\{styles\.dots\}\s+importantForAccessibility="no-hide-descendants"/g))
      .toHaveLength(2);
  });
});

describe('WeeklyReportV3 — headings, key figures and load announcement (a11y)', () => {
  it('groups the struck-through was→now Performance Age row into one spoken sentence', () => {
    expect(CODE).toMatch(/style=\{styles\.paRow\}\s+accessible/);
    expect(CODE).toContain("t('reports.v3.pa_row_a11y_moved'");
    expect(CODE).toContain("t('reports.v3.pa_row_a11y_current'");
  });

  it('marks the Performance Age card label as a heading', () => {
    expect(CODE).toMatch(/style=\{styles\.paLabel\}\s+accessibilityRole="header"/);
  });

  it('composes one label per tile and per banner instead of loose fragments', () => {
    expect(CODE.match(/style=\{styles\.tile\}\s+accessible/g)).toHaveLength(6);
    expect(CODE).toContain("accessibilityLabel={`${t('reports.v3.top_command')}: ${sectionSummary(t, topCommand)}`}");
    expect(CODE).toContain("accessibilityLabel={`${t('reports.v3.next_focus')}: ${sectionSummary(t, nextFocus)}`}");
  });

  it('labels the loading state and announces completion on both platforms', () => {
    expect(CODE).toMatch(/accessibilityRole="progressbar"/);
    expect(CODE).toContain("accessibilityLabel={t('reports.v3.loading_a11y')}");
    expect(CODE).toContain('accessibilityLiveRegion="polite"');
    // iOS has no live regions, so it gets the explicit announcement — fired on
    // the loading→loaded transition only (RiskTimerDisplay's pattern), never on
    // first mount and never for a fixture, which starts non-null.
    expect(CODE).toContain("AccessibilityInfo.announceForAccessibility(t('reports.v3.loaded_a11y'))");
    expect(CODE).toMatch(/const\s+wasLoadingRef\s*=\s*React\.useRef\(model\s*==\s*null\);/);
    expect(CODE).toMatch(/if\s*\(Platform\.OS\s*!==\s*'ios'\)\s*return;/);
  });

  it('adds no timer or polling loop — Wave 4 removed the per-second render blast', () => {
    expect(CODE).not.toContain('setInterval');
    expect(CODE).not.toContain('setTimeout');
    expect(CODE).not.toContain('TICK_TIMER');
  });
});

describe('WeeklyReportV3 — every a11y string it renders exists in en.json', () => {
  it('resolves the reports.v3 keys this screen introduces', async () => {
    const en = (await import('../../../locales/en.json')).default;
    const v3 = en.reports.v3 as unknown as Record<string, string | undefined>;
    for (const key of [
      'pa_scale',
      'pa_bars_a11y',
      'pa_row_a11y_moved',
      'pa_row_a11y_current',
      'timeline_day_a11y',
      'loading_a11y',
      'loaded_a11y',
    ]) {
      expect(v3[key], `reports.v3.${key} missing from en.json`).toBeTruthy();
    }
  });
});
