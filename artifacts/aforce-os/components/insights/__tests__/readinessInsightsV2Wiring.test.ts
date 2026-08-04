/**
 * ReadinessInsightsV2 — back + share wiring guard (RC-1 audit, P0 live bug).
 *
 * `ReadinessInsightsV2` pulls in `useAppStore` / `expo-router` / the full
 * weekly-report data pipeline (`usePerformanceAge`, analytics snapshot fetch,
 * `buildWeeklyReport`) — the same category of store+router-connected
 * container this repo's existing tests deliberately never mount directly
 * (see `components/health/__tests__/connectedHealthContainer.render.test.tsx`'s
 * own header, which documents why `ConnectedHealthContainer` is unmounted and
 * instead pinned via a source-text guard). This file applies that same
 * established pattern here: it reads the component's source, strips
 * comments, and asserts the exact wiring the fix requires is present — and
 * that the pre-fix bug (`AFTopBar` with no `onBack`/no share action) is
 * absent — rather than attempting a full mount that would need to fabricate
 * a store, a router, and a performance-age/analytics pipeline this suite has
 * no existing harness for.
 *
 * The underlying pure logic this wiring calls into (`buildWeeklyReport`,
 * section ordering, `sectionSummary`) is independently covered by
 * `utils/__tests__/weeklyReport.test.ts`; this file is scoped to the wiring
 * only — did the fix actually connect the button to the right calls.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'ReadinessInsightsV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('ReadinessInsightsV2 — AFTopBar back + share wiring (RC-1 P0)', () => {
  it('wires onBack to the guarded canGoBack() pattern (RC-1 verdict-pass item 4), matching app/weekly-report.tsx', () => {
    expect(CODE).toMatch(
      /onBack=\{\(\)\s*=>\s*\(router\.canGoBack\(\)\s*\?\s*router\.back\(\)\s*:\s*router\.replace\('\/'\)\)\}/,
    );
    // The old, unguarded call (a P0 crash risk when there's no back history —
    // e.g. deep link entry) must not reappear.
    expect(CODE).not.toMatch(/onBack=\{\(\)\s*=>\s*router\.back\(\)\}/);
  });

  it('no longer renders AFTopBar with neither onBack nor actions (the pre-fix bug)', () => {
    const bareTopBar = /<AFTopBar\s+eyebrow=\{t\('reports\.v2\.eyebrow'\)\}\s+title=\{t\('reports\.v2\.title'\)\}\s*\/>/;
    expect(CODE).not.toMatch(bareTopBar);
  });

  it('wires a share action into AFTopBar actions, reusing the existing share_a11y i18n key', () => {
    expect(CODE).toMatch(/actions=\{\[\{\s*icon:\s*'share',\s*onPress:\s*onShare,\s*label:\s*t\('reports\.share_a11y'\)\s*\}\]\}/);
  });

  it('onShare composes the report through the same primitives as the legacy screen (openShareSheet + recap format)', () => {
    expect(CODE).toContain('openShareSheet({ format: \'recap\'');
    expect(CODE).toContain('buildWeeklyReport(');
    expect(CODE).toContain('sectionSummary(t, s)');
  });

  it('the share-section order matches the legacy 7-section order exactly', () => {
    expect(CODE).toContain(
      "const SHARE_SECTION_ORDER: WeeklyReportSectionKey[] = [\n  'improved',\n  'attention',\n  'performanceAge',\n  'habitVelocity',\n  'recovery',\n  'topCommand',\n  'nextWeekFocus',\n];",
    );
  });

  it('the analytics snapshot fetch backing the share flow has a .catch (no unhandled rejection)', () => {
    expect(CODE).toMatch(/getAnalyticsSnapshot\(\)\s*\.then\([\s\S]*?\)\s*\.catch\(/);
  });
});

describe('ReadinessInsightsV2 — loading skeleton vs. honest empty state (RC-1 Wave-2B, item 2c)', () => {
  it('imports the store-free ReadinessInsightsSkeleton', () => {
    expect(CODE).toContain("import { ReadinessInsightsSkeleton } from './ReadinessInsightsSkeleton';");
  });

  it('tracks analyticsLoading, defaulting true, and clears it on EITHER fetch outcome via .finally', () => {
    expect(CODE).toContain('const [analyticsLoading, setAnalyticsLoading] = React.useState(true);');
    expect(CODE).toMatch(/getAnalyticsSnapshot\(\)[\s\S]*?\.finally\(\(\)\s*=>\s*\{\s*if\s*\(!cancelled\)\s*setAnalyticsLoading\(false\);/);
  });

  it('shows the skeleton only while short-history AND still loading; the honest empty state is untouched once settled', () => {
    expect(CODE).toMatch(/scores\.length\s*<\s*2\s*&&\s*analyticsLoading\s*\?\s*\(\s*<ReadinessInsightsSkeleton\s*\/>\s*\)\s*:\s*scores\.length\s*<\s*2\s*\?\s*\(/);
    // The pre-existing empty-state copy/props are byte-identical — this fix
    // only inserted a branch BEFORE it, never edited it.
    expect(CODE).toContain("icon=\"activity\"");
    expect(CODE).toContain("title={t('reports.v2.empty_title')}");
    expect(CODE).toContain("message={t('reports.v2.empty_message')}");
  });

  it('analyticsLoading is referenced exactly where expected: the state declaration and the one render condition (no stray second gate)', () => {
    const occurrences = CODE.split('analyticsLoading').length - 1;
    expect(occurrences).toBe(2);
  });
});
