/**
 * The colour tokens match the Codex Master Brief (2026-11-05, App Spec v1.8.2
 * Appendix F §2), and the One Breath preparation palette is no longer a
 * second, independent system.
 *
 * Before 2026-11-18 `theme/DESIGN-TOKENS.ts` carried the retired red #C1281B,
 * an old blue, a navy and an orange "sun" orb, so the Seal screens were drawn
 * from values the brief had retired.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { af, afOrb } from '../afTokens';
import { preparationTokens as T } from '../DESIGN-TOKENS';

const read = (rel: string): string => fs.readFileSync(path.resolve(__dirname, '..', '..', rel), 'utf8');
const hex = (v: string): string => v.toUpperCase();

describe('af tokens carry the Master Brief palette', () => {
  it('the ten named colours', () => {
    expect(hex(af.canvas)).toBe('#090A0A');
    expect(hex(af.textPrimary)).toBe('#F7F4EF');
    expect(hex(af.textSecondary)).toBe('#AEAAA3');
    expect(hex(af.textTertiary)).toBe('#8A867F');
    expect(hex(af.divider)).toBe('#292A2A');
    expect(hex(af.surface)).toBe('#121313');
    expect(hex(af.red)).toBe('#E51E2A');
    expect(hex(af.redText)).toBe('#FF5A63');
    expect(hex(af.blue)).toBe('#2765FF');
    expect(hex(af.blueText)).toBe('#A9BEFF');
  });

  it('text on a red or blue fill is pure white', () => {
    expect(hex(af.onRed)).toBe('#FFFFFF');
    expect(hex(af.onBlue)).toBe('#FFFFFF');
  });

  it('the orb ramps are the brief\'s, red for One Breath and blue for Social', () => {
    expect(afOrb.oneBreath.map(hex)).toEqual(['#FFC9C4', '#F0525A', '#E51E2A', '#5C0A0E']);
    expect(afOrb.social.map(hex)).toEqual(['#CFDBFF', '#5B8BFF', '#2765FF', '#0E2E8C']);
    expect(afOrb.oneBreathGlow).toBe('rgba(229,30,42,0.45)');
    expect(afOrb.socialGlow).toBe('rgba(39,101,255,0.45)');
  });

  it('the token file no longer describes the retired values as current', () => {
    const src = read('theme/afTokens.ts');
    expect(src).not.toMatch(/FROZEN #C1281B/);
    expect(src).not.toMatch(/#0D0D0D — brand Cinematic Black/);
    expect(src).not.toMatch(/red: Colors\.accent\.primary, \/\/\s+#C1281B/);
  });
});

describe('the One Breath preparation palette is the canonical one', () => {
  it('every colour is an af token, by identity', () => {
    expect(T.ink).toBe(af.canvas);
    expect(T.panel).toBe(af.surface);
    expect(T.bone).toBe(af.textPrimary);
    expect(T.muted).toBe(af.textSecondary);
    expect(T.red).toBe(af.red);
    expect(T.blue).toBe(af.blue);
    expect(T.onBlue).toBe(af.onBlue);
    expect(T.blueHi).toBe(af.blueText);
    expect(T.rule).toBe(af.divider);
    expect(T.oneBreath).toBe(afOrb.oneBreath);
    expect(T.social).toBe(afOrb.social);
  });

  it('the retired keys are gone: no orange, no sun orb, no navy', () => {
    for (const key of ['sun', 'orange', 'dayAccent', 'dayButton', 'midnight', 'nightAccent']) {
      expect(key in T, key).toBe(false);
    }
  });

  it('the file holds no colour literal of its own', () => {
    const code = read('theme/DESIGN-TOKENS.ts')
      .split('\n')
      .filter((line) => !/^\s*(\/\*\*|\*|\/\/)/.test(line))
      .join('\n');
    expect(code).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
    expect(code).not.toMatch(/rgba?\(/);
  });

  it('timings and type are unchanged', () => {
    expect(T.holdMs).toBe(1200);
    expect(T.breathMs).toBe(6000);
    expect(T.quietDimMs).toBe(8000);
    expect(T.headline.fontFamily).toBe('Inter_600SemiBold');
    expect(T.eyebrow.fontFamily).toBe('IBMPlexMono_400Regular');
  });
});

describe('the Seal screens stopped using the retired treatments', () => {
  it('the orb is red or blue, never orange, and the moon is cut from black', () => {
    const orb = read('components/oneBreath/PreparationOrb.tsx');
    expect(orb).toContain('const colors = social ? T.social : T.oneBreath;');
    expect(orb).not.toMatch(/T\.(sun|orange|midnight)\b/);
  });

  it('no screen in the flow reads a retired key', () => {
    const dir = path.resolve(__dirname, '..', '..', 'components/oneBreath');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .filter((f) => /\bT\.(sun|orange|dayAccent|dayButton|midnight|nightAccent)\b/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
