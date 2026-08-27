/**
 * S2-9b — the Sweat calculator's shadow-kit is retired into real kit files.
 *
 * Source-scan lock (house container convention): pins the extraction's
 * MECHANISM so it cannot silently unwind:
 *
 *   1. one-way chain — screen -> sweatResultKit -> sweatKit; neither kit may
 *      import from the screen, and sweatKit may not import sweatResultKit;
 *   2. one stylesheet — only sweatKit declares StyleSheet.create;
 *   3. single family source of truth — no hand-written `'Inter_*'` family
 *      string literal anywhere on the Sweat surface (S2-4/S2-8b precedent:
 *      families come from `Typography.fonts.*`, whose values ARE the strings);
 *   4. the screen consumes the form primitives from sweatKit and the result
 *      pane from sweatResultKit.
 *
 * NOTE: this file lives in `components/__tests__/` deliberately —
 * `components/sweat/__tests__/` matches no vitest include glob and would
 * silently never run.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const shell = stripComments(read('components/sweat/SweatCalculatorScreenV2.tsx'));
const kit = stripComments(read('components/sweat/sweatKit.tsx'));
const resultKit = stripComments(read('components/sweat/sweatResultKit.tsx'));

describe('S2-9b — sweatKit extraction holds', () => {
  it('the dependency chain is one-way: screen -> sweatResultKit -> sweatKit', () => {
    expect(kit).not.toMatch(/from\s+'\.\/SweatCalculatorScreenV2'/);
    expect(kit).not.toMatch(/from\s+'\.\/sweatResultKit'/);
    expect(resultKit).not.toMatch(/from\s+'\.\/SweatCalculatorScreenV2'/);
    expect(resultKit).toMatch(/import \{ styles \} from '\.\/sweatKit';/);
  });

  it('the single stylesheet lives in sweatKit', () => {
    expect(shell).not.toContain('StyleSheet.create');
    expect(resultKit).not.toContain('StyleSheet.create');
    expect(kit.match(/StyleSheet\.create/g)).toHaveLength(1);
    expect(kit).toContain('export const styles = StyleSheet.create({');
  });

  it('no hand-written Inter family literal survives on the Sweat surface', () => {
    expect(shell + kit + resultKit).not.toMatch(/'Inter_\d/);
    expect(kit).toContain('Typography.fonts.bold');
  });

  it('the screen consumes the primitives from sweatKit and the result pane from sweatResultKit', () => {
    expect(shell).toMatch(/from '\.\/sweatKit';/);
    expect(shell).toMatch(
      /import \{ CitationCard, ResultPane \} from '\.\/sweatResultKit';/,
    );
    for (const c of ['ResultPane', 'CitationCard']) {
      expect(resultKit).toContain(`export function ${c}(`);
      expect(shell).not.toContain(`function ${c}(`);
    }
    for (const c of ['ModeSegment', 'NumberRow', 'SportPicker', 'SweatLossSnapshot']) {
      expect(kit).toContain(`export function ${c}(`);
      expect(shell).not.toContain(`function ${c}(`);
    }
  });
});
