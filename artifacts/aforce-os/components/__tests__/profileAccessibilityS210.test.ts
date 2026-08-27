/**
 * S2-10 wave 1 — Profile P0 accessibility locks.
 *
 * The audit's three AA contrast failures on this screen — dark glyph and
 * label literals on the af.red fill, including the PRIMARY internal
 * navigation's active tab label (~3.59:1) — take the AA-verified on-red
 * token that SignIn documented long ago. The pill bar gets the 44pt
 * floor; the identity hero gets its first Dynamic Type clamp.
 *
 * The in-content HOME pill was audited as "a third navigation system" —
 * the code documents why it exists (iOS 7-tab More-stack needs an
 * in-content back) and it is deliberately KEPT; this suite pins the
 * documented reason so a future pass cannot delete it as noise without
 * meeting the comment.
 *
 * The full pane split is S2-10b (founder decision pending).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// S2-10b(1): shell + kit scanned together — the styles this suite pins
// (tabPill, onRed labels) moved verbatim into profileKit.tsx.
const src =
  readFileSync(resolve(__dirname, '..', 'profile', 'ProfileScreenV2.tsx'), 'utf8') +
  readFileSync(resolve(__dirname, '..', 'profile', 'profileKit.tsx'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

describe('S2-10 — AA on red, everywhere on this screen', () => {
  it('no dark-on-red literal survives', () => {
    expect(code).not.toContain('"#0A0A0F"');
    expect(code).not.toContain("'#0A0A0F'");
    expect(code).not.toContain("'#000000'");
  });

  it('the active tab label and invite controls take af.onRed', () => {
    expect(code).toMatch(/tabPillLabelActive: \{\s*color: af\.onRed,/);
    expect(code).toContain('color={af.onRed}');
  });
});

describe('S2-10 — targets', () => {
  it('the primary internal navigation meets the 44pt floor', () => {
    expect(code).toMatch(/tabPill: \{\s*minHeight: 44,/);
  });

  // Dynamic Type on this screen is governed by the STANDING Correction-7
  // ruling (profileIdentityCardTruncation.test.ts): unbounded scaling with
  // accommodating layout — no clamps, no shrink-to-fit. An S2-10 clamp was
  // written and REVERTED when that lock caught it; the ruling outranks the
  // house display clamp here.
});

describe('S2-10 — the More-stack back affordance stays, for its stated reason', () => {
  it('the HOME pill and its platform rationale are both present', () => {
    expect(code).toContain('testID="profile-back-home"');
    expect(src).toContain('"More" overflow');
  });
});
