/**
 * PerformanceSignalV3 — simplification, evidence and a11y wiring guard (Wave 5).
 *
 * `PerformanceSignalV3` fetches rollups on mount and renders through the af.*
 * primitive layer — the category of connected container this repo deliberately
 * never mounts in tests. This file applies the established source-guard pattern
 * (see `weeklyReportV3Wiring.test.ts` and `circleV3TrustHierarchy.test.ts`):
 * read the component's source, strip comments, and assert that the wiring the
 * fix requires is present and the pre-fix defect is absent. The arithmetic half
 * — window totals and the coverage → §55 level mapping — is proved properly as
 * pure functions in `signalV3Presentation.test.ts`.
 *
 * Four defects are locked here:
 *   1. DENSITY — the default view carried a 56pt week average, a bar chart,
 *      seven day cards each with a tinted band pill and three metric chips, and
 *      a five-row "Weekly averages" card whose first row repeated the 56pt
 *      number verbatim. Detail now lives behind ONE AFDisclosureSheet.
 *   2. UNQUALIFIED AVERAGE — "78" was rendered with no statement of how many of
 *      the seven days were behind it. It now carries the SHIPPED ConfidenceChip.
 *   3. FALSE MEASUREMENT — the rollup's interpolated in-band share wore a
 *      score-band status dot (`accentForScore` applied to a percentage-of-time,
 *      not a score), and "Total logged" under a "Last 7 days" heading was one
 *      day's `endOzConsumed`.
 *   4. A11Y — the summary read as loose fragments, the spinner never announced
 *      completion, and the error/empty title carried no header role.
 *
 * Style assertions resolve through the imported `afType` rather than naming
 * pixel sizes, so the lock survives a token retune and still fails the moment a
 * day row is drawn as loudly as the one number that leads the screen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afType } from '@/theme';

const PKG = join(__dirname, '..', '..', '..');
const SRC = readFileSync(join(PKG, 'components', 'hydration', 'PerformanceSignalV3.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const V3 = (
  JSON.parse(readFileSync(join(PKG, 'locales', 'en.json'), 'utf8')) as {
    signal: { v3: Record<string, string> };
  }
).signal.v3;

/** The body of one StyleSheet entry, comments stripped. */
function styleBlock(name: string): string {
  const start = CODE.indexOf(`${name}: {`);
  expect(start, `style "${name}" must exist`).toBeGreaterThan(-1);
  return CODE.slice(start, CODE.indexOf('},', start));
}

/** The afType step a style spreads, e.g. `...afType.body` → 17. */
function fontSizeOf(styleName: string): number {
  const m = styleBlock(styleName).match(/\.\.\.afType\.(\w+)/);
  expect(m, `style "${styleName}" must spread an afType step`).not.toBeNull();
  const step = afType[m![1] as keyof typeof afType] as { fontSize: number };
  return step.fontSize;
}

describe('PerformanceSignalV3 — one signal leads, detail is one tap deeper', () => {
  it('keeps the week average as the only dominant numeral', () => {
    expect(styleBlock('summaryAvg')).toContain('fontSize: 56');
    expect(fontSizeOf('dayScore')).toBeLessThan(56);
    expect(fontSizeOf('dayName')).toBeLessThan(56);
  });

  it('no longer renders the standing "Weekly averages" card in the default view', () => {
    // The section header + padded recap card are gone; those rows are now sheet
    // content reached from a single text button.
    expect(CODE).not.toContain('AFSectionLabel');
    expect(CODE).not.toContain('signal-v3-recap');
    expect(CODE).not.toContain('recapCard');
    expect(CODE).not.toContain('recapDivider');
  });

  it('stops repeating the hero number as a "Average score" recap row', () => {
    expect(CODE).not.toContain('recap_avg');
    expect(V3.recap_avg).toBeUndefined();
  });

  it('drops the three dotted metric chips from every day row', () => {
    expect(CODE).not.toContain('chipDot');
    expect(CODE).not.toContain('chipStrong');
    expect(CODE).not.toMatch(/styles\.chipRow/);
  });

  it('drops the tinted band pill — with it, the raw `${accent}22` alpha concatenation', () => {
    expect(CODE).not.toContain('bandPill');
    expect(CODE).not.toMatch(/\$\{[^}]*accent[^}]*\}[0-9a-fA-F]{2}/);
  });

  it('discloses the removed detail through the repo\'s existing sheet primitive', () => {
    expect(CODE).toMatch(/import\s*\{[\s\S]*?AFDisclosureSheet[\s\S]*?\}\s*from\s*'@\/components\/ui';/);
    // ONE sheet, one state — a day OR the week, never a second modal system.
    expect(CODE.match(/<AFDisclosureSheet/g)).toHaveLength(1);
    expect(CODE).toMatch(/useState<Detail \| null>\(null\)/);
    expect(CODE).toContain("setDetail({ kind: 'day', date: d.date })");
    expect(CODE).toContain("setDetail({ kind: 'week' })");
  });

  it('makes each day row the affordance that opens its own detail', () => {
    expect(CODE).toMatch(/<AFCard[\s\S]{0,400}?onPress=\{\(\) => setDetail\(\{ kind: 'day'/);
    expect(CODE).toContain('name="chevron-right"');
  });
});

describe('PerformanceSignalV3 — the average never appears without its evidence', () => {
  it('renders the SHIPPED ConfidenceChip, not a bespoke confidence widget', () => {
    expect(CODE).toContain("import { ConfidenceChip } from '@/components/ConfidenceChip';");
    expect(CODE).toContain("import { completenessChip } from '@/utils/confidence/confidenceChip';");
    expect(CODE).toContain('<ConfidenceChip');
  });

  it('drives the chip from the window coverage the rollups already carry', () => {
    // THE DENOMINATOR IS THE ELIGIBLE WINDOW, NOT THE REQUESTED CONSTANT.
    // This law previously pinned `RANGE_DAYS`, which contradicted its own name:
    // 7 is what the picker ASKS the server for, not coverage the rollups carry.
    // The response is clamped to the member's history floor, so a member three
    // days old receives three rows and was being told "2 of 7 days tracked" —
    // rated against four days that predate their account, and handed a
    // sparse-evidence chip for a window they had covered completely.
    expect(CODE).toMatch(
      /completenessChip\(historyCompletenessLevel\(recap\.daysTracked, eligibleDays\)\)/,
    );
    expect(CODE).toMatch(
      /const eligibleDays = React\.useMemo\(\(\) => reportedSpanDays\(rollups \?\? \[\]\), \[rollups\]\);/,
    );
    expect(CODE, 'the requested constant is not a coverage denominator').not.toMatch(
      /historyCompletenessLevel\([^)]*RANGE_DAYS\)/,
    );
  });

  it('gives the chip the a11y noun its bare rating token lacks', () => {
    expect(CODE).toMatch(/a11yContext=\{t\('signal\.v3\.completeness_a11y_context'\)\}/);
    expect(V3.completeness_a11y_context).toBeTruthy();
  });

  it('states the plain coverage fact beside the chip, not only the rating token', () => {
    expect(CODE).toContain("t('signal.v3.days_tracked'");
    expect(V3.days_tracked).toContain('{{n}}');
    expect(V3.days_tracked).toContain('{{total}}');
  });

  it('places the chip on the same card as the number it qualifies', () => {
    const card = CODE.slice(CODE.indexOf('testID="signal-v3-summary"'), CODE.indexOf('</AFCard>'));
    expect(card).toContain('<ConfidenceChip');
  });
});

describe('PerformanceSignalV3 — estimates do not wear a measurement\'s authority', () => {
  it('no longer paints the interpolated in-band share with a score-band status dot', () => {
    // The accent helpers map the HydroState score bands (≥85/≥65/≥40). Applying
    // them to a percentage-of-time made an interpolation look like a graded
    // measurement; the only band tints left take an actual score.
    expect(CODE).not.toMatch(/accent(?:Text)?ForScore\([^)]*inBandPct/);
    for (const m of CODE.match(/accent(?:Text)?ForScore\([^)]*\)/g) ?? []) {
      expect(m, 'a band accent may only tint a score').toMatch(
        /accent(?:Text)?ForScore\((recap\.avgScore|d\.score)\)/,
      );
    }
  });

  it('separates the day\'s LOGGED value from the engine\'s estimates in the sheet', () => {
    expect(CODE).toContain("t('signal.v3.logged_label')");
    expect(CODE).toContain("t('signal.v3.estimated_label')");
    const sheet = CODE.slice(CODE.indexOf('<AFDisclosureSheet'));
    expect(sheet.indexOf("t('signal.v3.logged_label')")).toBeLessThan(
      sheet.indexOf("t('signal.v3.estimated_label')"),
    );
  });

  it('states the check count the estimates were interpolated across', () => {
    expect(CODE).toMatch(/t\('signal\.v3\.day_basis',\s*\{ checks: detailDay\.checks \}\)/);
    expect(V3.day_basis).toMatch(/not a continuous measurement/i);
    expect(CODE).toMatch(/checks: weeklyChecks\(days\)/);
  });

  it('reports the window total, not the last day\'s ounces, under a 7-day heading', () => {
    expect(CODE).toContain('weeklyTotalOz(days)');
    expect(CODE).not.toContain('recap.totalOunces');
  });

  it('rounds the peak score so it cannot render a fractional score beside whole ones', () => {
    expect(CODE).toContain('Math.round(recap.peakScore)');
  });

  it('keeps the honest-data contract: no per-day streak, no "commands" for checks', () => {
    expect(CODE).not.toMatch(/\bcommands\b/i);
    expect(CODE).not.toMatch(/d\.streak/);
  });
});

describe('PerformanceSignalV3 — screen-reader parity with the visual screen', () => {
  it('composes the summary card into ONE announcement carrying score, coverage and rating', () => {
    expect(CODE).toMatch(/accessibilityLabel=\{t\('signal\.v3\.summary_a11y',/);
    for (const token of ['{{days}}', '{{score}}', '{{tracked}}', '{{completeness}}']) {
      expect(V3.summary_a11y, `summary_a11y must interpolate ${token}`).toContain(token);
    }
  });

  it('keeps every metric the disclosure hid inside the day row\'s spoken label', () => {
    expect(CODE).toMatch(/accessibilityLabel=\{t\('signal\.v3\.day_a11y',/);
    for (const token of ['{{day}}', '{{date}}', '{{score}}', '{{band}}', '{{oz}}', '{{pct}}', '{{checks}}']) {
      expect(V3.day_a11y, `day_a11y must interpolate ${token}`).toContain(token);
    }
  });

  it('names what the day\'s bare numeral IS, and marks the estimate as one', () => {
    expect(V3.day_a11y).toMatch(/hydration score/i);
    expect(V3.day_a11y).toMatch(/estimated from/i);
    expect(V3.summary_a11y).toMatch(/hydration score/i);
  });

  it('announces the loading→loaded transition instead of the history silently appearing', () => {
    expect(CODE).toContain('accessibilityRole="progressbar"');
    expect(CODE).toMatch(/accessibilityLabel=\{t\('signal\.v3\.loading_a11y'\)\}/);
    expect(CODE).toContain('accessibilityLiveRegion="polite"');
    expect(CODE).toMatch(
      /AccessibilityInfo\.announceForAccessibility\(t\('signal\.v3\.loaded_a11y'\)\)/,
    );
    // iOS-only, on the transition only — the Android path is the live region.
    expect(CODE).toMatch(/if \(Platform\.OS !== 'ios'\) return;/);
    expect(CODE).toContain('wasLoadingRef');
  });

  it('gives the error / empty title a header role and announces the state change', () => {
    const state = CODE.slice(CODE.indexOf('testID="signal-v3-empty"'), CODE.indexOf('signal-v3-retry'));
    expect(state).toContain('accessibilityRole="header"');
    expect(CODE).toMatch(/accessibilityLiveRegion="polite"[\s\S]{0,40}testID="signal-v3-empty"/);
  });

  it('keeps the decorative bar chart out of the reading order (the day rows carry it)', () => {
    expect(CODE).toContain('importantForAccessibility="no-hide-descendants"');
    expect(CODE).toContain('accessibilityElementsHidden');
  });

  it('speaks each sheet line as one "label, value" pair', () => {
    expect(CODE).toMatch(/accessible accessibilityLabel=\{`\$\{label\}, \$\{value\}`\}/);
  });
});

describe('PerformanceSignalV3 — Wave-4 behaviour preserved', () => {
  it('keeps the cold-launch auth-race retry and pull-to-refresh (PR #721)', () => {
    expect(CODE).toContain('const RETRY_DELAYS_MS = [1500, 4000];');
    expect(CODE).toContain('<RefreshControl');
    expect(CODE).toContain('testID="signal-v3-retry"');
  });

  it('adds no timer, interval or animation loop', () => {
    expect(CODE).not.toContain('setInterval');
    expect(CODE).not.toContain('Animated.loop');
    expect(CODE).not.toContain('useSharedValue');
  });

  it('still fetches exactly once per load, and the fixture path still skips the network', () => {
    expect(CODE.match(/fetchJournalRollups\(/g)).toHaveLength(1);
    expect(CODE).toMatch(/if \(fixtureRollups\) return;/);
  });
});

/**
 * WAVE 5 — LOADING / DEGRADED STATES.
 *
 * Two defects, both about what the screen asserts when it does not actually
 * know:
 *   5. BARE SPINNER — the whole fetch (plus, on a cold-launch auth race, two
 *      retry backoffs) showed a lone centered ActivityIndicator on an empty
 *      canvas, then the summary card and seven day rows appeared out of
 *      nothing.
 *   6. SILENT STALE — a refresh that failed once history was already on screen
 *      set `error` and rendered NOTHING: last week's numbers kept the
 *      authority of a fresh read.
 */
describe('PerformanceSignalV3 — the loading window holds the shape, not a spinner', () => {
  it('mounts the store-free SignalSkeleton instead of a bare ActivityIndicator', () => {
    expect(CODE).toContain("import { SignalSkeleton } from './SignalSkeleton';");
    expect(CODE).toContain('<SignalSkeleton dayCount={RANGE_DAYS}');
    // The spinner is gone at the source: it can't come back by accident.
    expect(CODE).not.toContain('ActivityIndicator');
  });

  it('shapes the same number of day rows the window will actually deliver', () => {
    expect(CODE).toContain('const RANGE_DAYS = 7;');
    expect(CODE).toMatch(/<SignalSkeleton dayCount=\{RANGE_DAYS\}/);
  });

  it('keeps ONE progressbar wrapping the shape, so the blocks do not each announce', () => {
    const loading = CODE.slice(CODE.indexOf('testID="signal-v3-loading"') - 400, CODE.indexOf('testID="signal-v3-loading"') + 120);
    expect(loading).toContain('accessibilityRole="progressbar"');
    expect(loading).toContain("accessibilityLabel={t('signal.v3.loading_a11y')}");
    expect(loading).toContain('accessibilityLiveRegion="polite"');
  });
});

describe('PerformanceSignalV3 — a failed refresh says so instead of passing stale off as fresh', () => {
  it('renders the SHIPPED AFInlineErrorRow when a load failed but history is on screen', () => {
    expect(CODE).toMatch(/import\s*\{[\s\S]*?AFInlineErrorRow[\s\S]*?\}\s*from\s*'@\/components\/ui';/);
    expect(CODE).toContain('testID="signal-v3-stale"');
    expect(CODE).toContain("message={t('signal.v3.stale_notice')}");
  });

  it('offers the SAME existing retry path, not a second one', () => {
    // The row's retry is `onRefresh` — the pull-to-refresh loader that already
    // exists — so no divergent second fetch path can appear beside it.
    expect(CODE).toMatch(
      /message=\{t\('signal\.v3\.stale_notice'\)\}\s*onRetry=\{\(\) => void onRefresh\(\)\}/,
    );
    expect(CODE).toContain("retryLabel={t('signal.v3.retry')}");
    expect(CODE.match(/const load = React\.useCallback/g)).toHaveLength(1);
  });

  it('places the notice above the average it qualifies', () => {
    expect(CODE.indexOf('signal-v3-stale')).toBeLessThan(CODE.indexOf('testID="signal-v3-summary"'));
  });

  it('states what still works, not only what broke (founder rule: what happened · what still works · what to do)', () => {
    // Full-screen failure and inline-stale both carry the "you can still log"
    // half; without it the member cannot tell whether the app is usable.
    expect(V3.stale_notice).toMatch(/still works/i);
    expect(V3.load_failed_body).toMatch(/still counts|still works/i);
    // …and neither leaks internal vocabulary.
    for (const copy of [V3.stale_notice, V3.load_failed_body, V3.empty_body]) {
      expect(copy).not.toMatch(/\b(null|undefined|endpoint|rollup|API|500|error code)\b/i);
    }
  });
});
