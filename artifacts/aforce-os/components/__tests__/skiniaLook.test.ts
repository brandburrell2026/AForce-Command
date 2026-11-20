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
});
