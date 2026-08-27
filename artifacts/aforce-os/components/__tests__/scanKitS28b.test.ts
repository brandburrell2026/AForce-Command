/**
 * S2-8b — the Scan presentational layer lives in `scan/scanKit.tsx`.
 *
 * Source-scan lock (house container convention — see the header of
 * `hydrationScreenV2OfflineBannerWiring.test.ts`): these pin the extraction's
 * MECHANISM so it cannot silently unwind:
 *
 *   1. one-way dependency — the kit never imports from the screen;
 *   2. one stylesheet — the shell no longer declares its own StyleSheet;
 *   3. single family source of truth — no hand-written `'Inter_*'` family
 *      string literals anywhere on the Scan surface (S2-4 precedent: families
 *      come from `Typography.fonts.*`, whose values ARE those strings);
 *   4. the four pure helpers live in the kit and the shell consumes them
 *      from there.
 *
 * NOTE: this file lives in `components/__tests__/` deliberately —
 * `components/scan/__tests__/` matches no vitest include glob and would
 * silently never run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const shell = stripComments(read('components/scan/HydrationScanScreenV2.tsx'));
const kit = stripComments(read('components/scan/scanKit.tsx'));

describe('S2-8b — scanKit extraction holds', () => {
  it('the kit is one-way: it never imports from the screen', () => {
    expect(kit).not.toMatch(/from\s+'\.\/HydrationScanScreenV2'/);
  });

  it('the shell no longer declares a stylesheet — the single sheet lives in the kit', () => {
    expect(shell).not.toContain('StyleSheet.create');
    expect(kit.match(/StyleSheet\.create/g)).toHaveLength(1);
    expect(kit).toContain('export const styles = StyleSheet.create({');
  });

  it('no hand-written Inter family literal survives on the Scan surface', () => {
    // Families come from Typography.fonts.* (whose VALUES are these strings);
    // a reintroduced literal forks the source of truth again.
    expect(shell + kit).not.toMatch(/'Inter_\d/);
    expect(kit).toContain('Typography.fonts.bold');
  });

  it('the four pure helpers live in the kit and the shell imports them from there', () => {
    for (const h of ['verdictColor', 'impactColor', 'toTextSafeColor', 'formatRelativeTime']) {
      expect(kit).toContain(`export function ${h}(`);
      expect(shell).not.toContain(`function ${h}(`);
    }
    expect(shell).toMatch(
      /import \{ styles, verdictColor, impactColor, toTextSafeColor, formatRelativeTime \} from '\.\/scanKit';/,
    );
  });
});
