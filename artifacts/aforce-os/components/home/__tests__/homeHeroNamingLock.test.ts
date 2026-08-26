/**
 * HOME HERO NAMING + BAND-WORD SINGULARITY LOCK — Correction 6, build 61
 * (build 60 failed physical-device QA; founder-authorised correction pass).
 *
 * THE DEFECT THIS LOCKS OUT. On the device, Home's hero stacked FOUR
 * alarming-looking strings over ONE reading:
 *
 *   READINESS        ← the label on the hero numeral
 *   DEPLETED         ← `engine.performanceState.level`
 *   Depleted         ← the SAME variable, title-cased, in the "Recovery" tile
 *   LIMITED          ← the Wave-5 confidence token, a bare structural word
 *
 * Three of the four were the same underlying value, and the word the product is
 * actually built around — HydroState — was rendered NOWHERE in the app, so the
 * founder could not find it. This file locks the correction in place:
 *
 *   a) the hero label says HYDROSTATE, in every locale;
 *   b) the band word is printed at most ONCE on Home;
 *   c) the secondary confidence indicator names its domain (evidence about the
 *      DATA) instead of reading as a fourth verdict about the body.
 *
 * SOURCE-GUARD, deliberately. `HomeScreenV2` pulls in `useAppStore` /
 * `expo-router` / `@clerk/expo`; this directory's established convention is to
 * assert its wiring against the source text rather than fabricate a store +
 * router + Clerk harness (see `homeScreenV2Wiring.test.ts`'s header). The copy
 * half is asserted against the SHIPPED locale JSON, not a fixture, so a
 * reworded string fails here instead of shipping. The store-free
 * `HomeBaselineHero` has its own render coverage
 * (`HomeBaselineHero.render.test.tsx`) which asserts the rendered word.
 *
 * Pure (fs + locale JSON) — runs in node/vitest, no react-native import.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import en from '../../../locales/en.json';
import ar from '../../../locales/ar.json';
import de from '../../../locales/de.json';
import es from '../../../locales/es.json';
import fr from '../../../locales/fr.json';
import hi from '../../../locales/hi.json';
import itLocale from '../../../locales/it.json'; // "it" would shadow vitest's it()
import ja from '../../../locales/ja.json';
import ko from '../../../locales/ko.json';
import pt from '../../../locales/pt.json';
import zh from '../../../locales/zh.json';

/**
 * Only the slice this lock asserts on. Deliberately NOT `typeof en`: the
 * non-English tables are partial by design (they carry 383–400 fewer keys and
 * fall back to English), so demanding en.json's full shape would be a type
 * error about translation coverage, not about the hero label.
 */
type HeroLabelTable = { home: { v2: { readiness_label: string } } };

const ALL_LOCALES: Record<string, HeroLabelTable> = {
  en,
  ar,
  de,
  es,
  fr,
  hi,
  it: itLocale,
  ja,
  ko,
  pt,
  zh,
};

const SOURCE = readFileSync(join(__dirname, '..', 'HomeScreenV2.tsx'), 'utf8');
/** Comments stripped, so a WORD IN A COMMENT can never satisfy an assertion about the render. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const BASELINE_HERO = readFileSync(join(__dirname, '..', 'HomeBaselineHero.tsx'), 'utf8').
  replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/.*$/gm, '');

/**
 * A VISIBLE print of the band word: `{engine.performanceState.level}` as a JSX
 * expression child. The negative lookbehind excludes `${...}` inside template
 * literals, which is how the hero's `accessibilityLabel` folds the band into
 * the SPOKEN string — that one is not a fourth thing to look at, and a screen
 * reader announcing score + band once is the a11y behaviour this repo already
 * locked (see `homeScreenV2Wiring.test.ts`, "hero announces once").
 */
const BAND_PRINT = /(?<!\$)\{engine\.performanceState\.level\}/g;

describe('Correction 6a — the hero is NAMED: the label says HYDROSTATE', () => {
  it('every one of the 11 locales carries HYDROSTATE for the hero label', () => {
    // It is an identical untranslated structural token in every locale (a
    // product name, like the wordmark), so this is a value change with NO key
    // change and therefore no key-parity impact — `nonEnLocaleParity.test.ts`
    // covers the families that do carry translations.
    for (const [lng, table] of Object.entries(ALL_LOCALES)) {
      expect(table.home.v2.readiness_label, lng).toBe('HYDROSTATE');
    }
  });

  it('the word the founder could not find is now actually in the shipped copy', () => {
    // The pre-correction state: `grep -r HydroState locales/` returned nothing.
    expect(JSON.stringify(en).toUpperCase()).toContain('HYDROSTATE');
  });

  it('the hero numeral is labelled from that key, not a hardcoded string', () => {
    expect(CODE).toContain("<Text style={styles.scoreLabel}>{t('home.v2.readiness_label')}</Text>");
    expect(CODE).not.toContain("'READINESS'");
    expect(CODE).not.toContain('"READINESS"');
  });

  it('the pre-evidence hero slot uses the SAME key, so the slot keeps one name', () => {
    // `HomeBaselineHero` stands in the hero slot before AForce has observed
    // anything. If it kept its own label the member would meet two names for
    // the same slot on consecutive days.
    expect(BASELINE_HERO).toContain("t('home.v2.readiness_label')");
  });
});

describe('Correction 6b — the band word is printed ONCE on Home', () => {
  it('the band variable reaches the screen as visible text in exactly one place', () => {
    // Two source occurrences, and they are the two arms of ONE ternary, so
    // exactly one of them renders in any build. Three would mean the band is
    // printed twice again — the exact build-60 defect.
    const prints = CODE.match(BAND_PRINT) ?? [];
    expect(prints).toHaveLength(2);
  });

  it('both of them are the mutually exclusive arms of the hero\'s elite ternary', () => {
    const arcInner = CODE.slice(CODE.indexOf('<AFReadinessArc'), CODE.indexOf('</AFReadinessArc>'));
    expect(arcInner.match(BAND_PRINT) ?? []).toHaveLength(2);
    // `elite ? <statePill> : <stateLabel>` — the LAST `elite ?` inside the arc
    // (the first one switches the score numeral).
    const statePillTernary = arcInner.slice(arcInner.lastIndexOf('{elite ? ('));
    expect(statePillTernary.match(BAND_PRINT) ?? []).toHaveLength(2);
  });

  it('nothing below the hero prints it — not the signal tiles, not the command card', () => {
    const belowHero = CODE.slice(CODE.indexOf('</AFReadinessArc>'));
    expect(belowHero.match(BAND_PRINT) ?? []).toHaveLength(0);
  });

  it('the Recovery tile renders the honest-data em dash, not a restatement of the band', () => {
    // A duplicate of the hero's variable is not a second measurement. The em
    // dash is the SAME glyph the Sleep/HRV tiles use for a reading nobody took.
    expect(CODE).toMatch(/const\s+recoveryText\s*=\s*EM_DASH;/);
    expect(CODE).toContain("import {");
    expect(CODE).toContain('EM_DASH,');
    // …and it is what BOTH signal blocks (the V3 grid and the flag-off row) show.
    expect((CODE.match(/value=\{recoveryText\}/g) ?? []).length).toBe(2);
  });

  it('the title-casing helper that produced the duplicate is gone', () => {
    expect(CODE).not.toContain('titleCase');
  });

  it('mutation-verify: a second visible band print IS detectable by these assertions', () => {
    // Proves the detector moves when the source does, rather than passing
    // vacuously because the regex never matches anything.
    // `replaceAll`, not `replace`: the tile is rendered from two call sites
    // (the flag-off row's `signalTiles` map, declared above the JSX, and the V3
    // grid below the arc). Mutating only the first would move the total but not
    // the below-hero slice, and the point here is that BOTH detectors move.
    const mutated = CODE.replaceAll(
      'value={recoveryText}',
      'value={engine.performanceState.level}',
    );
    expect((mutated.match(BAND_PRINT) ?? []).length).toBe(4);
    const belowHero = mutated.slice(mutated.indexOf('</AFReadinessArc>'));
    expect((belowHero.match(BAND_PRINT) ?? []).length).toBe(1);
  });
});

describe('Correction 6c — one hero state · one band · one evidence chip · one command', () => {
  it('the confidence chip names its domain, so it cannot read as a fourth verdict on the body', () => {
    expect(en.home.v2.confidence_chip).toContain('EVIDENCE');
    expect(en.home.v2.confidence_chip).toContain('{{rating}}');
    expect(CODE).toMatch(
      /label=\{t\('home\.v2\.confidence_chip',\s*\{\s*rating:\s*confidence\.chip\.label\s*\}\)\}/,
    );
    // The bare structural token ("LIMITED", alone, inches under a band word) is
    // what read as a verdict — it must not come back.
    expect(CODE).not.toMatch(/label=\{confidence\.chip\.label\}/);
  });

  it('the chip is still the evidence rating the tested resolver produced — nothing was re-graded to look calmer', () => {
    // Correction 6 is copy and presentation ONLY. The rating, its vocabulary
    // and its opacity ramp come from `homeConfidence` / the shipped chip model
    // exactly as before (`homeConfidence.test.ts` proves the grading).
    expect(CODE).toContain("import { resolveHomeConfidence } from './homeConfidence';");
    expect(CODE).toMatch(/opacity=\{confidence\.chip\.opacity\}/);
    expect(CODE).not.toContain('confidence.chip.label.toLowerCase');
  });

  it('the spoken chip still carries its noun, so a screen reader loses nothing', () => {
    expect(CODE).toMatch(/a11yContext=\{t\('home\.v2\.confidence_a11y_context'\)\}/);
    expect(typeof en.home.v2.confidence_a11y_context).toBe('string');
  });

  it('keeps ONE dominant number: only the hero numeral wears the display score ramp', () => {
    expect((CODE.match(/afType\.displayScore/g) ?? []).length).toBe(1);
  });

  it('keeps ONE command', () => {
    expect((CODE.match(/<AFCommandCard/g) ?? []).length).toBe(1);
  });

  it('adds no second score: the hero still renders the engine score, and no new number was invented', () => {
    expect(CODE).toMatch(/const\s+score\s*=\s*Math\.max\(0,\s*Math\.min\(100,\s*Math\.round\(engine\.score\)\)\);/);
  });
});
