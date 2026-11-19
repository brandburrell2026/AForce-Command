/**
 * Recovery (the Protocol screen) in the approved prototype's look
 * (2026-11-19). The restyle is presentation only, so this file checks the
 * look and leaves what the screen says to editorialProtocolLaw.test.ts,
 * which was not edited.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { edType } from '../../theme/editorialTokens';

const DIR = join(__dirname, '..', 'editorial', 'protocol');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');
const screen = read('EditorialProtocolScreen.tsx');
const clock = read('EdCanonicalClock.tsx');
const checklist = read('EdBriefChecklist.tsx');

describe('Recovery — prototype look', () => {
  it('the title is the stage in Inter 600 and is the page heading', () => {
    expect(screen).toMatch(/accessibilityRole="header"[\s\S]{0,160}style=\{styles\.title\}[\s\S]{0,60}\{protocol\.stage\}/);
    expect(screen).toMatch(/title:\s*\{ \.\.\.\(edType\.protoTitle as TextStyle\)/);
    expect(edType.protoTitle).toMatchObject({ fontFamily: 'Inter_600SemiBold', fontSize: 36, lineHeight: 38 });
  });

  it('sections sit in cards with the 20pt corner', () => {
    expect(screen).toMatch(/card:\s*\{[^}]*borderRadius: 20[^}]*\}/);
    expect((screen.match(/style=\{styles\.card\}/g) ?? []).length).toBe(4);
    expect(clock).toMatch(/wrap:\s*\{[^}]*borderRadius: 20[^}]*\}/);
  });

  it('eyebrows use the mono furniture face at 11pt', () => {
    expect(screen).toMatch(/eyebrow:\s*\{ \.\.\.\(edType\.protoEyebrow as TextStyle\)/);
    expect(clock).toContain('edType.protoEyebrow');
    expect(edType.protoEyebrow).toMatchObject({ fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, letterSpacing: 2 });
    expect(edType.protoNumeral).toMatchObject({ fontFamily: 'Inter_300Light', fontSize: 64 });
  });

  it('"Why this plan" is a pill that keeps a full-size target', () => {
    expect(screen).toMatch(/whyTarget:\s*\{[^}]*minHeight: 52,[^}]*borderRadius: 999/);
    expect(screen).toMatch(/testID="editorial-protocol-why"/);
  });

  it('the clock keeps one numeral and one line — no second instrument', () => {
    expect((clock.match(/<Text/g) ?? []).length).toBe(2);
    expect(clock).toMatch(/flex: pct/);
  });

  it('every test id the screen had is still there', () => {
    for (const id of [
      'editorial-protocol-stale-notice', 'editorial-protocol-count', 'editorial-protocol-hydration',
      'editorial-protocol-live', 'editorial-protocol-signals-empty', 'editorial-protocol-history',
      'editorial-protocol-why',
    ]) expect(screen).toContain(id);
    expect(clock).toContain('editorial-canonical-clock');
    expect(checklist).toContain('editorial-brief-checklist');
  });

  it('no raw colours were introduced', () => {
    for (const src of [screen, clock, checklist]) {
      expect(src.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    }
  });
});
