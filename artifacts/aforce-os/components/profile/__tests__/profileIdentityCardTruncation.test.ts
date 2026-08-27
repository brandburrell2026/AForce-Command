/**
 * ProfileScreenV2 identity card — truncation lock (Build 61, Correction 7).
 *
 * Build 60 failed physical-device QA with the Primary Goal rendering as
 * "Recovery O…". Root cause, both halves required:
 *   1. `profileMetricStrip` was a hard three-across row of `flex: 1` cells, so
 *      the goal — the only PROSE value in a strip of short numerics — was
 *      handed a third of the card (~91pt at 375pt, ~73pt at 320pt), and
 *   2. the goal's `<Text>` carried `numberOfLines={1}`, which turns "does not
 *      fit" into "ellipsize" instead of "wrap".
 * "Recovery Optimization" needs ~190pt at the card's 14pt bold. It never fit,
 * on any iPhone — the arithmetic below proves the old geometry could not have
 * rendered it whole even on a Pro Max.
 *
 * WHICH TEST CONVENTION AND WHY: `ProfileScreenV2` is one of this repo's
 * container screens that is never mounted directly (expo-router / @clerk/expo /
 * the WHOOP+Garmin+Apple service modules hit the documented `__DEV__` load
 * wall — see `profileScreenV2ErrorAndSkeletonWiring.test.ts`'s header), so its
 * suites are source-text guards. This file follows that convention and pairs
 * it with layout arithmetic at the four required conditions (320 / 375 / 430pt
 * and large Dynamic Type). A structural lock is in fact the stronger claim
 * here: "this text can always wrap and always shrink" holds at EVERY width and
 * EVERY text scale, where a screenshot only ever covers the widths sampled.
 *
 * The fix is layout, not typography: the founder forbade solving this with a
 * smaller font, disabled font scaling, clipping, or dropped content, so the
 * font-size and font-scaling assertions below are part of the lock.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PRIMARY_GOALS } from '@/utils/profileIdentity';

// S2-10b(1): the shared primitives + StyleSheet moved verbatim to
// profileKit.tsx; both files are scanned so every assertion keeps its
// original target. The Correction-7 invariant (no clamps, no shrink) now also guards the kit.
const SOURCE =
  readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8') +
  readFileSync(join(__dirname, '..', 'profileKit.tsx'), 'utf8');
// Comments stripped first — this file's own fix is heavily commented, and the
// call-site comment literally contains the words `numberOfLines` and
// "Recovery O…", which would otherwise satisfy the guards by accident.
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

/** Body of a `StyleSheet.create` entry, by key. */
function styleBlock(name: string): string {
  const m = new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\},`).exec(CODE);
  if (!m) throw new Error(`ProfileScreenV2 no longer declares a \`${name}\` style`);
  return m[1];
}

function fontSizeOf(styleName: string): number {
  const m = /fontSize:\s*(\d+(?:\.\d+)?)/.exec(styleBlock(styleName));
  if (!m) throw new Error(`\`${styleName}\` no longer declares a fontSize`);
  return Number(m[1]);
}

/** The whole metric strip, from its opening View to the Profile Strength row. */
function metricStripJsx(): string {
  const start = CODE.indexOf('<View style={styles.profileMetricStrip}');
  const end = CODE.indexOf('flags.spec_profileStrengthSection', start);
  if (start === -1 || end === -1) throw new Error('the identity metric strip moved');
  return CODE.slice(start, end);
}

/** The two-up numeric row only (HEIGHT | WEIGHT). */
function numericRowJsx(): string {
  const strip = metricStripJsx();
  const start = strip.indexOf('<View style={styles.profileMetricRow}>');
  const end = strip.indexOf('<View style={styles.profileMetricRowDivider}');
  if (start === -1 || end === -1) throw new Error('the numeric metric row moved');
  return strip.slice(start, end);
}

/** The Primary Goal cell only — everything below the horizontal rule. */
function goalCellJsx(): string {
  const strip = metricStripJsx();
  const start = strip.indexOf('<View style={styles.profileMetricRowDivider}');
  if (start === -1) throw new Error('the Primary Goal row lost its divider');
  const cell = strip.slice(start);
  if (!cell.includes('testID="profile-metric-goal-cell"')) {
    throw new Error('the Primary Goal cell lost its testID');
  }
  return cell;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout arithmetic. Constants mirror the styles asserted below, so a padding
// change that quietly re-narrows the goal shows up as a failure here.
// ─────────────────────────────────────────────────────────────────────────────
const CONTENT_H_PADDING = 20; // styles.content
const CARD_PADDING = 20; // styles.profileCard
const CARD_BORDER = 1; // styles.profileCard borderWidth
const STRIP_H_PADDING = 8; // styles.profileMetricStrip
const STRIP_BORDER = 1; // styles.profileMetricStrip borderWidth
const VERTICAL_DIVIDER = 1; // styles.profileMetricDivider

/** Usable text width inside the metric strip at a given screen width. */
function stripInnerWidth(screenWidth: number): number {
  return (
    screenWidth
    - 2 * CONTENT_H_PADDING
    - 2 * CARD_BORDER
    - 2 * CARD_PADDING
    - 2 * STRIP_BORDER
    - 2 * STRIP_H_PADDING
  );
}

/** What the RETIRED three-across layout gave the goal. Kept as the regression. */
function retiredThreeAcrossCellWidth(screenWidth: number): number {
  return (stripInnerWidth(screenWidth) - 2 * VERTICAL_DIVIDER) / 3;
}

/**
 * Conservative UPPER bound on rendered width. 0.62em per glyph over-estimates
 * Inter Bold's mixed-case average advance (~0.55–0.58em), so a "it fits"
 * assertion below is a floor, not a coin flip.
 */
const INTER_BOLD_ADVANCE_EM = 0.62;
function textWidth(text: string, fontSize: number, letterSpacing: number): number {
  return text.length * (fontSize * INTER_BOLD_ADVANCE_EM + letterSpacing);
}

/** Current device + the two iPhone extremes the founder named. */
const WIDTHS = { smallPhone: 320, currentDevice: 375, largePhone: 430 } as const;
/** iOS AX text sizes reach ~2× the base metric; 2.0 is the working ceiling. */
const LARGE_DYNAMIC_TYPE = 2;

const LONGEST_GOAL = [...PRIMARY_GOALS].sort((a, b) => b.length - a.length)[0];
const GOAL_LETTER_SPACING = 0.3; // styles.profileMetricValue

describe('Correction 7 — the Primary Goal can no longer clip to "Recovery O…"', () => {
  it('the goal renders on its own full-width row, not as one third of the numeric strip', () => {
    // The two-up row holds exactly the two short numerics and their divider.
    const numericRow = numericRowJsx();
    expect(numericRow).toContain("t('profile.v2.metric_height')");
    expect(numericRow).toContain("t('profile.v2.metric_weight')");
    expect(numericRow).not.toContain("t('profile.v2.metric_recovery_goal')");
    expect(numericRow.match(/styles\.profileMetricCell/g) ?? []).toHaveLength(2);

    // ...and the goal sits outside it, below a horizontal rule.
    const goalCell = goalCellJsx();
    expect(goalCell).toContain("t('profile.v2.metric_recovery_goal')");
    expect(goalCell).toContain('recoveryGoalLabel');
    expect(metricStripJsx()).toContain('<View style={styles.profileMetricRowDivider}');
  });

  it('the strip stacks (column), so the two rows cannot be forced onto one line', () => {
    const strip = styleBlock('profileMetricStrip');
    expect(strip).toContain("flexDirection: 'column'");
    expect(strip).not.toContain("flexDirection: 'row'");
    expect(styleBlock('profileMetricRow')).toContain("flexDirection: 'row'");
  });

  it('the goal cell resets `flex: 1` — in the COLUMN strip that would grow vertically', () => {
    // `profileMetricCell` carries `flex: 1` for the two-up row, where the main
    // axis is horizontal. Reused as a direct child of the column strip, the
    // same shorthand means grow-in-height with a zero main basis, which is how
    // a row silently collapses. The goal cell overrides both.
    expect(goalCellJsx()).toContain('styles.profileMetricGoalCell');
    const goal = styleBlock('profileMetricGoalCell');
    expect(goal).toContain('flexGrow: 0');
    expect(goal).toContain("flexBasis: 'auto'");
    expect(goal).toContain("alignSelf: 'stretch'");
  });

  it('the goal value carries NO line clamp — overflow wraps, it never ellipsizes', () => {
    expect(goalCellJsx()).not.toContain('numberOfLines');
  });

  it('no text box in the strip is pinned to a fixed width, and every one can shrink', () => {
    for (const name of ['profileMetricCell', 'profileMetricLabel', 'profileMetricValue']) {
      const block = styleBlock(name);
      expect(block, `${name} must be able to shrink`).toContain('flexShrink: 1');
      expect(block, `${name} must not be pinned to a fixed width`).not.toMatch(/\bwidth:\s*\d/);
    }
    // minWidth: 0 keeps the numeric cells yielding on react-native-web too,
    // where a flex child's min-size defaults to `auto` rather than 0.
    expect(styleBlock('profileMetricCell')).toContain('minWidth: 0');
  });

  it('wrapped labels and values stay centered under their cell', () => {
    expect(styleBlock('profileMetricLabel')).toContain("textAlign: 'center'");
    expect(styleBlock('profileMetricValue')).toContain("textAlign: 'center'");
  });
});

describe('Correction 7 — the fix is layout, not shrunken or non-scaling type', () => {
  it('the identity card type sizes are unchanged (no font was traded for space)', () => {
    expect(fontSizeOf('profileMetricValue')).toBe(14);
    expect(fontSizeOf('profileMetricLabel')).toBe(9);
    expect(fontSizeOf('profileName')).toBe(20);
    expect(fontSizeOf('identityChipLabel')).toBe(9);
  });

  it('nothing on this screen opts out of Dynamic Type or auto-shrinks to fit', () => {
    expect(CODE).not.toContain('allowFontScaling={false}');
    expect(CODE).not.toContain('maxFontSizeMultiplier');
    expect(CODE).not.toContain('adjustsFontSizeToFit');
  });
});

describe('Correction 7 — geometry at the four required conditions', () => {
  const goalWidth = textWidth(LONGEST_GOAL, fontSizeOf('profileMetricValue'), GOAL_LETTER_SPACING);

  for (const [label, width] of Object.entries(WIDTHS)) {
    it(`the longest shipped Primary Goal ("${LONGEST_GOAL}") fits one line at ${label} (${width}pt)`, () => {
      expect(stripInnerWidth(width)).toBeGreaterThan(goalWidth);
    });
  }

  it('REGRESSION: the retired three-across geometry could not fit it at ANY iPhone width', () => {
    for (const [label, width] of Object.entries(WIDTHS)) {
      expect(retiredThreeAcrossCellWidth(width), `${label} (${width}pt)`).toBeLessThan(goalWidth);
    }
    // The exact Build-60 failure: on the 375pt device it was reported from.
    expect(retiredThreeAcrossCellWidth(WIDTHS.currentDevice)).toBeLessThan(100);
  });

  it('at large Dynamic Type the goal outgrows one line — and the layout answers by WRAPPING', () => {
    const scaled = textWidth(
      LONGEST_GOAL,
      fontSizeOf('profileMetricValue') * LARGE_DYNAMIC_TYPE,
      GOAL_LETTER_SPACING,
    );
    // It genuinely does not fit at 2× on the largest phone...
    expect(scaled).toBeGreaterThan(stripInnerWidth(WIDTHS.largePhone));
    // ...which is precisely why the clamp had to go: the only remaining
    // response to "too wide" is a second line.
    expect(goalCellJsx()).not.toContain('numberOfLines');
    expect(styleBlock('profileMetricValue')).toContain('flexShrink: 1');
  });
});

describe('Correction 7 — the goal was not the only label at risk in this card', () => {
  it('identity chips wrap a long member-authored team name instead of ellipsizing it', () => {
    const chip = CODE.slice(CODE.indexOf('function IdentityChip'), CODE.indexOf('function UnitPreferenceRow'));
    expect(chip).not.toContain('numberOfLines');
    // The chip is capped at maxWidth 100%; the label needs flexShrink to wrap
    // inside that cap rather than overflow it.
    expect(styleBlock('identityChip')).toContain("maxWidth: '100%'");
    expect(styleBlock('identityChipLabel')).toContain('flexShrink: 1');
    expect(styleBlock('profileChipStrip')).toContain("flexWrap: 'wrap'");
  });

  it('the display name and the location line each get a second line', () => {
    const top = CODE.slice(CODE.indexOf('<View style={styles.profileCardTop}>'), CODE.indexOf('styles.profileChipDivider'));
    expect(top).toMatch(/styles\.profileName\} numberOfLines=\{2\}/);
    expect(top).toMatch(/styles\.profileLocationText\} numberOfLines=\{2\}/);
    // The location text shares a row with the pin icon, so it must shrink;
    // RN defaults flexShrink to 0.
    expect(styleBlock('profileLocationText')).toContain('flexShrink: 1');
  });

  it('the Profile Strength label shrinks so the confidence chip stays inside the card', () => {
    const strengthRow = CODE.slice(
      CODE.indexOf('testID="profile-strength-row"'),
      CODE.indexOf('a11yContext={'),
    );
    expect(strengthRow).toContain('styles.profileStrengthLabel');
    const block = styleBlock('profileStrengthLabel');
    expect(block).toContain('flexShrink: 1');
    // 'auto' rather than the cell-centered alignment: this label reads with
    // the row (and mirrors correctly in RTL locales).
    expect(block).toContain("textAlign: 'auto'");
  });
});
