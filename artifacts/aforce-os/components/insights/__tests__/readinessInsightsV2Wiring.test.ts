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
  it('wires onBack to router.back()', () => {
    expect(CODE).toMatch(/onBack=\{\(\)\s*=>\s*router\.back\(\)\}/);
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
