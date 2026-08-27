/**
 * S2-14b — the Scan preview-tray tab row can never push an option off-screen.
 *
 * Device evidence (S2-14b matrix, iPhone 17 Pro at accessibility-extra-large):
 * the two preview pills outgrew the tray and "Other brands" clipped past the
 * screen edge — an option a large-type member could not discover or reach.
 *
 * The fix and its invariants, pinned source-scan style (house container
 * convention — this row lives behind store/query wiring, never mounted raw):
 *
 *   1. `tabRow` WRAPS (`flexWrap: 'wrap'`) and is width-bounded
 *      (`maxWidth: '100%'`), so an overflowing pill drops to the next line
 *      instead of leaving the viewport. Normal sizes still lay out on one
 *      line — the style change is inert until the pills no longer fit.
 *   2. Neither pill style fixes a width or height — the touch target grows
 *      with the label instead of clipping it.
 *   3. Both options are still rendered by the shell (testIDs pinned), so
 *      wrapping is the mechanism by which BOTH stay discoverable.
 *
 * NOTE: lives in `components/__tests__/` — `components/scan/__tests__/`
 * matches no vitest include glob and would silently never run.
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

function styleBlock(name: string): string {
  const start = kit.indexOf(`${name}: {`);
  expect(start, `scanKit no longer declares \`${name}\``).toBeGreaterThan(-1);
  return kit.slice(start, kit.indexOf('},', start));
}

describe('S2-14b — Scan preview tabs survive large Dynamic Type', () => {
  it('the tab row wraps within the tray instead of overflowing the screen', () => {
    const row = styleBlock('tabRow');
    expect(row).toContain("flexWrap: 'wrap'");
    expect(row).toContain("maxWidth: '100%'");
  });

  it("the tray card itself is width-clamped — 100% has to mean the screen, not the card's own overflow", () => {
    // Without this the row's maxWidth binds against a card already pushed
    // wide by its min-content, and the wrap never fires (observed live).
    expect(styleBlock('trayCard')).toContain("maxWidth: '100%'");
  });

  it('the picker CTA label shrinks instead of widening the card', () => {
    expect(shell).toMatch(/styles\.chipText, \{ color: af\.green, flexShrink: 1 \}/);
  });

  it('pill touch targets grow with their labels — no fixed box to clip them', () => {
    for (const name of ['tabPill', 'tabPillActive']) {
      const pill = styleBlock(name);
      expect(pill, `\`${name}\` must not fix a width`).not.toMatch(/(?<![a-zA-Z])width:/);
      expect(pill, `\`${name}\` must not fix a height`).not.toMatch(/(?<![a-zA-Z])height:/);
    }
  });

  it('both preview options are still rendered — wrapping is what keeps them discoverable', () => {
    expect(shell).toContain('testID="preview-tab-aforce"');
    expect(shell).toContain('testID="preview-tab-other"');
  });
});
