import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NIGHT_OUT_PUBLIC_NAME,
  NIGHT_OUT_OFFICIAL_NAME,
  NIGHT_OUT_DESCRIPTOR,
  NIGHT_OUT_EYEBROW,
  RETIRED_PUBLIC_TERMS,
} from '../naming';
import { NIGHT_OUT_LEGACY_ALIAS } from '../sessionState';

const APP = join(__dirname, '..', '..', '..'); // artifacts/aforce-os

describe('NO-b — canonical Night Out naming', () => {
  it('exposes the approved public strings', () => {
    expect(NIGHT_OUT_PUBLIC_NAME).toBe('NIGHT OUT');
    expect(NIGHT_OUT_OFFICIAL_NAME).toBe('AForce Night Out Protocol');
    expect(NIGHT_OUT_DESCRIPTOR).toBe('Private Evening Protocol');
    expect(NIGHT_OUT_EYEBROW).toBe('AFORCE PROTOCOL');
  });

  it('retires "Social Mode" / "Night Owl" as public terms', () => {
    expect(RETIRED_PUBLIC_TERMS).toContain('Social Mode');
    expect(RETIRED_PUBLIC_TERMS).toContain('SOCIAL MODE');
    expect(RETIRED_PUBLIC_TERMS).toContain('Night Owl');
  });

  it('preserves "social_mode" only as an internal legacy alias', () => {
    expect(NIGHT_OUT_LEGACY_ALIAS).toBe('social_mode');
  });
});

describe('NO-b — no public "Social Mode" residue in user-facing en.json', () => {
  const en = JSON.parse(readFileSync(join(APP, 'locales', 'en.json'), 'utf8'));

  it('the social.* copy block renders Night Out, not Social Mode', () => {
    const block = JSON.stringify(en.social ?? {});
    expect(block).not.toMatch(/Social Mode/i);
    expect(en.social.title).toBe('NIGHT OUT');
    expect(en.social.entry_button).toBe('Night Out');
  });

  it('the Profile demo-preview copy renders Night Out, not Social Mode', () => {
    const demo = JSON.stringify(en.profile?.v2?.demo_modes ?? {});
    expect(demo).not.toMatch(/Social Mode/i);
    expect(en.profile?.v2?.social_v2 ?? '').not.toMatch(/Social Mode/i);
  });

  it('NO active locale (all 12) contains public "Social Mode" residue', () => {
    const dir = join(APP, 'locales');
    for (const file of require('node:fs').readdirSync(dir).filter((f: string) => f.endsWith('.json'))) {
      const raw = readFileSync(join(dir, file), 'utf8');
      expect(raw, `${file} contains stale public naming`).not.toMatch(/Social Mode/);
      expect(raw, `${file} contains stale public naming`).not.toMatch(/SOCIAL MODE/);
    }
  });
});

describe('NO-b — the Night Out screen header renders the approved name', () => {
  const screen = readFileSync(join(APP, 'screens', 'SocialModeV2Screen.tsx'), 'utf8');
  it('no "SOCIAL MODE" literal remains in the screen header/labels', () => {
    expect(screen).not.toMatch(/SOCIAL MODE/);
    expect(screen).not.toMatch(/Play Social Mode demo/);
    expect(screen).toMatch(/NIGHT OUT/);
  });
});
