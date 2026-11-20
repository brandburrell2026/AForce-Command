/**
 * Sleep's lower sections in the app's own look (founder, 2026-11-20: "fix all
 * the screens that do not look like the new style").
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'SleepModeView.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, '');

describe('Sleep details look like the rest of the app', () => {
  it('section labels are quiet grey, never the red breadcrumb', () => {
    const labels = src.match(/<AFSectionLabel[^>]*>/g) ?? [];
    expect(labels.length).toBeGreaterThanOrEqual(2);
    for (const l of labels) expect(l).toContain('tone="quiet"');
  });

  it('no bar, track or dot is filled red', () => {
    expect(src).not.toMatch(/backgroundColor: af\.red\b/);
  });

  it('the connection pill is neutral; its status colour is the dot only', () => {
    expect(src).toContain('<View style={styles.chip} accessible');
    expect(src).toContain('<Text style={styles.chipText}>{health.chipLabel}</Text>');
    expect(src).toContain('styles.chipDot, { backgroundColor: CHIP_COLOR[health.chip] }');
    expect(src.match(/CHIP_COLOR\[health\.chip\]/g)).toHaveLength(1);
  });

  it('buttons are written in sentence case, with the service\'s own words', async () => {
    expect(src).toContain('{sentenceCase(label)}');
    expect(src).toContain('>Edit target</Text>');
    expect(src).toContain('>Save</Text>');
    expect(src).not.toMatch(/>EDIT TARGET<|>SAVE</);
    // The spoken label is still exactly what the service supplies.
    expect(src).toContain('accessibilityLabel={label}');
  });
});
