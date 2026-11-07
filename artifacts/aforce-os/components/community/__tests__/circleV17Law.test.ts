import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Circle v1.7 private-surface law', () => {
  it('routes the Circles tab to the private v1.7 screen', () => {
    expect(read('../../app/(tabs)/competition.tsx')).toContain('CircleScreenV4');
  });

  it('does not render legacy competition or score-state sharing in the member surface', () => {
    const screen = stripComments(read('CircleScreenV4.tsx'));
    expect(screen).toContain('showLegacySharing={false}');
    for (const retired of ['CircleScreenV3', 'CompetitionScreenV2', 'score:', 'rank:', 'streak:', 'challenge:']) {
      expect(screen).not.toContain(retired);
    }
  });
});
