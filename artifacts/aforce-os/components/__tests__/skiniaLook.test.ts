/**
 * The SkinIA check in the app's own look (founder, 2026-11-20). Presentation
 * only: the consent, privacy and capture rules are covered by their own tests.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (f: string) => readFileSync(join(__dirname, '..', 'advancedVisual', f), 'utf8');
const intro = read('AdvancedVisualIntelligenceScreen.tsx');
const capture = read('SkinIACameraCaptureScreen.tsx');

describe('SkinIA looks like the rest of the app', () => {
  it('no red kickers, wordmark or framing', () => {
    expect(intro).not.toContain('edAccent.red');
    // The only red left on the capture screen is the live indicator's dot.
    expect(capture.match(/af\.red(Text)?\b/g)).toHaveLength(1);
    expect(capture.match(/<AFMasthead/g)!.length).toBe(capture.match(/tone="quiet"/g)!.length);
  });

  it('the live indicator keeps its one red dot', () => {
    expect(capture).toMatch(/pillDot: \{ backgroundColor: af\.redText/);
  });

  it('primary buttons are pills with no "+" mark', () => {
    expect(intro).toMatch(/action: \{ minHeight: 52, borderRadius: 26/);
    expect(capture).toMatch(/action: \{[^}]*borderRadius: 999/);
    expect(intro + capture).not.toContain('actionPlus');
  });

  it('every SkinIA screen has a way back (founder direction 2026-11-20)', () => {
    const route = readFileSync(join(__dirname, '..', '..', 'app', 'skinia.tsx'), 'utf8');
    const back = readFileSync(join(__dirname, '..', 'advancedVisual', 'SkinIABackButton.tsx'), 'utf8');
    expect(back).toContain('accessibilityRole="button"');
    expect(back).toMatch(/height: 44[^}]*width: 44/);
    // First view: back to the previous screen. Other views: back to the first view.
    expect(intro).toContain("view === 'overview' ? (onBack ? <SkinIABackButton onPress={onBack} />");
    expect(intro).toContain('<SkinIABackButton onPress={() => setView(\'overview\')} label="Back to SkinIA" />');
    expect(route).toContain('onBack={goBack}');
    expect(route).toContain("router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')");
    // Camera and every result state.
    expect(capture).toContain('<SkinIABackButton onPress={exitCapture} />');
    expect(capture).toContain('<SkinIABackButton onPress={onSecondary ?? onAction} />');
  });

  it('the intro and access screens use the app\'s own tokens, not the old editorial ones', () => {
    const route = readFileSync(join(__dirname, '..', '..', 'app', 'skinia.tsx'), 'utf8');
    for (const src of [intro, route]) {
      expect(src).not.toContain('editorialTokens');
      expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/);
      expect(src).toContain("fontFamily: 'Inter_600SemiBold'");
      expect(src).toContain('backgroundColor: af.canvas');
      expect(src).toContain('backgroundColor: af.primaryFill');
    }
  });
});
