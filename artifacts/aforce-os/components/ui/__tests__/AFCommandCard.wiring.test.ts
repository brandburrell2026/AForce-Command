/**
 * AFCommandCard + AFReadinessArc — Wave-5 wiring guards.
 *
 * Both components pull `react-native-reanimated` (via AFMotionPressable) and
 * `react-native-svg`, and AFButton reads the flags slice, so neither can be
 * mounted here — the same constraint documented in
 * `components/home/__tests__/homeScreenV2Wiring.test.ts`'s header, and the
 * reason `components/nightOut/__tests__/nightOutCommandView.render.test.tsx`
 * mocks the arc away entirely. So the DECISIONS are unit-tested where they
 * live (`commandReasonLine` in afPrimitives.logic.test.ts) and this file pins
 * that the components actually consume them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const CARD = strip(readFileSync(join(__dirname, '..', 'AFCommandCard.tsx'), 'utf8'));
const ARC = strip(readFileSync(join(__dirname, '..', 'AFReadinessArc.tsx'), 'utf8'));

describe('AFCommandCard — the reason is answered inline, not behind a tap (Wave 5)', () => {
  it('derives the one-line reason from the pure, tested helper (never its own crop)', () => {
    expect(CARD).toContain("import { commandReasonLine } from './afPrimitives.logic';");
    expect(CARD).toMatch(/const\s+reason\s*=\s*commandReasonLine\(rationale\);/);
  });

  it('renders the reason in the card body — outside the disclosure branch', () => {
    const beforeActions = CARD.slice(0, CARD.indexOf('styles.actions'));
    expect(beforeActions).toContain('af-command-reason');
    expect(beforeActions).toMatch(/\{reason\s*&&/);
    // It must not be gated on the disclosure's open state — that was the defect.
    expect(CARD).not.toMatch(/showWhy\s*&&\s*<Text style=\{styles\.reason\}/);
  });

  it('keeps it to ONE line so the card never becomes a paragraph', () => {
    expect(CARD).toMatch(/numberOfLines=\{1\}/);
    expect(CARD).toMatch(/ellipsizeMode="tail"/);
  });

  it('shows the disclosure only when the full rationale says more than the line', () => {
    expect(CARD).toMatch(/\{reason\?\.hasMore\s*&&/);
    // The full text still lives behind it — nothing was thrown away.
    expect(CARD).toMatch(/showWhy\s*&&\s*<Text style=\{styles\.rationale\}>\{rationale\}<\/Text>/);
  });

  it('keeps the reason visually subordinate to the command it explains', () => {
    // Tertiary caption vs the instruction's body/secondary — the reason
    // supports the one action, it never competes with it.
    expect(CARD).toMatch(/reason:\s*\{\s*\.\.\.afType\.caption,\s*color:\s*af\.textTertiary/);
  });
});

describe('AFReadinessArc — can be hidden from assistive tech (Wave 5 a11y)', () => {
  it('accepts a11yHidden, defaulting to false so existing callers are unchanged', () => {
    expect(ARC).toMatch(/a11yHidden\?:\s*boolean;/);
    expect(ARC).toMatch(/a11yHidden\s*=\s*false,/);
  });

  it('drops the progressbar role AND hides descendants when set', () => {
    // Role alone is not enough: the centered score/state children would still
    // be read, so the labelled ancestor's announcement would be duplicated.
    expect(ARC).toMatch(/accessibilityRole=\{a11yHidden \? undefined : 'progressbar'\}/);
    expect(ARC).toMatch(/accessibilityValue=\{a11yHidden \? undefined : \{ min: 0, max: 100, now: pct \}\}/);
    expect(ARC).toMatch(/accessibilityElementsHidden=\{a11yHidden\}/);
    expect(ARC).toMatch(/importantForAccessibility=\{a11yHidden \? 'no-hide-descendants' : undefined\}/);
  });
});
