/**
 * S2-8 — Scan simplification locks.
 *
 * The Stage-2 audit's worst surface: four equally-dominant full-width CTAs
 * (camera + three identical `logAnyCta` blocks differing only by border
 * hue), a second HydroState verdict in raw statusColor, an unconditionally
 * animated success flash, hardcoded English relative-time, sub-44pt
 * controls, and raw color literals. Locked here:
 *   1. The viewfinder is the sole hero — the three secondary paths live in
 *      one disclosure sheet behind one quiet entry, handlers intact.
 *   2. One state, one verdict: this tool never re-prints the band.
 *   3. The success flash respects reduced motion (acknowledgment stays).
 *   4. Relative time is localized.
 *   5. No bare fontWeight, no hex-suffix alpha, no raw backdrop literals.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(__dirname, '..', 'scan', 'HydrationScanScreenV2.tsx'),
  'utf8',
);
const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

describe('S2-8 — one hero, one sheet', () => {
  it('the triple CTA block is extinct; one quiet entry opens the sheet', () => {
    expect(code).not.toContain('logAnyCta');
    expect(code).toContain('testID="hydroscan-other-ways"');
  });

  it('the three paths live inside the disclosure sheet with handlers intact', () => {
    const sheet = /<AFDisclosureSheet[\s\S]*?<\/AFDisclosureSheet>/.exec(code)?.[0] ?? '';
    for (const id of ['hydroscan-log-any-drink', 'hydroscan-smart-capture', 'hydroscan-urine-check']) {
      expect(sheet).toContain(`testID="${id}"`);
    }
    expect(sheet).toContain('setAddDrinkOpen(true)');
    expect(sheet).toContain('setSmartCaptureOpen(true)');
    expect(sheet).toContain("router.push('/urine-check'");
  });

  it('this tool never re-prints the HydroState verdict', () => {
    // performanceState.level still flows as DATA into the scan context
    // (line ~248) — that is scoring input, not a rendered verdict. The
    // lock therefore pins the render: no pill, no band color in JSX.
    expect(code).not.toContain('statePill');
    expect(code).not.toContain('performanceState.color');
  });
});

describe('S2-8 — motion, i18n, targets, tokens', () => {
  it('the success flash tween is reduced-motion gated; the moment survives', () => {
    expect(code).toMatch(/if \(!reducedMotion\) flashOpacity\.value = withSequence\(/);
    expect(code).toContain("fireMoment('hydration_logged')");
  });

  it('relative time is localized — no hardcoded English', () => {
    expect(code).not.toContain("'just now'");
    expect(code).not.toMatch(/\$\{m\}m ago/);
    expect(code).toContain("t('hydroScan2.v2.time_just_now')");
  });

  it('no bare fontWeight, no hex-suffix alpha, no raw backdrop literal', () => {
    expect(code).not.toMatch(/fontWeight\s*:/);
    expect(code).not.toMatch(/\$\{af\.\w+\}[0-9A-F]{2}/);
    expect(code).not.toContain("rgba(0,0,0,0.7)");
    expect(code).not.toContain("'#05090E'");
  });

  it('the manual controls meet the 44pt floor', () => {
    expect(code).toMatch(/manualBtn: \{\s*minWidth: 44, minHeight: 44,/);
    expect(code).toMatch(/manualInput: \{\s*minHeight: 44,/);
  });
});
