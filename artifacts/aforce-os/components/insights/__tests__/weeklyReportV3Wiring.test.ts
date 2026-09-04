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
    // A MEASURED day still speaks its score.
    expect(CODE).toMatch(
      /t\('reports\.v3\.timeline_day_a11y',\s*\{[\s\S]*?day:\s*weekday,[\s\S]*?date:\s*shortDate\(d\.date\),[\s\S]*?score:\s*d\.score,/,
    );
  });

  it('an UNMEASURED day says "no reading" instead of speaking a sentinel zero', () => {
    // The dense wire always includes a day HydroState never observed; its
    // `avgScore` is the server's sentinel. Speaking it would announce "daily
    // average score 0" for a day nothing was measured, and paint a
    // full-height Signal-Red bar to match.
    expect(CODE).toMatch(/const unmeasured = d\.score == null \|\| d\.accent == null;/);
    expect(CODE).toMatch(/t\('reports\.v3\.timeline_day_unmeasured_a11y',\s*\{[\s\S]*?day:\s*weekday,[\s\S]*?date:\s*shortDate\(d\.date\),/);
    // ...and draws no fill at all on that day.
    expect(CODE).toMatch(/\{unmeasured \? null : \(/);
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

/**
 * WAVE 5 — LOADING / DEGRADED STATES.
 *
 * Two more defects, both about the report asserting things it does not know:
 *   4. BARE SPINNER — three sources are assembled on mount (analytics snapshot,
 *      journal rollups, command ledger) behind a lone centered
 *      ActivityIndicator on an otherwise empty screen.
 *   5. FAILURE READ AS A MEASUREMENT — `fetchJournalRollups(7).catch(() => [])`
 *      made a failed fetch indistinguishable from a genuinely empty week, so
 *      "0 days tracked" and "0 wins" rendered as facts about a week the member
 *      had actually lived. (The legacy report fixed this exact defect for its
 *      analytics fetch — see app/weekly-report.tsx's `eventsLoading` note.)
 */
describe('WeeklyReportV3 — the loading window holds the report shape', () => {
  it('mounts the store-free WeeklyReportSkeleton instead of a bare ActivityIndicator', () => {
    expect(CODE).toContain("import { WeeklyReportSkeleton } from './WeeklyReportSkeleton';");
    expect(CODE).toContain('<WeeklyReportSkeleton />');
    expect(CODE).not.toContain('ActivityIndicator');
  });

  it('keeps the loading branch a single labelled progressbar around that shape', () => {
    const loading = CODE.slice(
      CODE.indexOf('accessibilityRole="progressbar"'),
      CODE.indexOf('</AFScreen>'),
    );
    expect(loading).toContain("accessibilityLabel={t('reports.v3.loading_a11y')}");
    expect(loading).toContain('accessibilityLiveRegion="polite"');
    expect(loading).toContain('<WeeklyReportSkeleton />');
  });
});

describe('WeeklyReportV3 — a failed week is degraded, never reported as zero', () => {
  it('distinguishes a failed rollup fetch from a genuinely empty week', () => {
    expect(CODE).toMatch(/const\s+\[rollupsUnavailable,\s*setRollupsUnavailable\]/);
    expect(CODE).toMatch(/fetchJournalRollups\(7\)\.catch\(\(\) => \{\s*rollupsFailed = true;/);
    expect(CODE).toContain('setRollupsUnavailable(rollupsFailed);');
    // The silent swallow that made the two states identical is gone.
    expect(CODE).not.toMatch(/fetchJournalRollups\(7\)\.catch\(\(\) => \[\] as never\[\]\)/);
  });

  it('renders the three rollup-fed tiles as the honest em dash, not a measured 0', () => {
    expect(CODE).toMatch(/const\s+winsValue\s*=\s*rollupsUnavailable\s*\?\s*'—'/);
    expect(CODE).toMatch(/const\s+trackedValue\s*=\s*rollupsUnavailable\s*\?\s*'—'/);
    expect(CODE).toMatch(/rollupsUnavailable \|\| model\.daysTracked === 0\s*\?\s*'—'/);
    // …and the raw model fields are no longer rendered straight into the tiles.
    expect(CODE).not.toContain('<Text style={styles.tileValue}>{model.weeklyWins}</Text>');
    expect(CODE).not.toContain('<Text style={styles.tileValue}>{model.daysTracked}</Text>');
  });

  it('speaks the same value it shows (the composed tile labels take the dashed values)', () => {
    expect(CODE).toContain("accessibilityLabel={`${t('reports.v3.tile_wins')}: ${winsValue}`}");
    expect(CODE).toContain("accessibilityLabel={`${t('reports.v3.tile_tracked')}: ${trackedValue}`}");
  });

  it('says what happened and what is still current, via the SHIPPED inline error row', () => {
    expect(CODE).toMatch(/import\s*\{[\s\S]*?AFInlineErrorRow[\s\S]*?\}\s*from\s*'@\/components\/ui';/);
    expect(CODE).toContain('testID="weekly-v3-degraded"');
    expect(CODE).toContain("message={t('reports.v3.rollups_unavailable')}");
  });

  it('gives the member a way to try again that re-runs the ONE existing loader', () => {
    expect(CODE).toContain('onRetry={() => setReloadNonce((n) => n + 1)}');
    expect(CODE).toMatch(/\}, \[fixture, pa\.result\.performanceAge, pa\.result\.status, reloadNonce\]\)/);
    // Still exactly one fetch call site — the retry is a re-run, not a copy.
    expect(CODE.match(/fetchJournalRollups\(/g)).toHaveLength(1);
    expect(CODE.match(/getAnalyticsSnapshot\(/g)).toHaveLength(1);
  });
});

describe('WeeklyReportV3 — degraded copy exists and stays in AForce voice', () => {
  it('resolves the new reports.v3 keys and keeps internal vocabulary out of them', async () => {
    const en = (await import('../../../locales/en.json')).default;
    const v3 = en.reports.v3 as unknown as Record<string, string | undefined>;
    expect(v3.rollups_unavailable).toBeTruthy();
    expect(v3.retry).toBeTruthy();
    // Answers WHAT HAPPENED and WHAT STILL WORKS; the retry control is WHAT TO DO.
    expect(v3.rollups_unavailable).toMatch(/current/i);
    expect(v3.rollups_unavailable).not.toMatch(/\b(null|undefined|rollup|endpoint|API|500)\b/i);
  });
});
