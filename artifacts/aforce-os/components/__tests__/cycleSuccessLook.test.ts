/**
 * The after-logging confirmation, in the app's own look (founder, 2026-11-20:
 * "Change the score to look like the rest of the app").
 *
 * Source checks: the overlay animates with reanimated, which the render
 * harness does not load.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raw = readFileSync(join(__dirname, '..', 'CycleSuccessOverlay.tsx'), 'utf8');
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('logged confirmation looks like the rest of the app', () => {
  it('draws the score in the same ring Home uses', () => {
    expect(src).toContain("import { HomeHydroRing } from './home/cinematic/HomeHydroRing';");
    expect(src).toMatch(/<HomeHydroRing[\s\S]{0,200}?value=\{String\(displayScore\)\}[\s\S]{0,80}?label="HydroState"/);
  });

  it('the status colour is one small dot, never the card, the number or the text', () => {
    expect(src.match(/statusDot\b/g)).toHaveLength(4); // declared, style applied, colour applied, style defined
    expect(src).toMatch(/styles\.statusDot, \{ backgroundColor: statusDot \}/);
    expect(src).not.toMatch(/color:\s*statusDot|borderColor:\s*statusDot|\{ color \}|`\$\{color\}/);
    expect(src).toMatch(/statusDot: \{ width: 6, height: 6, borderRadius: 3 \}/);
  });

  it('uses the app surface and type, not the old palette', () => {
    expect(src).not.toMatch(/\bColors\./);
    expect(src).not.toMatch(/Inter_700Bold/);
    expect(src).toContain('backgroundColor: af.surface');
    expect(src).toContain('backgroundColor: af.primaryFill');
  });

  it('has no ripple rings or coloured glow', () => {
    expect(src).not.toMatch(/ripple|glow/i);
  });

  it('still shows every real number: before, after, change, what was recorded, next check', () => {
    for (const field of ['scoreBefore', 'scoreAfter', 'gainDisplay', 'recordedLabel', 'identityMessage', 'nextCheckMinutes', 'state']) {
      expect(src).toContain(`result.${field}`);
    }
    expect(src).toMatch(/counter\.value = withDelay\(220, withTiming\(result\.scoreAfter/);
  });

  it('the button and the score read sensibly to a screen reader', () => {
    expect(src).toContain('accessibilityLabel="Done"');
    expect(src).toContain('accessibilityLabel={`HydroState ${result.scoreAfter} out of 100`}');
    expect(src).toContain('accessibilityLabel={`${result.state}. Was ${result.scoreBefore}, now ${result.scoreAfter}. ${result.gainDisplay}.`}');
  });
});
