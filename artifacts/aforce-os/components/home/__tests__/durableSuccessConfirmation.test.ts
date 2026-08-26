/**
 * DURABLE SUCCESS CONFIRMATION — success is claimed only for a write that landed.
 *
 * Build 65 recorded two 12 oz intakes 52 seconds apart from one reported tap.
 * Both rows read `score 100 → 100`: the member was already capped, so every cue
 * in the success overlay — the gain pill ("+0"), the trend arrow, "was 100 → now
 * 100" — was indistinguishable from nothing having happened. A member who cannot
 * tell whether a log landed logs again. That is a double-entry risk in ordinary
 * use, independent of whatever caused the Build-65 duplicate.
 *
 * Locked here:
 *   1. The overlay states WHAT WAS RECORDED, independent of the score.
 *   2. That fact is built from the CONFIRMED server log, never optimistically.
 *   3. Failure claims nothing — CYCLE_FAILURE clears the result.
 *   4. The success surface cannot itself invite a second log.
 *
 * Source-scanned for the same reason as the sibling suites: the assertion is
 * about which value each site DECLARES, and the store/overlay wiring is already
 * covered by the render harnesses.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PKG = resolve(__dirname, '..', '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(PKG, rel), 'utf8');
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('successful write produces unmistakable confirmation', () => {
  const overlay = read('components/CycleSuccessOverlay.tsx');
  const types = read('types/index.ts');

  it('CycleResult carries what was recorded, not only the score', () => {
    expect(
      /recordedLabel:\s*string/.test(types),
      'CycleResult must carry recordedLabel so confirmation can be stated without score movement.',
    ).toBe(true);
  });

  it('the overlay renders the recorded fact', () => {
    const src = stripComments(overlay);
    expect(src).toMatch(/result\.recordedLabel/);
    expect(
      /testID="cycle-success-recorded"/.test(src),
      'the recorded-fact line needs a stable testID for device and render assertions',
    ).toBe(true);
  });

  it('the confirmation does not depend on the score having moved', () => {
    // The recorded line must not be conditional on gain/delta being non-zero —
    // that is exactly the capped case this exists for.
    const src = stripComments(overlay);
    const line = /recordedRow[\s\S]{0,400}?recordedLabel/.exec(src)?.[0] ?? '';
    expect(line).not.toMatch(/positive\s*\?/);
    expect(line).not.toMatch(/gainDisplay/);
    expect(line).not.toMatch(/scoreAfter\s*[!=><]/);
  });

  it('no fabricated score movement was introduced', () => {
    const src = stripComments(overlay);
    // The overlay must still render the REAL before/after; nothing may synthesise
    // a delta to create the appearance of movement.
    expect(src).toMatch(/result\.scoreBefore/);
    expect(src).toMatch(/result\.scoreAfter/);
    expect(/scoreAfter\s*\+\s*1|Math\.max\(1,/.test(src)).toBe(false);
  });
});

describe('confirmation reflects durable success only', () => {
  const actions = stripComments(read('store/app/actions.ts'));
  const home = stripComments(read('components/home/HomeScreenV2.tsx'));

  it('the recorded label is built from the confirmed server log', () => {
    // `log` is the response the server returned. Building the label from the
    // optimistic projection would let the overlay claim a write that never
    // landed.
    expect(actions).toMatch(/recordedLabel:\s*`\$\{log\.ozAmount\}/);
  });

  it('a failed write claims no success', () => {
    // CYCLE_FAILURE must still be dispatched on the failure path, and Home must
    // refuse to fire the completion moment without a settled result.
    expect(actions).toMatch(/CYCLE_FAILURE/);
    expect(
      /if \(!lastCycleResult\) return;/.test(home),
      'Home must not claim completion when CYCLE_FAILURE cleared the result',
    ).toBe(true);
  });
});

describe('the success state cannot invite a second log', () => {
  const home = stripComments(read('components/home/HomeScreenV2.tsx'));

  it('the picker refuses to open while confirmed success is shown', () => {
    // Scoped to openWaterPicker's OWN early-return, not merely "the identifier
    // appears somewhere nearby" — a neighbouring function mentioning
    // showCycleSuccess satisfied the looser form even after the guard was
    // deleted, which a mutation run caught.
    const fn = /const openWaterPicker[\s\S]*?\}, \[[^\]]*\]\);/.exec(home)?.[0] ?? '';
    expect(fn, 'openWaterPicker not found').not.toBe('');
    expect(
      /if \([^)]*showCycleSuccess[^)]*\)\s*return;/.test(fn),
      'openWaterPicker must refuse while the success overlay is up',
    ).toBe(true);
  });

  it('confirming refuses while confirmed success is shown', () => {
    expect(/confirmWaterAmount[\s\S]{0,300}?showCycleSuccess\) return;/.test(home)).toBe(true);
  });

  it('the guard is bounded by the overlay, not an arbitrary timer', () => {
    // A setTimeout-based lockout would outlive the surface it protects and
    // silently swallow a legitimate second log.
    const guard = /const openWaterPicker[\s\S]*?\}, \[[^\]]*\]\);/.exec(home)?.[0] ?? '';
    expect(guard).not.toMatch(/setTimeout|Date\.now\(\)|LOCKOUT|cooldown/i);
  });
});
