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
    expect(CODE).toMatch(
      /completenessChip\(historyCompletenessLevel\(recap\.daysTracked, RANGE_DAYS\)\)/,
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
