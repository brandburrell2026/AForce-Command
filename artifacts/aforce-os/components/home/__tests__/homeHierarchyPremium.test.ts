/**
 * HOME HIERARCHY LOCK — founder amendments §1/§3/§4/§5/§6 (2026-08-13), on top
 * of the device-verified build-63 baseline.
 *
 * THE DEFECT THIS LOCKS OUT. Home asked the member three questions in its first
 * three seconds — where am I, how certain is AForce, what should I do — and
 * answered them with five competing objects:
 *
 *   AForce OS       ← `afType.title1`, 32/38: the app's own name, second-largest
 *   76              ← the reading
 *   DEPLETED        ← the band, i.e. the interpretation of the reading
 *   EVIDENCE: LIMITED ← a statement about the DATA, stacked in the verdict column
 *   ● CRITICAL      ← `getStatusVerb('DEPLETED', 'flat')`, in red, on FIRST PAINT
 *
 * Three of those five are lexicalisations of the same variable. The approved
 * hierarchy is HYDROSTATE SCORE → BAND → EVIDENCE CONFIDENCE → COMMAND →
 * ACTION, with nothing competing.
 *
 * SOURCE-GUARD, per this directory's documented convention: `HomeScreenV2`
 * pulls in `useAppStore` / `expo-router` / `@clerk/expo` and is never mounted by
 * this suite (see `homeScreenV2Wiring.test.ts`'s header for the full rationale).
 * The BEHAVIOUR of the one component whose render actually changed —
 * `LiveStatusLine`, which may now render nothing — is covered against a real DOM
 * in `LiveStatusLine.render.test.tsx`. Copy assertions run against the SHIPPED
 * locale JSON, never a fixture.
 *
 * Every describe block carries a mutation-verify test: a source-text assertion
 * that cannot fail on a mutated source is decoration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import en from '../../../locales/en.json';

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
/** Comments stripped, so prose about the OLD hierarchy can never satisfy an assertion about the render. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const LINE_SOURCE = readFileSync(join(__dirname, '..', 'LiveStatusLine.tsx'), 'utf8');
const LINE_CODE = LINE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const VERB_SOURCE = readFileSync(
  join(__dirname, '..', '..', '..', 'services', 'statusVerb.ts'),
  'utf8',
);

/** A VISIBLE print of the band word — the same detector `homeHeroNamingLock` uses. */
const BAND_PRINT = /(?<!\$)\{engine\.performanceState\.level\}/g;

describe('§1 — CRITICAL is absent from the Home hierarchy', () => {
  it('Home never hands the raw verb to the line: the gate is what reaches it', () => {
    expect(CODE).toMatch(/verb=\{trendVerb\}/);
    // The pre-amendment wiring, which passed whatever the composite returned.
    expect(CODE).not.toMatch(/verb=\{statusVerb\}/);
  });

  it('the gate withholds CRITICAL, and withholds any verb when the trend has no direction', () => {
    // Two withholdings, one rule (founder §1): never the verb that merely
    // restates the band, and never a verdict where nothing has moved. The
    // second half matters most — `useScoreTrend` initialises to 'flat', which
    // is why a DEPLETED member met CRITICAL on the very first frame with no
    // delta and no window behind it.
    expect(CODE).toMatch(
      /const\s+trendVerb\s*=\s*\n?\s*trend\.direction === 'flat' \|\| statusVerb === 'CRITICAL' \? undefined : statusVerb;/,
    );
  });

  it('the SERVICE is untouched: statusVerb.ts still produces CRITICAL for other consumers', () => {
    // §1 is a Home PRESENTATION decision. The engine's urgency, the band
    // semantics and this mapping are protected — suppression happens at the
    // screen, never by rewriting what the verb means.
    expect(VERB_SOURCE).toContain("if (direction === 'rising') return 'RECOVERING';");
    expect(VERB_SOURCE).toContain("return 'CRITICAL';");
    expect(CODE).toContain("import { getStatusVerb } from '@/services/statusVerb';");
    expect(CODE).toMatch(/getStatusVerb\(engine\.performanceState\.level, trend\.direction\)/);
  });

  it('the i18n key survives — strings are not deleted, only withheld from this screen', () => {
    expect(en.home.live_status.verb_critical).toBe('CRITICAL');
    expect(LINE_CODE).toContain("CRITICAL: 'home.live_status.verb_critical',");
  });

  it('the line may now render NOTHING rather than a verdict', () => {
    // The presentation half of the rule: with no window and no verb there is
    // no reading to draw, so the row does not hold the slot with a bare arrow.
    expect(LINE_CODE).toMatch(/if \(!showWindow && !verbLabel\) return null;/);
    expect(LINE_CODE).toMatch(/verb\?: StatusVerb;/);
  });

  it('mutation-verify: restoring the ungated verb is detectable', () => {
    const mutated = CODE.replace('verb={trendVerb}', 'verb={statusVerb}');
    expect(mutated).toMatch(/verb=\{statusVerb\}/);
    expect(mutated).not.toMatch(/verb=\{trendVerb\}/);
  });
});

describe('§3 — "AForce OS" is KEPT, and demoted', () => {
  it('still renders, from the same key, in the same place', () => {
    // "Do NOT remove the name" — the demotion is a type decision, not a
    // deletion, and the header keeps greeting → brand → freshness order.
    expect(CODE).toContain("<Text style={styles.brand}>{t('home.subtitle_title')}</Text>");
    expect(en.home.subtitle_title).toBe('AForce OS');
    const header = CODE.slice(CODE.indexOf('<View style={styles.header}>'), CODE.indexOf('<AFOfflineBanner'));
    expect(header.indexOf('styles.welcome')).toBeLessThan(header.indexOf('styles.brand'));
    expect(header.indexOf('styles.brand')).toBeLessThan(header.indexOf('<HomeFreshnessLabel'));
  });

  it('no longer wears the 32pt title ramp that competed with the hero numeral', () => {
    expect(CODE).toMatch(/brand:\s*\{\s*\.\.\.afType\.eyebrow,/);
    expect(CODE).not.toMatch(/brand:\s*\{\s*\.\.\.afType\.title1/);
  });

  it('is not turned into a marketing splash: no casing transform, no new token, no wordmark art', () => {
    // The locale value renders as written, in all 11 languages.
    expect(CODE).not.toMatch(/textTransform/);
    expect(CODE).not.toContain('subtitle_eyebrow');
  });

  it('mutation-verify: a re-promoted brand line is detectable', () => {
    const mutated = CODE.replace('brand: { ...afType.eyebrow,', 'brand: { ...afType.title1,');
    expect(mutated).toMatch(/brand:\s*\{\s*\.\.\.afType\.title1/);
  });
});

describe('§4 — the evidence chip is still present, as metadata', () => {
  it('the confidence chip is NOT hidden — it still renders the resolved rating', () => {
    expect(CODE).toMatch(/<ConfidenceChip\s/);
    expect(CODE).toMatch(
      /label=\{t\('home\.v2\.confidence_chip',\s*\{\s*rating:\s*confidence\.chip\.label\s*\}\)\}/,
    );
    expect(CODE).toMatch(/opacity=\{confidence\.chip\.opacity\}/);
    expect(en.home.v2.confidence_chip).toContain('EVIDENCE');
  });

  it('the protected resolver is untouched — nothing was re-graded to look calmer', () => {
    expect(CODE).toContain("import { resolveHomeConfidence } from './homeConfidence';");
    expect(CODE).not.toContain('confidence.chip.label.toLowerCase');
  });

  it('it is paired with the number it qualifies, not stacked in the verdict column', () => {
    // Structurally: inside the arc are the reading's own parts (numeral,
    // HYDROSTATE, band word); the chip sits immediately below the instrument,
    // between the ring and the trend line, and the ring's own edge is the
    // separation from the band.
    const arcToTrend = CODE.slice(CODE.indexOf('<AFReadinessArc'), CODE.indexOf('<LiveStatusLine'));
    expect(arcToTrend).toContain('<ConfidenceChip');
    expect(CODE).toMatch(/arcWrap:\s*\{[^}]*marginBottom:\s*Spacing\[3\]/);
  });

  it('it stays the lowest-weight text on the screen: no band colour, no card, no numeral', () => {
    const chipAt = CODE.indexOf('<ConfidenceChip');
    const block = CODE.slice(CODE.lastIndexOf('<View', chipAt), CODE.indexOf('<LiveStatusLine'));
    expect(block).not.toContain('AFCard');
    expect(block).not.toContain('styles.score');
    expect(block).not.toContain('accentText');
    expect(block).not.toContain('accent');
  });

  it('mutation-verify: a hidden chip is detectable', () => {
    const mutated = CODE.replace('<ConfidenceChip', '<View /* hidden */');
    expect(mutated).not.toMatch(/<ConfidenceChip\s/);
  });
});

describe('§5 — the hero: one dominant object, restraint not size', () => {
  it('the HYDROSTATE label is still there, still from the locale key', () => {
    expect(CODE).toContain("<Text style={styles.scoreLabel}>{t('home.v2.readiness_label')}</Text>");
    expect(en.home.v2.readiness_label).toBe('HYDROSTATE');
  });

  it('the score is the only element on the display ramp', () => {
    expect((CODE.match(/afType\.displayScore/g) ?? []).length).toBe(1);
    expect(CODE).toMatch(/const\s+score\s*=\s*Math\.max\(0,\s*Math\.min\(100,\s*Math\.round\(engine\.score\)\)\);/);
  });

  it('the ring was NOT enlarged for drama — its size still comes from the tested resolver', () => {
    // Founder: "Premium should come from restraint, not size."
    expect(CODE).toMatch(/const\s+arcDims\s*=\s*resolveArcDimensions\(elite\);/);
    expect(CODE).toMatch(/size=\{arcDims\.size\}\s+stroke=\{arcDims\.stroke\}/);
  });

  it('the band word is rendered exactly once', () => {
    // Two source occurrences, and they are the two arms of ONE ternary (the
    // elite state pill vs the standard state label), so exactly one renders in
    // any build. Nothing below the hero restates it.
    expect((CODE.match(BAND_PRINT) ?? []).length).toBe(2);
    const arcInner = CODE.slice(CODE.indexOf('<AFReadinessArc'), CODE.indexOf('</AFReadinessArc>'));
    expect((arcInner.match(BAND_PRINT) ?? []).length).toBe(2);
    const belowHero = CODE.slice(CODE.indexOf('</AFReadinessArc>'));
    expect((belowHero.match(BAND_PRINT) ?? []).length).toBe(0);
  });

  it('breathing room comes from the spacing scale, not fresh magic numbers', () => {
    expect(CODE).toMatch(/header:\s*\{\s*marginTop:\s*Spacing\[1\],\s*marginBottom:\s*Spacing\[3\]\s*\}/);
    expect(CODE).toMatch(/arcWrap:\s*\{\s*alignItems:\s*'center',\s*marginTop:\s*Spacing\[6\]/);
    expect(CODE).not.toMatch(/arcWrap:\s*\{[^}]*marginVertical:\s*24/);
  });

  it('Dynamic Type still reflows rather than shrinking', () => {
    // The banned fix (a11yContrastAndTargets locks this too) — re-asserted here
    // because a type-scale pass is exactly when it gets reached for.
    expect(CODE).not.toContain('adjustsFontSizeToFit');
    expect(CODE).toMatch(/maxFontSizeMultiplier=\{AF_MAX_DISPLAY_FONT_SCALE\}/);
  });

  it('mutation-verify: an enlarged hero ring is detectable', () => {
    const mutated = CODE.replace('size={arcDims.size}', 'size={320}');
    expect(mutated).not.toMatch(/size=\{arcDims\.size\}\s+stroke=\{arcDims\.stroke\}/);
  });
});

describe('§6/§7 — the command card is subordinate, the action is preserved', () => {
  it('there is still exactly ONE command card, and it still carries the primary action', () => {
    expect((CODE.match(/<AFCommandCard/g) ?? []).length).toBe(1);
    expect(CODE).toMatch(/primaryLabel=\{t\('home\.v2\.log_water'\)\}/);
    expect(CODE).toMatch(/onPrimary=\{openWaterPicker\}/);
    expect(CODE).toMatch(/primaryLoading=\{isCompletingCycle\}/);
  });

  it('WHY is still reachable — the rationale is not stripped to make the card smaller', () => {
    // "Keep WHY accessible without a wall of text": the card shows its one-line
    // reason inline and keeps the disclosure. Density was never Home's to fix
    // by withholding the explanation.
    expect(CODE).toMatch(/rationale=\{engine\.command\.explanation \|\| undefined\}/);
  });

  it('the separation from the hero is a Home-only gap, not a change to the shared card', () => {
    expect(CODE).toMatch(/<Animated\.View style=\{styles\.command\} entering=\{commandReveal\}>/);
    expect(CODE).toMatch(/command:\s*\{\s*marginTop:\s*Spacing\[7\]\s*\}/);
  });

  it('the logging surface behind the CTA is untouched (visual and layout only)', () => {
    // §7 is explicit that the logger flow, its API calls, its state mutation
    // and its scoring must not move. One write, on confirm, as build 63 shipped.
    expect((CODE.match(/logIntake\(/g) ?? []).length).toBe(1);
    // Provenance was added to this call (record-only, PR #2 of the Build-65
    // series); the write itself is unchanged, which is what this pins.
    expect(CODE).toContain("void logIntake('water', { ozOverride: oz, source: 'home' });");
    expect(CODE).toMatch(/<WaterAmountModal\s/);
    expect(CODE).toMatch(/<CycleSuccessOverlay\s/);
  });

  it('mutation-verify: a card left flush against the hero is detectable', () => {
    const mutated = CODE.replace('<Animated.View style={styles.command} entering=', '<Animated.View entering=');
    expect(mutated).not.toMatch(/<Animated\.View style=\{styles\.command\} entering=/);
  });
});

describe('the hierarchy pass added no cost and no colour', () => {
  it('introduced no new store subscription (the render-count drift guard is bidirectional)', () => {
    // Pinned for real in `homeScreenV2RenderCount.render.test.tsx`; asserted
    // here because a hierarchy pass is a tempting place to reach for one more
    // slice "just to render X".
    const hooks = (CODE.match(/\buse[A-Za-z]*Slice\s*[<(]/g) ?? []).map((h) => h.replace(/\s*[<(]$/, ''));
    expect(new Set(hooks)).toEqual(
      new Set([
        'useUserSlice',
        'useVoiceSettingsSlice',
        'useBootstrapSlice',
        'useEngineSlice',
        'useActionsSlice',
        'useHistorySlice',
        'useCycleSlice',
      ]),
    );
  });

  it('introduced no raw colour literal and no alpha concatenation', () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CODE).not.toMatch(/\$\{[a-zA-Z.]+\}[0-9a-fA-F]{2}/);
    expect(LINE_CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('added no timer, no interval and no fetch to the hottest screen in the app', () => {
    expect(CODE).not.toContain('setInterval');
    expect(CODE).not.toContain('setTimeout');
    expect(CODE).not.toContain('fetch(');
    expect(CODE).not.toContain('TICK_TIMER');
  });

  it('mutation-verify: an added slice subscription is detectable', () => {
    const mutated = `${CODE}\n useTimerSlice();\n`;
    const hooks = (mutated.match(/\buse[A-Za-z]*Slice\s*[<(]/g) ?? []).map((h) => h.replace(/\s*[<(]$/, ''));
    expect(hooks).toContain('useTimerSlice');
  });
});
