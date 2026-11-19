/**
 * The Moment screen in the approved prototype's look (2026-11-19).
 * Presentation only: this file checks the look; what the screen says and
 * writes stays with editorialMomentsLaw.test.ts, which was not edited.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { edType } from '../../theme/editorialTokens';

const src = readFileSync(
  join(__dirname, '..', 'editorial', 'moments', 'EditorialMomentDetailScreen.tsx'),
  'utf8',
);

describe('Moment screen — prototype look', () => {
  it('the title is the Moment in the large Inter 600 face, and is the heading', () => {
    expect(src).toMatch(/accessibilityRole="header"[\s\S]{0,160}style=\{styles\.title\}/);
    expect(src).toMatch(/title:\s*\{ \.\.\.\(edType\.protoHero as TextStyle\)/);
    expect(edType.protoHero).toMatchObject({ fontFamily: 'Inter_600SemiBold', fontSize: 44 });
  });

  it('the chapters and the reason each sit in a 20pt card', () => {
    expect(src).toMatch(/chapters:\s*\{[^}]*borderRadius: 20[^}]*\}/);
    expect(src).toMatch(/card:\s*\{[^}]*borderRadius: 20[^}]*\}/);
    expect(src).toMatch(/style=\{styles\.card\} testID="editorial-moment-confirm"/);
  });

  it('"I\'m ready" is a filled pill with a full-size target; done is an outline', () => {
    expect(src).toMatch(/confirm:\s*\{[^}]*minHeight: 52,[^}]*borderRadius: 999/);
    expect(src).toMatch(/confirmReady:\s*\{ backgroundColor: af\.primaryFill/);
    expect(src).toMatch(/prepared \? styles\.confirmDone : styles\.confirmReady/);
  });

  it('the chapters still come from rec.ritual, in order, one Chapter each', () => {
    expect(src).toMatch(/rec\.ritual\.map\(\(stage, i\) =>[\s\S]{0,220}<Chapter stage=\{stage\} index=\{i\} \/>/);
  });

  it('every test id is still there and no raw colour was added', () => {
    for (const id of [
      'editorial-moment-ritual', 'editorial-moment-confirm', 'editorial-moment-im-ready',
      'editorial-moment-feedback', 'editorial-chapter-',
    ]) expect(src).toContain(id);
    expect(src.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
