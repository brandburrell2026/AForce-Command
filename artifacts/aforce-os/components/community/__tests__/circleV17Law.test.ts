import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Circle v1.7 private-surface law', () => {
  it('routes the Circles tab to the private v1.7 screen', () => {
    expect(read('../../app/(tabs)/competition.tsx')).toContain('CircleScreenV4');
  });

  it('uses the same five member tabs in native and fallback navigation', () => {
    const layout = read('../../app/(tabs)/_layout.tsx');
    const native = layout.slice(layout.indexOf('function NativeTabLayout'), layout.indexOf('function PlainTabButton'));
    for (const route of ['index', 'journal', 'one-breath-tab', 'moments-tab', 'competition']) {
      expect(native).toContain(`name="${route}"`);
    }
    expect(native).not.toContain('name="profile"');
    expect(native).not.toContain('name="protocol"');
  });

  it('does not render legacy competition or score-state sharing in the member surface', () => {
    const screen = stripComments(read('CircleScreenV4.tsx'));
    expect(screen).toContain('showLegacySharing={false}');
    for (const retired of ['CircleScreenV3', 'CompetitionScreenV2', 'score:', 'rank:', 'streak:', 'challenge:']) {
      expect(screen).not.toContain(retired);
    }
  });
});
