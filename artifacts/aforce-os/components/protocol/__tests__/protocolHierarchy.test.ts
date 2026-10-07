/**
 * ProtocolScreenV2 — reading order and honest-sparse states (Wave-5).
 *
 * Two audited defects, both about what the screen LEADS with:
 *
 * 1. PROGRESS LED. A day chip, a completion ring and a hydration bar sat above
 *    the one step that was actually due, and the chip repeated the streak and
 *    the completion count that the ring and the "Completed today" head already
 *    carried — the same two facts three times, before the member saw anything
 *    to act on. The founder's order is TODAY → NEXT → WHY → PROGRESS, so the
 *    active step leads, the recheck figure is stated once, and everything that
 *    only reports distance travelled is one block below the fold.
 *
 * 2. HONEST SPARSENESS READ AS BREAKAGE. After Wave-2 removed the fabricated
 *    compliance data, "Completed today" rendered nothing at all on a day with
 *    nothing done, and "Recovery signals" drew two bordered tiles each showing
 *    a bare em dash. Both now say what they are. The lock also pins that
 *    neither replacement smuggled a number back in — the fix for fabricated
 *    completeness cannot be more fabricated completeness.
 *
 * `ProtocolScreenV2` is a store-connected container this suite never mounts
 * (the convention in circleV3TrustHierarchy.test.ts); JSX-level facts are
 * source-guarded here and the branching logic is proved as a pure function in
 * protocolV3Presentation.test.ts. Style assertions resolve through the imported
 * `afType` rather than naming pixel sizes, so the lock survives a token retune.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { af, afType } from '@/theme';

const PKG = join(__dirname, '..', '..', '..');
const SRC = readFileSync(join(PKG, 'components', 'protocol', 'ProtocolScreenV2.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const V3 = (
  JSON.parse(readFileSync(join(PKG, 'locales', 'en.json'), 'utf8')) as {
    protocol: { v3: Record<string, string> };
  }
).protocol.v3;

/** Position of a marker in the render body, asserted to exist. */
function at(marker: string): number {
  const i = CODE.indexOf(marker);
  expect(i, `"${marker}" must appear in ProtocolScreenV2`).toBeGreaterThan(-1);
  return i;
}

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
  return (afType[m![1] as keyof typeof afType] as { fontSize: number }).fontSize;
}

describe('ProtocolScreenV2 — TODAY → NEXT → WHY → PROGRESS', () => {
  // Black Issue (#1088): the component carries the flag-off V2 branch FIRST
  // in source and the V3 branch after it, so a plain first-match `at()` would
  // resolve every V3 anchor inside the flag-off branch and test nothing
  // (review should-fix 1). The V3 assertions run on the V3 slice only.
  const V3_START = CODE.indexOf('testID="protocol-v3-masthead"');
  const V3 = CODE.slice(V3_START);
  const atV3 = (needle: string): number => {
    const i = V3.indexOf(needle);
    expect(i, `"${needle}" must appear in the V3 branch of ProtocolScreenV2`).toBeGreaterThan(-1);
    return i;
  };

  it('V3 renders the recheck hero, then the step rail, the footer readout, the WHY control and the progress block — in that order', () => {
    expect(V3_START).toBeGreaterThan(-1);
    const recheck = atV3('testID="protocol-v3-recheck"');
    const rail = atV3('testID="protocol-v3-steps"');
    const hydration = atV3('testID="protocol-v3-hydration"');
    const why = atV3("t('protocol.v2.why_this_plan')");
    const progress = atV3("t('protocol.v3.progress')");
    expect(recheck).toBeLessThan(rail);
    expect(rail).toBeLessThan(hydration);
    expect(hydration).toBeLessThan(why);
    expect(why).toBeLessThan(progress);
  });

  it('puts the completion ring and the streak below the step rail', () => {
    const rail = atV3('testID="protocol-v3-steps"');
    expect(atV3('testID="protocol-v3-hero"')).toBeGreaterThan(rail);
  });

  it('the flag-off branch still leads with the active step, then NEXT, WHY, PROGRESS', () => {
    const OFF = CODE.slice(0, V3_START);
    const today = OFF.indexOf('testID="protocol-active-step"');
    const next = OFF.indexOf("t('protocol.v2.next')");
    const why = OFF.indexOf("t('protocol.v2.why_this_plan')");
    expect(today).toBeGreaterThan(-1);
    expect(today).toBeLessThan(next);
    expect(next).toBeLessThan(why);
  });

  it('the hydration readout is stated once, in the two-up footer after the step rail (Black Issue layout)', () => {
    // Black Issue restyle (docs/black-issue-restyle-plan.md §4 item 3,
    // 2026-10-06): the reference places HYDRATION / RECOVERY SIGNALS as a
    // two-up footer directly under the step rail, not inside the progress
    // card. The hierarchy rule survives in its intent — the readout appears
    // exactly once, after the rail, and never as a second stacked block.
    const hydration = atV3('testID="protocol-v3-hydration"');
    const rail = atV3('testID="protocol-v3-steps"');
    expect(hydration).toBeGreaterThan(rail);
    expect(CODE.match(/testID="protocol-v3-hydration"/g)).toHaveLength(1);
  });
});

describe('ProtocolScreenV2 — each fact is stated once', () => {
  it('the day chip is gone, along with the streak/progress it repeated', () => {
    expect(CODE).not.toContain('protocol-v3-chip');
    expect(CODE).not.toContain("t('protocol.v3.chip'");
    expect(V3.chip).toBeUndefined();
  });

  it('the next-recheck figure is rendered exactly once', () => {
    // It used to sit on the hero ("Next check 45 min") AND in the active
    // card's footer ("NEXT RECHECK 45 min") — the same number, one scroll
    // apart. The active card is where the member acts, so it keeps it.
    const renders = CODE.match(/protocol\.v2\.recheck_minutes/g) ?? [];
    expect(renders).toHaveLength(1);
    expect(CODE).not.toContain("t('protocol.v3.next_check')");
    expect(V3.next_check).toBeUndefined();
    expect(V3.check_minutes).toBeUndefined();
  });
});

describe('ProtocolScreenV2 — WHY no longer costs a tap', () => {
  it('reduces the plan description to one inline line via the shared helper', () => {
    expect(CODE).toContain('commandReasonLine(protocol.description)');
    expect(CODE).toContain('testID="protocol-active-reason"');
    // Inline, on the active card — before the disclosure control.
    expect(at('testID="protocol-active-reason"')).toBeLessThan(at("t('protocol.v2.why_this_plan')"));
  });

  it('keeps the disclosure, which still says more than the inline line', () => {
    // The sheet carries stage + full description + the real-or-adaptive
    // compliance sentence, so it is never a control that reveals what is
    // already on screen.
    expect(CODE).toContain('<AFDisclosureSheet');
    expect(CODE).toContain('why_adaptive');
  });

  it('draws the reason quieter than the step it supports', () => {
    expect(fontSizeOf('activeReason')).toBeLessThan(fontSizeOf('activeTitle'));
    expect(fontSizeOf('activeReason')).toBeLessThanOrEqual(fontSizeOf('activeWindow'));
    expect(styleBlock('activeReason')).toContain('af.textTertiary');
  });
});

describe('ProtocolScreenV2 — sparse states read as deliberate, not broken', () => {
  it('says so when nothing is completed instead of dropping the section', () => {
    expect(CODE).toContain('testID="protocol-v3-completed-empty"');
    expect(CODE).toContain("t('protocol.v3.completed_empty')");
    // The section header + counter render unconditionally now; only the body
    // branches. (Previously the whole block was behind `length > 0`.)
    const section = CODE.slice(at('testID="protocol-v3-completed"'));
    expect(section.indexOf("t('protocol.v3.completed_today')")).toBeLessThan(
      section.indexOf('completedSteps.length > 0'),
    );
  });

  it('replaces two bare em-dash tiles with one honest sentence', () => {
    expect(CODE).toContain('anySignalReported(v3Data.hrText, v3Data.hrvText)');
    expect(CODE).toContain('testID="protocol-v3-signals-empty"');
    expect(CODE).toContain("t('protocol.v3.signals_empty')");
  });

  it('neither replacement invents a number, a percentage or a placeholder row', () => {
    for (const key of ['completed_empty', 'signals_empty'] as const) {
      const copy = V3[key]!;
      expect(copy, `protocol.v3.${key} must exist`).toBeTruthy();
      expect(copy, `protocol.v3.${key} must not state a figure`).not.toMatch(/\d|%/);
    }
  });

  it('the completed counter is neutral, since it now renders at 0 of 4 too', () => {
    // af.green on "0 / 4" would read as approval for a day where nothing has
    // happened — the certainty inversion Wave 5 is removing everywhere.
    expect(styleBlock('v3Count')).toContain('af.textTertiary');
    expect(styleBlock('v3Count')).not.toContain('af.green');
    expect(af.textTertiary).not.toBe(af.green);
  });
});

/**
 * Wave-5 motion pass — RITUAL PROGRESSION is wired on this screen.
 *
 * Source-guarded for the same reason as everything else in this file:
 * `ProtocolScreenV2` is a store-connected container the suite never mounts. The
 * gate's LOGIC is proved as a pure function in protocolV3Presentation.test.ts
 * (`shouldAcknowledgeProgress`) and the ring's reveal-then-advance behavior in
 * components/ui/__tests__/AFReadinessArc.motion.render.test.tsx; this pins that
 * the screen actually uses both.
 */
describe('ProtocolScreenV2 — Ritual progression (Wave-5 signature moment)', () => {
  const MOTION_SRC = readFileSync(join(__dirname, '..', 'ProtocolScreenV2.tsx'), 'utf8');
  const MOTION_CODE = MOTION_SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

  it('animates the hero completion ring so a finished step is visible as movement', () => {
    const ring = MOTION_CODE.slice(
      MOTION_CODE.indexOf('<AFReadinessArc'),
      MOTION_CODE.indexOf('>', MOTION_CODE.indexOf('<AFReadinessArc')),
    );
    expect(ring).toContain('ringFraction(completedCount, total)');
    expect(ring).toMatch(/\banimate\b/);
  });

  it("fires the 'ritual_progressed' moment through the shared façade", () => {
    expect(MOTION_CODE).toContain("import { fireMoment } from '@/services/haptics';");
    expect(MOTION_CODE).toContain("fireMoment('ritual_progressed')");
    expect(MOTION_CODE).not.toMatch(/from 'expo-haptics'/);
  });

  it('gates that haptic on the pure, tested increase rule — not an inline comparison', () => {
    expect(MOTION_CODE).toContain('shouldAcknowledgeProgress');
    expect(MOTION_CODE).toMatch(
      /if \(shouldAcknowledgeProgress\(prev, completedCount\)\) fireMoment\('ritual_progressed'\);/,
    );
  });

  it('fires no other haptic moment from this screen', () => {
    const moments = MOTION_CODE.match(/fireMoment\(/g) ?? [];
    expect(moments).toHaveLength(1);
  });

  it('starts no ambient loop — the Protocol surface stays calm', () => {
    expect(MOTION_CODE).not.toMatch(/withRepeat/);
  });
});
